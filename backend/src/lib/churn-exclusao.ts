// Envio de clientes de churn ao CEO para retirar o cadastro do suporte e suspender as cobranças
// (pedido da Jessica, 15/10/2026). Regras puras: quem pode ir, situação do pedido e texto do aviso.

/** Casos que podem ir para o CEO: só os perdidos (o cliente já saiu). */
export const STATUS_PODE_ENVIAR = ['PERDIDO', 'SISTEMA_REMOVIDO', 'AGUARDANDO_EXCLUSAO'];

/** A aba de exclusão também mostra os finalizados, para o histórico do pedido não sumir. */
export const STATUS_LISTA_EXCLUSAO = [...STATUS_PODE_ENVIAR, 'FINALIZADO'];

/** Quem envia e quem confirma (gestão comercial e diretoria). */
export const ROLES_EXCLUSAO = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL'];

/** Módulo da tela Usuários e Permissões que libera a seleção e o envio para outras pessoas. */
export const MODULO_CHURN = 'Cancelamentos / Churn';

/**
 * Pode selecionar e enviar ao CEO: a gestão (ROLES_EXCLUSAO) ou quem tem "administrar" no módulo
 * Cancelamentos / Churn (pedido da Jessica, 15/10/2026: liberar a Ana Clara). As confirmações
 * (suporte retirado / cobrança suspensa) continuam só com a gestão.
 */
export function podeSelecionarExclusao(role: string | null | undefined, modulos: unknown): boolean {
  if (ROLES_EXCLUSAO.includes(String(role || '').toUpperCase())) return true;
  let m: any = modulos;
  if (typeof m === 'string') { try { m = JSON.parse(m); } catch { m = null; } }
  return !!m?.[MODULO_CHURN]?.administrar;
}

/** Registro do pedido, guardado em ConfiguracaoIntegracao (`churn.exclusao.<casoId>`), sem mudar o banco. */
/** Como o pedido foi ao CEO: WhatsApp (lista + push) ou relatório em PDF (postado no Teams pela gestão). */
export type CanalExclusao = 'whatsapp' | 'pdf';

export interface RegistroExclusao {
  enviado_em: string;
  enviado_por: string;
  enviado_por_nome: string;
  observacao?: string | null;
  canal?: CanalExclusao;
  suporte_em?: string | null;
  suporte_por_nome?: string | null;
  cobranca_em?: string | null;
  cobranca_por_nome?: string | null;
}

export const chaveExclusao = (casoId: string) => `churn.exclusao.${casoId}`;

export type SituacaoExclusao = 'NAO_ENVIADO' | 'ENVIADO' | 'CONCLUIDO';

export function situacaoExclusao(r: RegistroExclusao | null | undefined): SituacaoExclusao {
  if (!r?.enviado_em) return 'NAO_ENVIADO';
  return r.suporte_em && r.cobranca_em ? 'CONCLUIDO' : 'ENVIADO';
}

/**
 * Status do caso depois de uma confirmação do CEO (pedido da Jessica, 26/10/2026): com suporte retirado e
 * cobrança suspensa, o caso vai para FINALIZADO (concluído de vez; as confirmações ficam travadas). null = não muda.
 */
export function statusAposConfirmacao(situacao: SituacaoExclusao, statusAtual: string): string | null {
  return situacao === 'CONCLUIDO' && STATUS_PODE_ENVIAR.includes(statusAtual) ? 'FINALIZADO' : null;
}

export interface EtapaCancelamento { chave: string; rotulo: string; em: string | null; por?: string | null; opcional?: boolean }

type Data = Date | string | null | undefined;

/**
 * Fluxograma do cancelamento (aba Exclusões › Concluídos): do caso aberto até o finalizado.
 * `opcional` = etapa que nem todo caso tem (sistema removido). Datas em ISO; null = não aconteceu.
 */
export function etapasDoCancelamento(
  caso: { created_at: Data; data_abertura_real?: Data; resolvido_em?: Data; sistema_removido_em?: Data; status: string },
  inativadoEm: Data,
  r: RegistroExclusao | null | undefined,
): EtapaCancelamento[] {
  const iso = (d: Data) => (d ? new Date(d).toISOString() : null);
  const ambos = r?.suporte_em && r?.cobranca_em ? (r.suporte_em > r.cobranca_em ? r.suporte_em : r.cobranca_em) : null;
  return [
    { chave: 'aberto', rotulo: 'Caso aberto', em: iso(caso.data_abertura_real || caso.created_at) },
    { chave: 'perdido', rotulo: 'Cliente perdido', em: iso(caso.resolvido_em || inativadoEm) },
    { chave: 'sistema', rotulo: 'Sistema removido', em: iso(caso.sistema_removido_em), opcional: true },
    { chave: 'enviado', rotulo: 'Enviado ao CEO', em: r?.enviado_em || null, por: r?.enviado_por_nome || null },
    { chave: 'suporte', rotulo: 'Retirado do suporte', em: r?.suporte_em || null, por: r?.suporte_por_nome || null },
    { chave: 'cobranca', rotulo: 'Cobrança suspensa', em: r?.cobranca_em || null, por: r?.cobranca_por_nome || null },
    { chave: 'finalizado', rotulo: 'Finalizado', em: caso.status === 'FINALIZADO' ? ambos : null },
  ];
}

export function lerRegistro(valor: string | null | undefined): RegistroExclusao | null {
  if (!valor) return null;
  try { const v = JSON.parse(valor); return v && typeof v === 'object' && v.enviado_em ? v : null; } catch { return null; }
}

export interface ItemAviso {
  codigo?: string | null;
  nome: string;
  cnpj?: string | null;
  mensalidade?: number | null;
  valor_devido?: number | null;
  motivo?: string | null;
}

const real = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cnpjFmt = (c: string) => { const d = c.replace(/\D/g, ''); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c; };

/** Mensagem de WhatsApp para o CEO com a lista do lote (no máximo 25 linhas; o resto fica no CRM). */
export function textoAvisoCeo(itens: ItemAviso[], quem: string, observacao: string | null | undefined, link: string): string {
  const linhas = itens.slice(0, 25).map(i => {
    const partes = [`${i.codigo ? `${i.codigo} · ` : ''}${i.nome}`];
    if (i.cnpj) partes.push(`CNPJ ${cnpjFmt(i.cnpj)}`);
    if (i.mensalidade) partes.push(`${real(i.mensalidade)}/mês`);
    if (i.valor_devido) partes.push(`deve ${real(i.valor_devido)}`);
    return `• ${partes.join(' · ')}${i.motivo ? `\n   Motivo: ${i.motivo.replace(/\s+/g, ' ').slice(0, 120)}` : ''}`;
  });
  const resto = itens.length > 25 ? `\n…e mais ${itens.length - 25} no CRM.` : '';
  const total = itens.reduce((t, i) => t + (i.mensalidade || 0), 0);
  return [
    `📤 *Churn: ${itens.length === 1 ? '1 cliente' : `${itens.length} clientes`} para retirar do suporte e suspender as cobranças*`,
    `Enviado por ${quem}.${total ? ` Mensalidades somadas: ${real(total)}.` : ''}`,
    '',
    linhas.join('\n') + resto,
    ...(observacao?.trim() ? ['', `Observação: ${observacao.trim()}`] : []),
    '',
    `Quando retirar do suporte e suspender a cobrança, marque no CRM: ${link}`,
  ].join('\n');
}
