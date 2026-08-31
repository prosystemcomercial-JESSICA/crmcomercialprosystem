// Extraído de health-score.ts para ser testável isoladamente. Correção de bug:
// a versão original usava `return` em vez de `continue` dentro do loop ao tratar
// clientes inativos, terminando a função inteira (sem responder) assim que o
// primeiro cliente inativo aparecia — não só pulando aquele cliente.

import { PrismaClient } from '@prisma/client';

export interface RankingTecnico {
  tecnico: string;
  total: number;
  ativos: number;
  inativos: number;
  em_risco: number;
  em_churn: number;
  saudaveis: number;
  mrr_ativo: number;
  mrr_perdido: number;
  indice_saude: number;
  taxa_churn: number;
}

export async function calcularRankingTecnicos(prisma: PrismaClient): Promise<RankingTecnico[]> {
  const clientes = await prisma.cliente.findMany({
    where: { grupo_tecnico: { not: null } },
    select: {
      id: true, grupo_tecnico: true, situacao: true, risco_atencao: true,
      mrr_perdido: true, mensalidade_base: true,
      health_score: { select: { nivel: true } },
      caso_churn: { where: { status: { in: ['NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO'] } }, select: { id: true } },
    },
  }).catch(() => [] as any[]);

  const mapa: Record<string, any> = {};
  for (const c of clientes) {
    const g = (c.grupo_tecnico || '').trim();
    if (!g || /comercial|inativ/i.test(g)) continue; // ignora "Grupo Comercial" e "Empresas inativas"
    if (!mapa[g]) mapa[g] = { tecnico: g, total: 0, ativos: 0, inativos: 0, em_risco: 0, em_churn: 0, saudaveis: 0, mrr_ativo: 0, mrr_perdido: 0 };
    const m = mapa[g];
    m.total += 1;
    const inativo = (c.situacao || '').toUpperCase().startsWith('INAT');
    if (inativo) {
      m.inativos += 1;
      m.mrr_perdido += Number(c.mrr_perdido || 0);
      continue; // CORRIGIDO: era `return`, terminava a rota inteira
    }
    m.ativos += 1;
    m.mrr_ativo += Number(c.mensalidade_base || 0);
    const emChurn = c.caso_churn.length > 0;
    const emRisco = c.risco_atencao || ['RISCO', 'CRITICO'].includes(c.health_score?.nivel || '');
    if (emChurn) m.em_churn += 1;
    else if (emRisco) m.em_risco += 1;
    else m.saudaveis += 1;
  }

  return Object.values(mapa).map((m: any) => {
    const baseAtivos = m.ativos || 1;
    // Índice de saúde: % de clientes ativos saudáveis (0-100). Quanto maior, melhor.
    const indice_saude = Math.round((m.saudaveis / baseAtivos) * 100);
    // Taxa de churn: % de inativos sobre o total da carteira.
    const taxa_churn = m.total ? Math.round((m.inativos / m.total) * 100) : 0;
    return { ...m, indice_saude, taxa_churn };
  }).sort((a, b) => b.indice_saude - a.indice_saude); // melhores carteiras primeiro
}
