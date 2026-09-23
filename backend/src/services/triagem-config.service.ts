import type { PrismaClient } from '@prisma/client';

export type MaterialSegmento = { texto: string; imagem: string | null; pdf: string | null; pdf_nome: string | null };
export type ConfigTriagem = { ativa: boolean; material: { farmacia: MaterialSegmento; padaria: MaterialSegmento } };
type PrismaConfig = Pick<PrismaClient, 'configuracaoIntegracao'>;

const CH = {
  ativa: 'whatsapp.triagem.ativa',
  farmacia: 'whatsapp.triagem.material.farmacia',
  padaria: 'whatsapp.triagem.material.padaria',
};
const VAZIO: MaterialSegmento = { texto: '', imagem: null, pdf: null, pdf_nome: null };

export const materialVazio = (m: MaterialSegmento) => !m.texto.trim() && !m.imagem && !m.pdf;

function lerMaterial(json: string | undefined): MaterialSegmento {
  if (!json) return { ...VAZIO };
  try {
    const m = JSON.parse(json);
    return { texto: String(m?.texto || ''), imagem: m?.imagem || null, pdf: m?.pdf || null, pdf_nome: m?.pdf_nome || null };
  } catch {
    return { ...VAZIO };
  }
}

export async function obterConfigTriagem(prisma: PrismaConfig): Promise<ConfigTriagem> {
  const linhas = await prisma.configuracaoIntegracao.findMany({ where: { chave: { in: Object.values(CH) } } });
  const v = (c: string) => linhas.find(l => l.chave === c)?.valor;
  return { ativa: v(CH.ativa) === 'true', material: { farmacia: lerMaterial(v(CH.farmacia)), padaria: lerMaterial(v(CH.padaria)) } };
}

export async function salvarConfigTriagem(prisma: PrismaConfig, cfg: ConfigTriagem, por = 'system'): Promise<void> {
  const pares: [string, string][] = [
    [CH.ativa, cfg.ativa ? 'true' : 'false'],
    [CH.farmacia, JSON.stringify(cfg.material.farmacia)],
    [CH.padaria, JSON.stringify(cfg.material.padaria)],
  ];
  for (const [chave, valor] of pares) {
    await prisma.configuracaoIntegracao.upsert({ where: { chave }, create: { chave, valor, updated_by: por }, update: { valor, updated_by: por } });
  }
}
