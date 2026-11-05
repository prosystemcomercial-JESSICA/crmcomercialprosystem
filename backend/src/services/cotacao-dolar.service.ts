import type { PrismaClient } from '@prisma/client';

// Cotação do dólar para mostrar o custo das IAs em reais (05/11/2026). Lida na AwesomeAPI (gratuita, sem chave)
// no máximo a cada 6 horas e guardada em ConfiguracaoIntegracao 'ia.cotacao.usd', para valer se a consulta falhar.
// IA_DOLAR no .env fixa a cotação (ex.: 5.45) e dispensa a consulta.

export type Cotacao = { valor: number; em: string; fonte: 'fixa' | 'awesomeapi' | 'guardada' | 'aproximada' };

const CHAVE = 'ia.cotacao.usd';
const SEIS_HORAS = 6 * 3600_000;
let cache: { c: Cotacao; lidaEm: number } | null = null;

export async function cotacaoDolar(prisma: PrismaClient): Promise<Cotacao> {
  const fixa = Number(process.env.IA_DOLAR);
  if (fixa > 0) return { valor: fixa, em: '', fonte: 'fixa' };
  if (cache && Date.now() - cache.lidaEm < SEIS_HORAS) return cache.c;
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', { signal: AbortSignal.timeout(8000) });
    const j: any = res.ok ? await res.json() : null;
    const valor = Number(j?.USDBRL?.bid);
    if (valor > 0) {
      const c: Cotacao = { valor, em: String(j.USDBRL.create_date || new Date().toISOString()), fonte: 'awesomeapi' };
      cache = { c, lidaEm: Date.now() };
      await prisma.configuracaoIntegracao.upsert({ where: { chave: CHAVE }, create: { chave: CHAVE, valor: JSON.stringify(c), updated_by: 'sistema' }, update: { valor: JSON.stringify(c) } }).catch(() => {});
      return c;
    }
  } catch { /* sem internet ou API fora: usa a guardada */ }
  const r = await prisma.configuracaoIntegracao.findUnique({ where: { chave: CHAVE } }).catch(() => null);
  try {
    const g = JSON.parse(r?.valor || '');
    if (Number(g.valor) > 0) { const c: Cotacao = { valor: Number(g.valor), em: String(g.em || ''), fonte: 'guardada' }; cache = { c, lidaEm: Date.now() - SEIS_HORAS + 600_000 }; return c; }
  } catch { /* nada guardado */ }
  return { valor: 5.5, em: '', fonte: 'aproximada' };
}
