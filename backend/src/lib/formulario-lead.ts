// Formulário de captação (site, blog, landing page): lê e normaliza o que chega em
// POST /publico/leads/formulario. Regras puras — a gravação fica na rota e na fila da Caroline.
import { z } from 'zod';

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "Blog Prosystem" → FORMULARIO_BLOG_PROSYSTEM (sem origem: FORMULARIO_SITE). */
export function origemDoFormulario(origem: string | null | undefined): string {
  const k = sem(String(origem || '')).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
  return `FORMULARIO_${k || 'SITE'}`;
}

const SCHEMA = z.object({
  nome: z.string().trim().min(2).max(120),
  telefone: z.string().trim().min(1).max(30),
  email: z.string().trim().max(160).optional(),
  empresa: z.string().trim().max(160).optional(),
  segmento: z.string().trim().max(60).optional(),
  cidade: z.string().trim().max(120).optional(),
  origem: z.string().trim().max(60).optional(),
  material: z.string().trim().max(200).optional(),   // o que a pessoa pediu (ex.: e-book, guia, apresentação)
  mensagem: z.string().trim().max(1000).optional(),
  pagina: z.string().trim().max(500).optional(),
  site: z.string().max(200).optional(),               // campo invisível: humano deixa vazio
  utm_source: z.string().max(120).optional(), utm_medium: z.string().max(120).optional(), utm_campaign: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(), utm_term: z.string().max(200).optional(), fbclid: z.string().max(300).optional(), gclid: z.string().max(300).optional(),
});

export type FormularioLead = Omit<z.infer<typeof SCHEMA>, 'site' | 'cidade' | 'origem' | 'segmento' | 'telefone'> & { cidade: string | null; estado: string | null; origem: string; telefone: string; segmento: string | null };

export function lerFormularioLead(body: unknown): { ok: true; dados: FormularioLead } | { ok: false; erro: string; robo?: true } {
  const b = SCHEMA.safeParse(body);
  if (!b.success) return { ok: false, erro: 'Preencha seu nome e WhatsApp.' };
  const d = b.data;
  if (d.site) return { ok: false, robo: true, erro: '' };
  let fone = d.telefone.replace(/\D/g, '');
  if (fone.length < 10) return { ok: false, erro: 'Informe o WhatsApp com DDD.' };
  if (!fone.startsWith('55') || fone.length <= 11) fone = `55${fone}`;
  const seg = sem(d.segmento || '').toLowerCase();
  const segmento = /farm|drog|manipul/.test(seg) ? 'Farmácia' : /padar|panif|confeit/.test(seg) ? 'Padaria' : d.segmento ? d.segmento : null;
  const [cidade, uf] = (d.cidade || '').split(/\s*[\/\-,]\s*/);
  const { site: _s, origem, ...resto } = d;
  return {
    ok: true,
    dados: { ...resto, telefone: fone, segmento, cidade: cidade || null, estado: uf ? uf.toUpperCase().slice(0, 2) : null, origem: origemDoFormulario(origem) },
  };
}
