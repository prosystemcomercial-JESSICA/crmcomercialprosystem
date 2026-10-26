// Status dos casos de churn, num lugar só (antes cada tela repetia a lista e esquecia alguns).
// FINALIZADO (pedido da Jessica, 26/10/2026): caso totalmente resolvido, depois da exclusão do cadastro.

export const STATUS_CASO = ['NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO', 'RECUPERADO', 'PERDIDO', 'SISTEMA_REMOVIDO', 'AGUARDANDO_EXCLUSAO', 'FINALIZADO'] as const;

/** Cliente saiu: contam como perda nos gráficos, no relatório e no painel do CEO. */
export const STATUS_PERDA = ['PERDIDO', 'SISTEMA_REMOVIDO', 'AGUARDANDO_EXCLUSAO', 'FINALIZADO'];

/** Caso fechado (recuperado ou perdido): não está mais em tratamento. */
export const STATUS_ENCERRADO = ['RECUPERADO', ...STATUS_PERDA];
