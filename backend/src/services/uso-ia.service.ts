import type { PrismaClient } from '@prisma/client';
import { somarPorAgente, usoAgenteVazio, type FonteAgente, type UsoAgente } from '@/lib/uso-ia-agentes';
import { cotaGroqVazia, type CotaGroq } from '@/lib/ia-groq';

// Contador de uso das IAs por dia (OpenAI paga, Grok, Laya local grátis, Whisper local grátis). Conta em
// memória e grava a cada rodada do agendador em ConfiguracaoIntegracao 'ia.uso.AAAA-MM-DD'.
// Por assistente (29/10/2026): requisições, falhas e tokens em 'ia.agentes.AAAA-MM-DD' ({ agente: uso }).
// Groq grátis (29/10/2026): conta como 'groq'; a última cota lida do Groq fica em 'ia.groq.cota'.

export type FonteIa = 'openai' | 'grok' | 'laya' | 'evitada' | 'whisper' | 'groq' | 'gemini' | 'openrouter';
const pendente: Record<string, Record<FonteIa, number>> = {};
const pendenteAgentes: Record<string, Record<string, UsoAgente>> = {};

const hojeSP = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

export function registrarUsoIa(fonte: FonteIa) {
  const dia = hojeSP();
  pendente[dia] ||= { openai: 0, grok: 0, laya: 0, evitada: 0, whisper: 0, groq: 0, gemini: 0, openrouter: 0 };
  pendente[dia][fonte]++;
}

/** Uma requisição de um assistente: conta a fonte, a falha e os tokens gastos. */
export function registrarChamadaIa(agente: string, fonte: FonteAgente, r: { ok: boolean; tokensEntrada?: number; tokensSaida?: number }) {
  const dia = hojeSP();
  const u = ((pendenteAgentes[dia] ||= {})[agente] ||= usoAgenteVazio());
  u[fonte]++;
  if (!r.ok) u.falhas++;
  u.tokens_entrada += r.tokensEntrada || 0;
  u.tokens_saida += r.tokensSaida || 0;
  if (fonte === 'groq') u.groq_tokens += (r.tokensEntrada || 0) + (r.tokensSaida || 0);
}

/** O Groq não deu conta (falhou, limite, pedido grande demais) e o pedido foi para a IA paga. */
export function registrarReservaGroq(agente: string) {
  ((pendenteAgentes[hojeSP()] ||= {})[agente] ||= usoAgenteVazio()).groq_reserva++;
}

// Última cota lida do Groq (vale para todo o servidor). Gravada junto com o uso, para sobreviver ao reinício.
let cotaGroq: CotaGroq = cotaGroqVazia();
let cotaGroqLida = false;
let cotaGroqMudou = false;
export function cotaGroqAtual(): CotaGroq { return cotaGroq; }
export function atualizarCotaGroq(c: CotaGroq) { cotaGroq = c; cotaGroqMudou = true; }
export async function carregarCotaGroq(prisma: PrismaClient): Promise<CotaGroq> {
  if (!cotaGroqLida) {
    cotaGroqLida = true;
    const r = await prisma.configuracaoIntegracao.findUnique({ where: { chave: 'ia.groq.cota' } }).catch(() => null);
    if (r?.valor && !cotaGroq.atualizado_em) cotaGroq = { ...cotaGroqVazia(), ...lerJson(r.valor) };
  }
  return cotaGroq;
}

const lerJson = (valor: string | null | undefined) => { try { return valor ? JSON.parse(valor) : {}; } catch { return {}; } };

/** Soma o que está em memória ao que já está gravado. */
export async function gravarUsoIa(prisma: PrismaClient) {
  for (const dia of Object.keys(pendente)) {
    const soma = pendente[dia];
    delete pendente[dia];
    const chave = `ia.uso.${dia}`;
    const atual = await prisma.configuracaoIntegracao.findUnique({ where: { chave } }).catch(() => null);
    let base: Record<FonteIa, number> = { openai: 0, grok: 0, laya: 0, evitada: 0, whisper: 0, groq: 0, gemini: 0, openrouter: 0 };
    try { if (atual?.valor) base = { ...base, ...JSON.parse(atual.valor) }; } catch { /* valor antigo inválido: recomeça */ }
    const valor = JSON.stringify({ openai: base.openai + soma.openai, grok: base.grok + soma.grok, laya: base.laya + soma.laya, evitada: (base.evitada || 0) + (soma.evitada || 0), whisper: (base.whisper || 0) + (soma.whisper || 0), groq: (base.groq || 0) + (soma.groq || 0), gemini: (base.gemini || 0) + (soma.gemini || 0), openrouter: (base.openrouter || 0) + (soma.openrouter || 0) });
    await prisma.configuracaoIntegracao.upsert({ where: { chave }, create: { chave, valor, updated_by: 'sistema' }, update: { valor } }).catch(() => {});
  }
  for (const dia of Object.keys(pendenteAgentes)) {
    const soma = pendenteAgentes[dia];
    delete pendenteAgentes[dia];
    const chave = `ia.agentes.${dia}`;
    const atual = await prisma.configuracaoIntegracao.findUnique({ where: { chave } }).catch(() => null);
    const valor = JSON.stringify(somarPorAgente(lerJson(atual?.valor), soma));
    await prisma.configuracaoIntegracao.upsert({ where: { chave }, create: { chave, valor, updated_by: 'sistema' }, update: { valor } }).catch(() => {});
  }
  if (cotaGroqMudou) {
    cotaGroqMudou = false;
    const chave = 'ia.groq.cota', valor = JSON.stringify(cotaGroq);
    await prisma.configuracaoIntegracao.upsert({ where: { chave }, create: { chave, valor, updated_by: 'sistema' }, update: { valor } }).catch(() => {});
  }
}

/** Últimos N dias (mais recente primeiro), já com o que ainda está em memória. */
export async function usoIaUltimosDias(prisma: PrismaClient, dias = 7) {
  const out: { dia: string; openai: number; grok: number; laya: number; evitada: number; whisper: number; groq: number; gemini: number; openrouter: number }[] = [];
  for (let i = 0; i < dias; i++) {
    const dia = hojeSP(new Date(Date.now() - i * 864e5));
    const r = await prisma.configuracaoIntegracao.findUnique({ where: { chave: `ia.uso.${dia}` } }).catch(() => null);
    let v = { openai: 0, grok: 0, laya: 0, evitada: 0, whisper: 0, groq: 0, gemini: 0, openrouter: 0 };
    try { if (r?.valor) v = { ...v, ...JSON.parse(r.valor) }; } catch { /* ignora */ }
    const mem = pendente[dia];
    out.push({ dia, openai: v.openai + (mem?.openai || 0), grok: v.grok + (mem?.grok || 0), laya: v.laya + (mem?.laya || 0), evitada: (v.evitada || 0) + (mem?.evitada || 0), whisper: (v.whisper || 0) + (mem?.whisper || 0), groq: (v.groq || 0) + (mem?.groq || 0), gemini: (v.gemini || 0) + (mem?.gemini || 0), openrouter: (v.openrouter || 0) + (mem?.openrouter || 0) });
  }
  return out;
}

/** Uso por assistente em cada dia pedido (AAAA-MM-DD), já com o que ainda está em memória. */
export async function usoIaPorAgente(prisma: PrismaClient, dias: string[]): Promise<{ dia: string; agentes: Record<string, UsoAgente> }[]> {
  const regs = new Map((await prisma.configuracaoIntegracao.findMany({ where: { chave: { in: dias.map(d => `ia.agentes.${d}`) } } }).catch(() => [])).map(x => [x.chave.slice('ia.agentes.'.length), x.valor]));
  return dias.map(dia => ({ dia, agentes: somarPorAgente(lerJson(regs.get(dia)), pendenteAgentes[dia] || {}) }));
}
