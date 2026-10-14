// Fila do dia do Programa de Ativos (parte 3 do Plano de Expansão, 14/10/2026). Puro.
// Meta Comercial 2026: 8 contatos por dia por vendedor (8 × 20 dias = 160 por mês cada).

export const META_DIA_ATIVOS = 8;
export const DIAS_PARADO = 14;
const FINAIS = ['CONCLUIDO', 'SEM_SUCESSO'];
const EM_RISCO = ['RISCO', 'CRITICO'];

export type ContatoFila = { etapa: string; oculto?: boolean | null; tem_problema?: boolean | null; saude?: string | null; contatado_em?: Date | string | null };

/** 0 = em risco/com problema, 1 = nunca contatado, 2 = parado há mais de 14 dias; null = fora da fila de hoje. */
export function prioridadeAtivo(c: ContatoFila, agora: Date): 0 | 1 | 2 | null {
  if (c.oculto || FINAIS.includes(c.etapa)) return null;
  if (c.tem_problema || EM_RISCO.includes(String(c.saude || ''))) return 0;
  if (c.etapa === 'A_CONTATAR' || !c.contatado_em) return 1;
  const dias = (agora.getTime() - new Date(c.contatado_em).getTime()) / 864e5;
  return dias >= DIAS_PARADO ? 2 : null;
}

/** Os N da vez: por prioridade e, dentro dela, quem está há mais tempo sem contato. */
export function filaDoDia<T extends ContatoFila>(contatos: T[], agora: Date, n = META_DIA_ATIVOS): (T & { prioridade: 0 | 1 | 2 })[] {
  const tempo = (c: T) => (c.contatado_em ? new Date(c.contatado_em).getTime() : 0);
  return contatos
    .map(c => ({ ...c, prioridade: prioridadeAtivo(c, agora) }))
    .filter((c): c is T & { prioridade: 0 | 1 | 2 } => c.prioridade !== null)
    .sort((a, b) => a.prioridade - b.prioridade || tempo(a) - tempo(b))
    .slice(0, n);
}
