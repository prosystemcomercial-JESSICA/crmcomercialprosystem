export interface LeadCriadoSdr {
  id: string;
  nome: string;
  razao_social?: string;
  origem: string;
  temperatura: string;
  etapa_sdr: string | null;
  created_at: string;
  [chave: string]: unknown;
}

interface CadastrarLeadSdrDeps {
  formulario: Record<string, unknown>;
  criar: (payload: Record<string, unknown>) => Promise<{ data?: { data?: LeadCriadoSdr } | LeadCriadoSdr }>;
  recarregar: () => Promise<unknown>;
}

/**
 * Persiste o lead e dispara a reconciliação do funil sem prender o sucesso do
 * cadastro a uma segunda requisição de rede.
 */
export async function cadastrarLeadSdr({ formulario, criar, recarregar }: CadastrarLeadSdrDeps): Promise<LeadCriadoSdr> {
  const payload = { ...formulario };
  if (!payload.nome) payload.nome = payload.razao_social || 'Lead';
  if (!payload.origem) payload.origem = 'MANUAL';

  const resposta = await criar(payload);
  const envelope = resposta.data;
  const lead = (
    envelope && typeof envelope === 'object' && 'data' in envelope
      ? (envelope as { data?: LeadCriadoSdr }).data
      : envelope
  ) as LeadCriadoSdr | undefined;
  if (!lead?.id) throw new Error('A API não retornou o lead cadastrado.');

  void recarregar().catch((erro) => {
    console.error('Lead criado, mas não foi possível atualizar o funil:', erro);
  });

  return lead;
}
