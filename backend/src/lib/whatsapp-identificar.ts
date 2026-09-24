// "Identificar" do Inbox: o que fazer com a conversa conforme o tipo do contato.
// Puro — a rota executa. Só LEAD fica no funil; os demais tiram o lead (captado
// automaticamente) do funil para manter a Central de Leads limpa.

export const TIPOS_CONTATO = ['CLIENTE', 'LEAD', 'PARCEIRO', 'EQUIPE', 'TERCEIRO_CLIENTE', 'FORNECEDOR', 'OUTRO'] as const;
export type TipoContato = typeof TIPOS_CONTATO[number];

export const ETIQUETA_TIPO: Record<TipoContato, { etiqueta: string; cor: string }> = {
  CLIENTE: { etiqueta: 'Cliente', cor: '#0891b2' },
  LEAD: { etiqueta: 'Lead', cor: '#7c3aed' },
  PARCEIRO: { etiqueta: 'Parceiro', cor: '#db2777' },
  EQUIPE: { etiqueta: 'Equipe Prosystem', cor: '#475569' },
  TERCEIRO_CLIENTE: { etiqueta: 'Terceiro de cliente', cor: '#0d9488' },
  FORNECEDOR: { etiqueta: 'Fornecedor', cor: '#ca8a04' },
  OUTRO: { etiqueta: 'Outro', cor: '#6b7280' },
};

export type DecisaoIdentificar = {
  /** Vincula a conversa ao cliente e salva o contato na ficha dele. */
  vincularCliente: boolean;
  /** Tira do funil (lead_id = null, soft-delete só de lead WHATSAPP, robô desligado). */
  sairDoFunil: boolean;
  /** Garante um lead no funil (cria se a conversa não tem). */
  garantirLead: boolean;
  /** Grava a empresa informada na conversa. */
  salvarEmpresa: boolean;
  etiqueta: string;
  etiqueta_cor: string;
};

export function decidirIdentificacao(tipo: TipoContato, entrada: { cliente_id?: string | null }): DecisaoIdentificar | { erro: string } {
  const precisaCliente = tipo === 'CLIENTE' || tipo === 'TERCEIRO_CLIENTE';
  if (precisaCliente && !entrada.cliente_id) return { erro: 'Selecione o cliente.' };
  const { etiqueta, cor } = ETIQUETA_TIPO[tipo];
  return {
    vincularCliente: precisaCliente,
    sairDoFunil: tipo !== 'LEAD',
    garantirLead: tipo === 'LEAD',
    salvarEmpresa: tipo === 'PARCEIRO' || tipo === 'FORNECEDOR' || tipo === 'EQUIPE' || tipo === 'OUTRO',
    etiqueta, etiqueta_cor: cor,
  };
}
