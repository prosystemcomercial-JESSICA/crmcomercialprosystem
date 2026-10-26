// Casos de churn: situação do pedido do cliente e retorno marcado (pedido da Jessica, 26/10/2026).
// Regras puras, sem banco: usadas pelo serviço, pelo aviso agendado e pelos alertas do sino.

export const SITUACOES_PEDIDO = ['OBSERVACAO', 'CANCELAMENTO'] as const;
export type SituacaoPedido = (typeof SITUACOES_PEDIDO)[number];

export const ROTULO_SITUACAO: Record<SituacaoPedido, string> = {
  OBSERVACAO: 'Em observação',
  CANCELAMENTO: 'Pediu cancelamento',
};

export const TIPOS_RETORNO = ['CONTATO', 'ATIVIDADE', 'ACAO'] as const;
export type TipoRetorno = (typeof TIPOS_RETORNO)[number];

export const ROTULO_RETORNO: Record<TipoRetorno, string> = {
  CONTATO: 'Contato',
  ATIVIDADE: 'Atividade',
  ACAO: 'Ação',
};

export type RetornoCaso = {
  retorno_em?: Date | string | null;
  retorno_tipo?: string | null;
  retorno_obs?: string | null;
  retorno_responsavel_id?: string | null;
  retorno_responsavel_nome?: string | null;
  retorno_marcado_por?: string | null;
  retorno_avisado_em?: Date | string | null;
};

const diaBrasilia = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

/** VENCIDO: a hora já passou · HOJE: ainda hoje (horário de Brasília) · FUTURO · null sem retorno. */
export function estadoRetorno(c: RetornoCaso, agora = new Date()): 'VENCIDO' | 'HOJE' | 'FUTURO' | null {
  if (!c.retorno_em) return null;
  const em = new Date(c.retorno_em);
  if (em.getTime() <= agora.getTime()) return 'VENCIDO';
  return diaBrasilia(em) === diaBrasilia(agora) ? 'HOJE' : 'FUTURO';
}

/** O aviso sai uma vez, quando a hora marcada chega. Remarcar zera o aviso. */
export function deveAvisarRetorno(c: RetornoCaso, agora = new Date()): boolean {
  return estadoRetorno(c, agora) === 'VENCIDO' && !c.retorno_avisado_em;
}

/** Quem recebe o aviso: o responsável e quem marcou (sem repetir). Sem responsável, quem marcou. */
export function destinatariosRetorno(c: RetornoCaso): string[] {
  return [...new Set([c.retorno_responsavel_id, c.retorno_marcado_por].filter((x): x is string => !!x))];
}

export function quandoRetornoTexto(em: Date | string): string {
  const d = new Date(em);
  const dia = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  return `${dia} às ${hora}`;
}

export function textoRetorno(c: RetornoCaso): string {
  const tipo = ROTULO_RETORNO[c.retorno_tipo as TipoRetorno] || 'Retorno';
  const partes = [`${tipo} marcado para ${c.retorno_em ? quandoRetornoTexto(c.retorno_em) : '—'}`];
  if (c.retorno_responsavel_nome) partes.push(`com ${c.retorno_responsavel_nome}`);
  return partes.join(' ') + (c.retorno_obs?.trim() ? `: ${c.retorno_obs.trim()}` : '');
}
