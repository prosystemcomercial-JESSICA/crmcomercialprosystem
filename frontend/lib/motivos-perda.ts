// Motivos de perda/desqualificação do lead: tela de Leads e tela de WhatsApp.
// As chaves batem com MOTIVOS_PERDA do backend (lib/assistente/sdr.ts) + FORA_DO_PERFIL.
export const MOTIVOS_PERDA = [
  { value: 'PRECO', label: 'Preço' },
  { value: 'JA_TEM_FORNECEDOR', label: 'Já tem fornecedor' },
  { value: 'SEM_ORCAMENTO', label: 'Sem orçamento' },
  { value: 'TIMING', label: 'Timing não é agora' },
  { value: 'SEM_INTERESSE', label: 'Sem interesse' },
  { value: 'FUNCIONALIDADE_AUSENTE', label: 'Funcionalidade ausente' },
  { value: 'FORA_DO_PERFIL', label: 'Fora do perfil (segmento ou porte)' },
  { value: 'OUTRO', label: 'Outro' },
];
