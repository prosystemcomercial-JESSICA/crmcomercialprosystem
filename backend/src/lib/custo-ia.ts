// Custo das IAs pagas em dinheiro (pedido da Jessica, 05/11/2026: "consumo da chave em reais").
// Preço de tabela por milhão de tokens, em dólar; a tela converte para reais pela cotação do dia.
// Regras puras; quem grava é services/uso-ia.service, quem lê a cotação é services/cotacao-dolar.service.

import type { UsoAgente } from './uso-ia-agentes';

export type Preco = { entrada: number; saida: number };

/**
 * Preço de tabela (US$ por 1 milhão de tokens), conferido em 05/11/2026 nas páginas de preço da OpenAI e da xAI.
 * Sem desconto de cache: o valor fica um pouco acima do cobrado, nunca abaixo.
 * IA_PRECOS no .env troca ou acrescenta modelos: {"gpt-6-luna":{"entrada":0.1,"saida":0.5}}.
 */
const TABELA: Record<string, Preco> = {
  'gpt-6-luna': { entrada: 0.10, saida: 0.50 },
  'gpt-6-sol': { entrada: 2.00, saida: 10.00 },
  'gpt-4o-transcribe': { entrada: 2.50, saida: 10.00 },
  'grok-4.7': { entrada: 2.00, saida: 6.00 },
};

export function tabelaDePrecos(env: { IA_PRECOS?: string } = {}): Record<string, Preco> {
  let extra: Record<string, Preco> = {};
  try { extra = env.IA_PRECOS ? JSON.parse(env.IA_PRECOS) : {}; } catch { /* JSON inválido: fica a tabela padrão */ }
  return { ...TABELA, ...extra };
}

/** Custo de uma chamada em dólar; null quando o modelo não está na tabela. */
export function custoUsd(tabela: Record<string, Preco>, modelo: string, entrada: number, saida: number): number | null {
  const p = tabela[modelo];
  if (!p) return null;
  return (entrada * p.entrada + saida * p.saida) / 1e6;
}

/**
 * Dias gravados antes de 05/11/2026 não têm o custo, só os tokens somados de todas as IAs do assistente.
 * Estimativa: tira os tokens do Groq e divide o resto pelas chamadas de cada IA. A parte da OpenAI e do Grok
 * vai pelo preço do modelo de cada uma.
 */
export function estimarCustoAntigo(u: UsoAgente, modelos: { openai: Preco | undefined; grok: Preco | undefined }): { openai: number; grok: number } {
  const chamadas = u.openai + u.grok + u.gemini + u.openrouter;
  const tokens = u.tokens_entrada + u.tokens_saida;
  if (!chamadas || !tokens) return { openai: 0, grok: 0 };
  const semGroq = Math.max(0, tokens - u.groq_tokens) / tokens;
  const entrada = u.tokens_entrada * semGroq, saida = u.tokens_saida * semGroq;
  const parte = (n: number, p: Preco | undefined) => (p && n ? ((entrada * p.entrada + saida * p.saida) * (n / chamadas)) / 1e6 : 0);
  return { openai: parte(u.openai, modelos.openai), grok: parte(u.grok, modelos.grok) };
}

/**
 * Custo em dólar de um registro diário do assistente: o gravado e, para as chamadas de antes da medição
 * (dias antigos e o começo do dia da publicação), a estimativa proporcional.
 */
export function custoDoDia(u: UsoAgente, modelos: { openai: Preco | undefined; grok: Preco | undefined }): { openai: number; grok: number; estimado: boolean } {
  const total = u.openai + u.grok + u.whisper + u.groq + u.gemini + u.openrouter;
  const semMedir = total ? Math.max(0, total - (u.custo_gravado || 0)) / total : 0;
  if (!semMedir) return { openai: u.custo_openai_usd || 0, grok: u.custo_grok_usd || 0, estimado: false };
  const e = estimarCustoAntigo(u, modelos);
  return { openai: (u.custo_openai_usd || 0) + e.openai * semMedir, grok: (u.custo_grok_usd || 0) + e.grok * semMedir, estimado: true };
}
