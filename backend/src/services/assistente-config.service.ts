import type { PrismaClient } from '@prisma/client';

// Chaves de IA do assistente (Configurações → Assistente no WhatsApp). Padrões
// conservadores enquanto a Laya não é treinada: triagem com IA desligada e
// alerta de risco só para clientes da base com confiança alta.

export type ConfigIa = { laya_triagem: boolean; laya_confianca: number; risco_limite: number; risco_so_clientes: boolean };
export const PADRAO_IA: ConfigIa = { laya_triagem: false, laya_confianca: 0.8, risco_limite: 0.8, risco_so_clientes: true };
const CHAVES: Record<keyof ConfigIa, string> = {
  laya_triagem: 'assistente.laya_triagem', laya_confianca: 'assistente.laya_confianca',
  risco_limite: 'assistente.risco_limite', risco_so_clientes: 'assistente.risco_so_clientes',
};

const num = (v: string | undefined, padrao: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0.3 && n <= 0.99 ? n : padrao;
};

export async function obterConfigIa(prisma: PrismaClient): Promise<ConfigIa> {
  const rows = await prisma.configuracaoIntegracao.findMany({ where: { chave: { in: Object.values(CHAVES) } } }).catch(() => []);
  const v = (k: keyof ConfigIa) => rows.find(r => r.chave === CHAVES[k])?.valor;
  return {
    laya_triagem: v('laya_triagem') === 'true',
    laya_confianca: num(v('laya_confianca'), PADRAO_IA.laya_confianca),
    risco_limite: num(v('risco_limite'), PADRAO_IA.risco_limite),
    risco_so_clientes: v('risco_so_clientes') === undefined ? PADRAO_IA.risco_so_clientes : v('risco_so_clientes') === 'true',
  };
}

export async function salvarConfigIa(prisma: PrismaClient, cfg: Partial<ConfigIa>, por: string) {
  for (const k of Object.keys(cfg) as (keyof ConfigIa)[]) {
    if (cfg[k] === undefined) continue;
    const chave = CHAVES[k], valor = String(cfg[k]);
    await prisma.configuracaoIntegracao.upsert({ where: { chave }, create: { chave, valor, updated_by: por }, update: { valor, updated_by: por } });
  }
}
