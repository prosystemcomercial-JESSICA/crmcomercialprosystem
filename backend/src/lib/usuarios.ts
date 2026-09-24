import { PrismaClient } from '@prisma/client';

/**
 * Resolve os NOMES de um conjunto de ids de responsáveis (tabela UsuarioCRM).
 * Retorna um mapa id → nome. (As antigas "contas de sistema" mock — CONTAS_SISTEMA
 * / 'user-jessica' — foram removidas na unificação de contas de set/2026.)
 */
export async function resolverNomesUsuarios(prisma: PrismaClient, ids: string[]): Promise<Record<string, string>> {
  const mapa: Record<string, string> = {};
  const limpos = [...new Set(ids.filter(Boolean))];
  if (!limpos.length) return mapa;

  const faltam = limpos;
  if (faltam.length) {
    const us: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome FROM UsuarioCRM WHERE id IN (${faltam.map(() => '?').join(',')})`, ...faltam
    ).catch(() => []);
    us.forEach(u => { mapa[u.id] = u.nome; });
  }
  return mapa;
}

/**
 * Resolve o usuário que deve receber comissão de SUPERVISÃO em vendas adicionais.
 * Prioriza cargos de supervisão dedicados (SUPERVISAO_COMERCIAL/SUPERVISAO_TECNICA);
 * na ausência deles, cai para ADMIN ativo — hoje a única conta de supervisão comercial
 * cadastrada com o cargo correto está INATIVA (duplicata antiga), e quem de fato
 * supervisiona está com cargo ADMIN. NUNCA usa o vendedor logado (esse foi o bug
 * original: supervisao_id = user?.id fazia o próprio vendedor "se auto-supervisionar").
 */
export async function resolverSupervisorComercial(prisma: PrismaClient): Promise<{ id: string; nome: string } | null> {
  // Supervisão COMERCIAL ativa primeiro (é o único cargo que criarComissaoValidada
  // aceita para papel SUPERVISAO) — após a unificação, a conta da Jessica.
  const comercial = await prisma.usuarioCRM.findFirst({
    where: { cargo: 'SUPERVISAO_COMERCIAL', status: 'ATIVO' },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  }).catch(() => null);
  if (comercial) return comercial;

  const porCargoSupervisao = await prisma.usuarioCRM.findFirst({
    where: { cargo: { in: ['SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA'] }, status: 'ATIVO' },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  }).catch(() => null);
  if (porCargoSupervisao) return porCargoSupervisao;

  return prisma.usuarioCRM.findFirst({
    where: { cargo: 'ADMIN', status: 'ATIVO' },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  }).catch(() => null);
}
