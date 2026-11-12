/**
 * Resumo da nova demanda (contrato assinado) mandado no WhatsApp da equipe com o link do card do portal técnico.
 * Pedido da Jessica (12/11/2026): conversão de dados (de qual sistema), quantas máquinas, responsável,
 * contato do responsável e link do card.
 */
export type DadosNovaDemanda = {
  cliente: string;
  numeroContrato?: string | null;
  servico?: boolean; // demanda de serviço (não é implantação)
  conversao: boolean;
  sistemaAnterior?: string | null;
  maquinas?: number | null;
  responsavel?: string | null;
  contato?: string | null;
  tecnico?: string | null;
  link: string;
};

/** Telefone legível: (27) 99999-9999. Sem dígitos suficientes, devolve o texto como veio. */
export function telefoneLegivel(tel: string | null | undefined): string | null {
  const bruto = String(tel || '').trim();
  if (!bruto) return null;
  let d = bruto.replace(/\D/g, '');
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return bruto;
}

/** Máquinas da proposta: o campo direto ou a soma das lojas da proposta multi-loja. */
export function maquinasDaProposta(p: { maquinas?: number | null; lojas_projeto?: unknown } | null | undefined): number | null {
  if (!p) return null;
  if (typeof p.maquinas === 'number' && p.maquinas > 0) return p.maquinas;
  const lojas = Array.isArray(p.lojas_projeto) ? p.lojas_projeto : [];
  const soma = lojas.reduce((s: number, l: any) => s + (Number(l?.maquinas) > 0 ? Number(l.maquinas) : 0), 0);
  return soma > 0 ? soma : null;
}

export function textoNovaDemanda(d: DadosNovaDemanda): string {
  const nao = 'não informado';
  const conversao = d.servico ? 'não se aplica (serviço)'
    : d.conversao ? `Sim, do sistema *${(d.sistemaAnterior || '').trim() || nao}*` : 'Não (banco zerado)';
  return [
    '🆕 *Nova demanda: contrato assinado*',
    '',
    `*Cliente:* ${d.cliente}${d.numeroContrato ? ` (contrato ${d.numeroContrato})` : ''}`,
    `*Conversão de dados:* ${conversao}`,
    `*Máquinas:* ${d.maquinas && d.maquinas > 0 ? d.maquinas : nao}`,
    `*Responsável:* ${(d.responsavel || '').trim() || nao}`,
    `*Contato do responsável:* ${telefoneLegivel(d.contato) || nao}`,
    `*Técnico:* ${(d.tecnico || '').trim() || 'não designado'}`,
    '',
    `*Card no painel técnico:* ${d.link}`,
  ].join('\n');
}
