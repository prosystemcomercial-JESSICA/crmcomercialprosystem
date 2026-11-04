// Lembrete pelo WhatsApp ao RESPONSÁVEL de atividades de marketing (pedido da Jessica, 04/11/2026:
// "coloque essas postagens como atividade para mim e me lembre no WhatsApp para que eu possa postar").
// Regras puras: quem entra no lembrete, em que janela e o texto da mensagem.

export const ANTECEDENCIA_LEMBRETE_MIN = 60; // avisa 1 h antes do horário da atividade
export const TOLERANCIA_ATRASO_MIN = 30;     // servidor parado: ainda avisa até 30 min depois do horário

/** Janela de data_prevista que entra na rodada de agora. */
export function janelaLembrete(agora: Date) {
  return {
    gt: new Date(agora.getTime() - TOLERANCIA_ATRASO_MIN * 60000),
    lte: new Date(agora.getTime() + ANTECEDENCIA_LEMBRETE_MIN * 60000),
  };
}

export function textoLembreteAtividade(a: { titulo: string; descricao?: string | null; data_prevista: Date; link_externo?: string | null }): string {
  const hora = a.data_prevista.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  const desc = (a.descricao || '').trim();
  return [
    `⏰ *Lembrete: ${a.titulo}* às ${hora}`,
    desc ? desc.slice(0, 1200) : null,
    a.link_externo && !desc.includes(a.link_externo) ? `🔗 ${a.link_externo}` : null,
    'Quando terminar, marque a atividade como realizada no CRM.',
  ].filter(Boolean).join('\n\n');
}
