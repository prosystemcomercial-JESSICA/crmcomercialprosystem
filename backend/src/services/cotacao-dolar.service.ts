import type { PrismaClient } from '@prisma/client';

// Cotação do dólar para mostrar o custo das IAs em reais (05/11/2026). Lida no Banco Central (PTAX, venda; o último
// boletim dos últimos 7 dias) e, se ele falhar, na Frankfurter (BCE); as duas são grátis e sem chave. No máximo a cada 6 horas e guardada em ConfiguracaoIntegracao 'ia.cotacao.usd', para valer se a consulta falhar.
// IA_DOLAR no .env fixa a cotação (ex.: 5.45) e dispensa a consulta.

export type Cotacao = { valor: number; em: string; fonte: 'fixa' | 'bcb' | 'frankfurter' | 'guardada' | 'aproximada' };

const mdy = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;

async function lerBancoCentral(): Promise<Cotacao | null> {
  const fim = new Date(), ini = new Date(Date.now() - 7 * 864e5);
  const url = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)'
    + `?@moeda='USD'&@dataInicial='${mdy(ini)}'&@dataFinalCotacao='${mdy(fim)}'&$format=json&$select=cotacaoVenda,dataHoraCotacao`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const ultimo = res.ok ? ((await res.json()) as any)?.value?.slice(-1)[0] : null;
  return Number(ultimo?.cotacaoVenda) > 0 ? { valor: Number(ultimo.cotacaoVenda), em: String(ultimo.dataHoraCotacao || ''), fonte: 'bcb' } : null;
}

async function lerFrankfurter(): Promise<Cotacao | null> {
  const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=BRL', { signal: AbortSignal.timeout(8000) });
  const j: any = res.ok ? await res.json() : null;
  return Number(j?.rates?.BRL) > 0 ? { valor: Number(j.rates.BRL), em: String(j.date || ''), fonte: 'frankfurter' } : null;
}

const CHAVE = 'ia.cotacao.usd';
const SEIS_HORAS = 6 * 3600_000;
let cache: { c: Cotacao; lidaEm: number } | null = null;

export async function cotacaoDolar(prisma: PrismaClient): Promise<Cotacao> {
  const fixa = Number(process.env.IA_DOLAR);
  if (fixa > 0) return { valor: fixa, em: '', fonte: 'fixa' };
  if (cache && Date.now() - cache.lidaEm < SEIS_HORAS) return cache.c;
  for (const ler of [lerBancoCentral, lerFrankfurter]) {
    const c = await ler().catch(() => null);
    if (c) {
      cache = { c, lidaEm: Date.now() };
      await prisma.configuracaoIntegracao.upsert({ where: { chave: CHAVE }, create: { chave: CHAVE, valor: JSON.stringify(c), updated_by: 'sistema' }, update: { valor: JSON.stringify(c) } }).catch(() => {});
      return c;
    }
  }
  // Sem internet ou as duas fora: usa a guardada.
  const r = await prisma.configuracaoIntegracao.findUnique({ where: { chave: CHAVE } }).catch(() => null);
  try {
    const g = JSON.parse(r?.valor || '');
    if (Number(g.valor) > 0) { const c: Cotacao = { valor: Number(g.valor), em: String(g.em || ''), fonte: 'guardada' }; cache = { c, lidaEm: Date.now() - SEIS_HORAS + 600_000 }; return c; }
  } catch { /* nada guardado */ }
  return { valor: 5.5, em: '', fonte: 'aproximada' };
}
