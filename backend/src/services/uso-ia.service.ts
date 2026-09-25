import type { PrismaClient } from '@prisma/client';

// Contador de uso das IAs por dia (OpenAI paga, Grok, Laya local grátis). Conta em
// memória e grava a cada rodada do agendador em ConfiguracaoIntegracao 'ia.uso.AAAA-MM-DD'.

export type FonteIa = 'openai' | 'grok' | 'laya';
const pendente: Record<string, Record<FonteIa, number>> = {};

const hojeSP = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

export function registrarUsoIa(fonte: FonteIa) {
  const dia = hojeSP();
  pendente[dia] ||= { openai: 0, grok: 0, laya: 0 };
  pendente[dia][fonte]++;
}

/** Soma o que está em memória ao que já está gravado. */
export async function gravarUsoIa(prisma: PrismaClient) {
  for (const dia of Object.keys(pendente)) {
    const soma = pendente[dia];
    delete pendente[dia];
    const chave = `ia.uso.${dia}`;
    const atual = await prisma.configuracaoIntegracao.findUnique({ where: { chave } }).catch(() => null);
    let base: Record<FonteIa, number> = { openai: 0, grok: 0, laya: 0 };
    try { if (atual?.valor) base = { ...base, ...JSON.parse(atual.valor) }; } catch { /* valor antigo inválido: recomeça */ }
    const valor = JSON.stringify({ openai: base.openai + soma.openai, grok: base.grok + soma.grok, laya: base.laya + soma.laya });
    await prisma.configuracaoIntegracao.upsert({ where: { chave }, create: { chave, valor, updated_by: 'sistema' }, update: { valor } }).catch(() => {});
  }
}

/** Últimos N dias (mais recente primeiro), já com o que ainda está em memória. */
export async function usoIaUltimosDias(prisma: PrismaClient, dias = 7) {
  const out: { dia: string; openai: number; grok: number; laya: number }[] = [];
  for (let i = 0; i < dias; i++) {
    const dia = hojeSP(new Date(Date.now() - i * 864e5));
    const r = await prisma.configuracaoIntegracao.findUnique({ where: { chave: `ia.uso.${dia}` } }).catch(() => null);
    let v = { openai: 0, grok: 0, laya: 0 };
    try { if (r?.valor) v = { ...v, ...JSON.parse(r.valor) }; } catch { /* ignora */ }
    const mem = pendente[dia];
    out.push({ dia, openai: v.openai + (mem?.openai || 0), grok: v.grok + (mem?.grok || 0), laya: v.laya + (mem?.laya || 0) });
  }
  return out;
}
