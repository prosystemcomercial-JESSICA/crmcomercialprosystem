import { FastifyRequest } from 'fastify';

/**
 * Controle de ESCOPO de dados por papel (data-scope / row-level security).
 *
 * Regra de negócio (definida com o cliente):
 *   - CEO, ADMIN e SUPERVISAO_COMERCIAL enxergam TUDO (todos os vendedores,
 *     KPIs e projeções) — são os papéis de gestão comercial.
 *   - Todos os demais papéis (em especial VENDEDOR) só enxergam o que é seu:
 *     leads, propostas, atividades/agenda, metas, contratos que ele mesmo
 *     criou ou pelos quais é responsável.
 *
 * Como um vendedor é "dono" de um registro varia por tabela. As colunas estão
 * mapeadas em OWNER_COLUMNS. O escopo é sempre pelo ID do usuário logado
 * (request.user.id), nunca por nome (frágil).
 */

export interface AuthUserLike {
  id: string;
  nome?: string;
  email?: string;
  role?: string;
}

/** Papéis com visão total dos dados comerciais (gestão: vê todos os vendedores).
 *  Match EXATO (não substring) — para não confundir SUPERVISAO_TECNICA com a comercial. */
const ROLES_VISAO_TOTAL = ['CEO', 'DIRETOR', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO'];

/** Lê o usuário populado pelo hook global de auth opcional (server.ts). */
export function getUser(request: FastifyRequest): AuthUserLike | undefined {
  return (request as any).user as AuthUserLike | undefined;
}

/**
 * true  → usuário vê TUDO (gestor comercial / CEO / admin).
 * false → usuário restrito ao próprio dado (vendedor e demais).
 *
 * Inclui o ADMIN do sistema (conta mock fora do banco) por e-mail/role.
 */
export function podeVerTudo(user?: AuthUserLike): boolean {
  if (!user) return false;
  const role = (user.role || '').toUpperCase();
  // Match exato: SUPERVISAO_TECNICA NÃO é gestão comercial.
  return ROLES_VISAO_TOTAL.includes(role);
}

/**
 * Retorna o ID pelo qual filtrar os dados do vendedor, ou null quando o
 * usuário tem visão total (sem filtro). Use em conjunto com ownerWhere/ownerSql.
 *
 * Se não houver usuário autenticado, por segurança devolve um id impossível
 * ('__no_user__') para NÃO vazar dados de todos — comportamento fail-closed.
 */
export function scopeUserId(request: FastifyRequest): string | null {
  const user = getUser(request);
  if (podeVerTudo(user)) return null;       // gestor → vê tudo
  return user?.id || '__no_user__';          // vendedor (ou anônimo) → só o próprio / nada
}

/**
 * Escopo EFETIVO considerando um filtro opcional por vendedor (só p/ gestor).
 *   - Vendedor (não-gestor): sempre o próprio id (ignora o filtro).
 *   - Gestor SEM filtro: null (vê tudo).
 *   - Gestor COM filtro (vendedor_id): aquele vendedor (vê "pelos olhos dele").
 */
export function effectiveScopeId(request: FastifyRequest, filtroVendedorId?: string | null): string | null {
  const base = scopeUserId(request);          // null = gestor; id = vendedor
  if (base !== null) return base;             // vendedor: ignora filtro
  const f = (filtroVendedorId || '').trim();
  return f ? f : null;                        // gestor: aplica o filtro escolhido (ou nada)
}

/** ownerWhere a partir de um id já resolvido (use com effectiveScopeId).
 *  Excluídos (soft-delete) saem SEMPRE dos resultados — inclusive para gestor. */
export function ownerWhereId(table: keyof typeof OWNER_COLUMNS | string, id: string | null): Record<string, any> {
  const softDelete = table === 'Lead' ? { deleted_at: null } : {};
  if (id === null) return { ...softDelete };
  const cols = OWNER_COLUMNS[table as string] || ['created_by'];
  if (cols.length === 1) return { ...softDelete, [cols[0]]: id };
  return { ...softDelete, OR: cols.map(c => ({ [c]: id })) };
}

/** ownerSql a partir de um id já resolvido (use com effectiveScopeId). */
export function ownerSqlId(table: keyof typeof OWNER_COLUMNS | string, id: string | null, alias = ''): { clause: string; params: string[] } {
  if (id === null) return { clause: '', params: [] };
  const cols = OWNER_COLUMNS[table as string] || ['created_by'];
  const prefix = alias ? `${alias}.` : '';
  const conds = cols.map(c => `${prefix}${c} = ?`).join(' OR ');
  return { clause: ` AND (${conds})`, params: cols.map(() => id) };
}

/**
 * Guard de rota: só gestão comercial (CEO/ADMIN/SUPERVISAO_COMERCIAL) passa.
 * Use no início de rotas de importação/escrita restrita a supervisão.
 * Retorna true se ok; se não, já envia 403 e retorna false.
 *
 *   if (!requireGestor(request, reply)) return;
 */
export function requireGestor(request: FastifyRequest, reply: any): boolean {
  if (podeVerTudo(getUser(request))) return true;
  reply.status(403).send({ status: 'error', message: 'Ação restrita à Supervisão Comercial' });
  return false;
}

/**
 * Colunas que identificam o "dono" (vendedor) em cada tabela.
 * Quando há mais de uma, o registro é do vendedor se QUALQUER uma bater (OR).
 */
export const OWNER_COLUMNS: Record<string, string[]> = {
  Lead:              ['responsavel_id', 'created_by'],
  Atividade:         ['responsavel_id', 'created_by'],
  Proposta:          ['created_by'],
  PropostaComercial: ['vendedor_id', 'created_by'],
  Contrato:          ['created_by'],
  ContratoComercial: ['created_by'],
  Meta:              ['responsavel_id', 'created_by'],
  VendaAdicional:    ['vendedor_id', 'created_by'],
};

/**
 * Monta um fragmento de `where` do Prisma para restringir ao dono.
 * Retorna {} quando o usuário vê tudo (nenhum filtro aplicado).
 *
 *   const where = { ...filtrosBase, ...ownerWhere(request, 'Lead') };
 */
export function ownerWhere(request: FastifyRequest, table: keyof typeof OWNER_COLUMNS | string): Record<string, any> {
  // Registros com exclusão lógica saem de TODOS os resultados (inclusive p/ gestor).
  const softDelete = table === 'Lead' ? { deleted_at: null } : {};
  const id = scopeUserId(request);
  if (id === null) return { ...softDelete };           // gestor → sem filtro de dono, mas sem excluídos
  const cols = OWNER_COLUMNS[table as string] || ['created_by'];
  if (cols.length === 1) return { ...softDelete, [cols[0]]: id };
  return { ...softDelete, OR: cols.map(c => ({ [c]: id })) };
}

/**
 * Monta uma cláusula SQL (para $queryRawUnsafe) restringindo ao dono.
 * Retorna { clause, params } onde clause já vem pronta para concatenar:
 *   - gestor:   clause = '' (sem filtro)
 *   - vendedor: clause = ' AND (alias.col1 = ? OR alias.col2 = ?)'
 *
 *   const sc = ownerSql(request, 'Lead', 'l');
 *   await prisma.$queryRawUnsafe(`... WHERE 1=1 ${sc.clause} ...`, ...sc.params);
 */
export function ownerSql(
  request: FastifyRequest,
  table: keyof typeof OWNER_COLUMNS | string,
  alias = ''
): { clause: string; params: string[] } {
  const id = scopeUserId(request);
  if (id === null) return { clause: '', params: [] };
  const cols = OWNER_COLUMNS[table as string] || ['created_by'];
  const prefix = alias ? `${alias}.` : '';
  const conds = cols.map(c => `${prefix}${c} = ?`).join(' OR ');
  return { clause: ` AND (${conds})`, params: cols.map(() => id) };
}

/**
 * Visibilidade de QuadroComercial (feature separada do escopo de leads acima).
 * Um quadro PRIVADO só é visível para: quem tem visão total (gestor), o dono
 * (dono_id) e quem está em QuadroCompartilhamento. PUBLICO é visível a todos
 * os autenticados. Tudo-ou-nada: ver o quadro dá acesso a todos os leads nele
 * (a restrição por dono do LEAD em si continua via ownerWhere).
 */
export function podeVerQuadro(
  user: AuthUserLike | undefined,
  quadro: { visibilidade?: string | null; dono_id?: string | null },
  compartilhadoIds: string[]
): boolean {
  if (podeVerTudo(user)) return true;
  if ((quadro.visibilidade || 'PRIVADO') === 'PUBLICO') return true;
  if (!user) return false;
  if (quadro.dono_id && quadro.dono_id === user.id) return true;
  return compartilhadoIds.includes(user.id);
}
