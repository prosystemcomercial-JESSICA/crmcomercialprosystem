// Etapas de fechamento que um SDR não pode atribuir a um lead — fechamento é
// sempre ação do vendedor/closer. SDR qualifica até QUALIFICADO e a supervisão
// distribui o lead para um vendedor fechar (ver rota /leads/:id/distribuir).
export const ETAPAS_BLOQUEADAS_PARA_SDR = ['ACEITO', 'FECHADO', 'CONTRATO_ASSINADO', 'CONTRATO_EM_ANDAMENTO'];

export function bloqueadoParaFecharSeSDR(role: string | undefined, etapaAlvo: string | undefined | null): boolean {
  if ((role || '').toUpperCase() !== 'SDR') return false;
  if (!etapaAlvo) return false;
  return ETAPAS_BLOQUEADAS_PARA_SDR.includes(etapaAlvo);
}

export function ehSDR(role: string | undefined): boolean {
  return (role || '').toUpperCase() === 'SDR';
}

// Kanban PRÓPRIO do SDR (campo Lead.etapa_sdr) — funil de prospecção e
// qualificação, separado do funil comercial do vendedor (etapa_comercial).
// QUALIFICADO é o sinal para a fila de distribuição da supervisão
// (GET /leads/prontos-para-distribuir já filtra por essa etapa).
export const ETAPAS_SDR = ['NOVO_LEAD', 'PRIMEIRO_CONTATO', 'EM_QUALIFICACAO', 'QUALIFICADO'] as const;
export type EtapaSdr = typeof ETAPAS_SDR[number];
