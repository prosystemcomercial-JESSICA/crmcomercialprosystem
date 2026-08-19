// Probabilidade de fechamento por etapa do funil comercial — usada em todo cálculo
// de pipeline ponderado (forecast.ts, analise-comercial.ts, /leads/previsao).
// Fonte única: antes disso a mesma tabela existia duplicada em dois arquivos, e uma
// terceira rota (/leads/previsao) usava o campo Lead.probabilidade, que está 100%
// vazio em produção (0 de 213 leads preenchidos) — na prática caía sempre no
// fallback de 50% fixo, pior que diferenciar por etapa.
export const PROB_ETAPA: Record<string, number> = {
  NOVO_LEAD:             0.05,
  PRIMEIRO_CONTATO:      0.10,
  EM_ATENDIMENTO:        0.20,
  AGUARDANDO_RETORNO:    0.25,
  PROPOSTA_A_GERAR:      0.35,
  PROPOSTA_ENVIADA:      0.50,
  EM_NEGOCIACAO:         0.65,
  ACEITO:                0.85,
  CONTRATO_EM_ANDAMENTO: 0.95,
  CONTRATO_ASSINADO:     1.00,
  // ONBOARDING/EXECUCAO_TECNICA já são pós-venda; PERDIDO = 0 (fora da tabela).
};

export function probabilidadeEtapa(etapa: string | null | undefined): number {
  return PROB_ETAPA[etapa || ''] ?? 0;
}
