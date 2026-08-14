// Etapas de fechamento que um SDR não pode atribuir a um lead — fechamento é
// sempre ação do vendedor/closer. SDR qualifica até QUALIFICADO e a supervisão
// distribui o lead para um vendedor fechar (ver rota /leads/:id/distribuir).
export const ETAPAS_BLOQUEADAS_PARA_SDR = ['ACEITO', 'FECHADO', 'CONTRATO_ASSINADO', 'CONTRATO_EM_ANDAMENTO'];

export function bloqueadoParaFecharSeSDR(role: string | undefined, etapaAlvo: string | undefined | null): boolean {
  if ((role || '').toUpperCase() !== 'SDR') return false;
  if (!etapaAlvo) return false;
  return ETAPAS_BLOQUEADAS_PARA_SDR.includes(etapaAlvo);
}
