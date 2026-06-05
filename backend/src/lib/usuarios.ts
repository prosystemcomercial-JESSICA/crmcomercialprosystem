import { PrismaClient } from '@prisma/client';

/**
 * Contas de SISTEMA (login mock, fora da tabela UsuarioCRM) que também atuam como
 * vendedoras/responsáveis por vendas. Ex.: a conta da Jessica (CEO/Diretora) que
 * também vende — as vendas/contratos que ela lança devem aparecer com o nome dela
 * e gerar comissão como qualquer vendedor.
 *
 * Mantém sincronizado com os mockUsers de routes/auth.ts.
 */
export const CONTAS_SISTEMA: Record<string, { nome: string; cargo: string }> = {
  'user-jessica': { nome: 'Jessica', cargo: 'DIRETOR' },
};

/**
 * Resolve os NOMES de um conjunto de ids de responsáveis, considerando tanto a
 * tabela UsuarioCRM quanto as contas de sistema. Retorna um mapa id → nome.
 */
export async function resolverNomesUsuarios(prisma: PrismaClient, ids: string[]): Promise<Record<string, string>> {
  const mapa: Record<string, string> = {};
  const limpos = [...new Set(ids.filter(Boolean))];
  if (!limpos.length) return mapa;

  // Contas de sistema primeiro (não estão no banco).
  for (const id of limpos) {
    if (CONTAS_SISTEMA[id]) mapa[id] = CONTAS_SISTEMA[id].nome;
  }

  const faltam = limpos.filter(id => !mapa[id]);
  if (faltam.length) {
    const us: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome FROM UsuarioCRM WHERE id IN (${faltam.map(() => '?').join(',')})`, ...faltam
    ).catch(() => []);
    us.forEach(u => { mapa[u.id] = u.nome; });
  }
  return mapa;
}
