// Groq gratuito na frente das IAs pagas (pedido da Jessica, 29/10/2026: "economizar antes").
// Regras puras: se o pedido cabe na cota grátis e como ler a cota que o Groq devolve em cada resposta.
// A chamada fica em services/ia-gemini.service; o contador, em services/uso-ia.service.

export type CotaGroq = {
  limite_dia: number | null; restante_dia: number | null;
  limite_tokens_min: number | null; restante_tokens_min: number | null;
  /** Até quando não vale tentar (limite batido), em ms desde 1970; 0 = livre. */
  bloqueado_ate: number; atualizado_em: number;
};

export const cotaGroqVazia = (): CotaGroq => ({ limite_dia: null, restante_dia: null, limite_tokens_min: null, restante_tokens_min: null, bloqueado_ate: 0, atualizado_em: 0 });

/** "1m26.4s", "3.03s", "120ms", "2h0m" ou segundos ("7") → milissegundos; 0 quando não der para ler. */
export function duracaoMs(v: string | null | undefined): number {
  const s = String(v || '').trim();
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 1000);
  let ms = 0, achou = false;
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) {
    achou = true;
    const n = Number(m[1]);
    ms += m[2] === 'h' ? n * 3_600_000 : m[2] === 'm' ? n * 60_000 : m[2] === 's' ? n * 1000 : n;
  }
  return achou ? Math.round(ms) : 0;
}

const num = (v: string | null | undefined) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** Lê os cabeçalhos x-ratelimit-* (e retry-after no 429) e devolve a cota atualizada. */
export function lerCotaGroq(anterior: CotaGroq, cab: { get(nome: string): string | null }, status: number, agora = Date.now()): CotaGroq {
  const c: CotaGroq = {
    limite_dia: num(cab.get('x-ratelimit-limit-requests')) ?? anterior.limite_dia,
    restante_dia: num(cab.get('x-ratelimit-remaining-requests')) ?? anterior.restante_dia,
    limite_tokens_min: num(cab.get('x-ratelimit-limit-tokens')) ?? anterior.limite_tokens_min,
    restante_tokens_min: num(cab.get('x-ratelimit-remaining-tokens')) ?? anterior.restante_tokens_min,
    bloqueado_ate: 0, atualizado_em: agora,
  };
  if (status === 429) c.bloqueado_ate = agora + (duracaoMs(cab.get('retry-after')) || 60_000);
  else if (c.restante_dia === 0) c.bloqueado_ate = agora + (duracaoMs(cab.get('x-ratelimit-reset-requests')) || 60_000);
  return c;
}

/** Tokens de entrada estimados (português: ~3 caracteres por token, para não errar para menos). */
export const tokensEstimados = (texto: string) => Math.ceil(texto.length / 3);

/**
 * Vale tentar o Groq? Não, se o limite foi batido há pouco ou se o pedido estoura os tokens por minuto
 * (aí ele recusaria e a tentativa só atrasaria a resposta). `folga` = espaço para a resposta e o raciocínio.
 */
export function cabeNoGroq(cota: CotaGroq, texto: string, p: { maxEntrada: number; folga?: number }, agora = Date.now()): boolean {
  if (cota.bloqueado_ate > agora) return false;
  const precisa = tokensEstimados(texto);
  if (precisa > p.maxEntrada) return false;
  // A cota por minuto lida há menos de 1 minuto ainda vale; depois disso ela já se renovou.
  if (cota.restante_tokens_min != null && agora - cota.atualizado_em < 60_000 && cota.restante_tokens_min < precisa + (p.folga ?? 1500)) return false;
  return true;
}
