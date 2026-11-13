import { readFileSync } from 'node:fs';
import path from 'node:path';

// Conhecimento de produto do Rafael (13/11/2026, pedido da Jessica: "ele tem que estudar a nossa base de conhecimentos").
// A Universidade Prosystem (universidade.prosystemnet.com/base-conhecimento) foi lida inteira por
// backend/scripts/ler-universidade.ts e gravada em docs/comercial/universidade-prosystem.json.
// O Rafael sempre carrega o guia comercial (resumo) + o índice de todos os artigos; os artigos
// completos entram quando o assunto (dúvida, conversa, treino) toca neles.

export type ArtigoUniversidade = { url: string; categoria: string; titulo: string; atualizado: string | null; texto: string };
type Base = { lido_em: string; artigos: ArtigoUniversidade[]; guia: string };

let cache: Base | null = null;
function docs(arquivo: string) { return path.resolve(process.cwd(), '..', 'docs', 'comercial', arquivo); }

export function baseUniversidade(): Base {
  if (cache) return cache;
  let lido_em = '';
  let artigos: ArtigoUniversidade[] = [];
  let guia = '';
  try { const j = JSON.parse(readFileSync(docs('universidade-prosystem.json'), 'utf8')); lido_em = j.lido_em || ''; artigos = j.artigos || []; } catch { /* sem a base, o Rafael segue com o resto */ }
  try { guia = readFileSync(docs('base-conhecimento-comercial.md'), 'utf8'); } catch { /* idem */ }
  cache = { lido_em, artigos, guia };
  return cache;
}

const PARADAS = new Set('para com como que uma umas uns por pelo pela das dos nas nos isso esse essa este esta tem ter sem mais muito quando qual quais onde voce vocês sistema prosystem cliente clientes loja fazer pode posso precisa preciso sobre entre ainda também tambem agora depois antes ele ela eles elas seu sua seus suas meu minha nosso nossa ja não nao sim'.split(' '));

export function palavras(texto: string): string[] {
  const ws = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{3,}/g) || [];
  return [...new Set(ws.filter(w => !PARADAS.has(w)))];
}

/** Artigos mais ligados ao assunto: título pesa mais que categoria, que pesa mais que o corpo. Pura, para teste. */
export function artigosRelacionados(artigos: ArtigoUniversidade[], assunto: string, max = 4): ArtigoUniversidade[] {
  const ps = palavras(assunto);
  if (!ps.length) return [];
  const notas = artigos.map(a => {
    const tit = palavras(a.titulo).join(' ');
    const cat = palavras(a.categoria.replace(/-/g, ' ')).join(' ');
    const corpo = ` ${palavras(a.texto).join(' ')} `;
    let nota = 0;
    for (const p of ps) {
      if (tit.includes(p)) nota += 5;
      if (cat.includes(p)) nota += 2;
      if (corpo.includes(` ${p}`)) nota += 1;
    }
    return { a, nota };
  });
  const minimo = Math.max(3, Math.ceil(ps.length * 0.25));
  return notas.filter(n => n.nota >= minimo).sort((x, y) => y.nota - x.nota).slice(0, max).map(n => n.a);
}

/** Índice compacto de tudo o que existe na Universidade (categoria › títulos). */
export function indiceUniversidade(artigos: ArtigoUniversidade[]): string {
  const porCat = new Map<string, string[]>();
  for (const a of artigos) porCat.set(a.categoria, [...(porCat.get(a.categoria) || []), a.titulo]);
  return [...porCat].map(([c, ts]) => `- ${c.replace(/-/g, ' ')}: ${ts.join('; ')}`).join('\n');
}

/** Bloco fixo do conhecimento de produto do Rafael: guia comercial + índice dos artigos. */
export function conhecimentoProduto(): string {
  const b = baseUniversidade();
  if (!b.guia && !b.artigos.length) return '';
  return [
    '\n\n=== SEU CONHECIMENTO DO PRODUTO PROSYSTEM (fonte oficial: Universidade Prosystem, base de conhecimento) ===',
    'Use isto ANTES da internet para qualquer assunto do produto (recursos, planos, integrações, fiscal, suporte). Se não estiver aqui nem no material aprovado, não invente: diga o que precisa ser confirmado.',
    b.guia,
    b.artigos.length ? `\nArtigos da Universidade que você estudou (${b.artigos.length}, lidos em ${b.lido_em.slice(0, 10)}):\n${indiceUniversidade(b.artigos)}` : '',
  ].join('\n');
}

/** Artigos completos ligados a um assunto, prontos para entrar no pedido ao modelo. */
export function trechosUniversidade(assunto: string, max = 4, maxChars = 12000): string {
  const achados = artigosRelacionados(baseUniversidade().artigos, assunto, max);
  if (!achados.length) return '';
  let out = '\n=== ARTIGOS DA UNIVERSIDADE PROSYSTEM LIGADOS AO ASSUNTO (fonte oficial) ===';
  for (const a of achados) {
    const parte = `\n## ${a.titulo} (${a.categoria.replace(/-/g, ' ')}${a.atualizado ? `, atualizado em ${a.atualizado}` : ''})\n${a.url}\n${a.texto.slice(0, 4000)}`;
    if (out.length + parte.length > maxChars) break;
    out += parte;
  }
  return out;
}
