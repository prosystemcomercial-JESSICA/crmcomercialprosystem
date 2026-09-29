import type { PrismaClient } from '@prisma/client';

// Etapa do lead na Central de Leads acompanha o que acontece de verdade (agentes, demonstração,
// proposta). Só AVANÇA: nunca volta de coluna, nunca mexe em Fechado/Perdido/Aceito nem em
// colunas personalizadas de quadros. Cada avanço fica registrado no histórico do lead.

const ORDEM: Record<string, number> = {
  NOVO_LEAD: 0, PRIMEIRO_CONTATO: 1, EM_ATENDIMENTO: 2, QUALIFICADO: 3, AGUARDANDO_RETORNO: 3,
  PROPOSTA_A_GERAR: 4, PROPOSTA_ENVIADA: 5, EM_NEGOCIACAO: 6,
};
const NOME: Record<string, string> = {
  PRIMEIRO_CONTATO: 'Primeiro Contato', EM_ATENDIMENTO: 'Em Atendimento', QUALIFICADO: 'Qualificado',
  PROPOSTA_ENVIADA: 'Proposta Enviada', EM_NEGOCIACAO: 'Em Negociação',
};
export type EtapaAuto = 'PRIMEIRO_CONTATO' | 'EM_ATENDIMENTO' | 'QUALIFICADO' | 'PROPOSTA_ENVIADA' | 'EM_NEGOCIACAO';

/** Decide se deve mover (puro, testável). */
export function deveAvancar(atual: string | null | undefined, alvo: EtapaAuto): boolean {
  const a = ORDEM[atual || 'NOVO_LEAD'];
  if (a === undefined) return false; // etapa final ou coluna personalizada: não mexe
  return ORDEM[alvo] > a;
}

/** Avança a etapa do lead, se fizer sentido. Nunca lança. */
export async function avancarEtapaLead(prisma: PrismaClient, leadId: string | null | undefined, alvo: EtapaAuto, motivo: string, quem = 'Sistema'): Promise<boolean> {
  if (!leadId) return false;
  try {
    const l = await prisma.lead.findUnique({ where: { id: leadId }, select: { etapa_comercial: true, deleted_at: true, status: true } });
    if (!l || l.deleted_at || ['GANHO', 'PERDIDO'].includes(String(l.status)) || !deveAvancar(l.etapa_comercial, alvo)) return false;
    await prisma.lead.update({ where: { id: leadId }, data: { etapa_comercial: alvo } });
    await prisma.leadObservacao.create({ data: { lead_id: leadId, tipo: 'SISTEMA', descricao: `➡️ Avançou para "${NOME[alvo]}": ${motivo}.`, created_by: 'bot', created_by_name: quem } }).catch(() => {});
    return true;
  } catch { return false; }
}
