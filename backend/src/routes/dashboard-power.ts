import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export async function dashboardPowerRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  fastify.get('/dashboard/power', async (request, reply) => {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const fimMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const seteAtras = new Date(now); seteAtras.setDate(now.getDate() - 7);
    const trintaAtras = new Date(now); trintaAtras.setDate(now.getDate() - 30);
    const hoje_inicio = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hoje_fim = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const [
      // Comercial
      leads_total, leads_mes, leads_ganhos_mes, leads_ganhos_mes_anterior,
      // Contratos / MRR
      contratos_ativos, contratos_mes,
      // Propostas
      propostas_abertas, propostas_aceitas_mes,
      // Atividades
      atividades_hoje, atividades_atrasadas,
      // Tickets
      tickets_abertos, tickets_criticos,
      // Renovações
      renovacoes_criticas,
      // Health Score
      hs_criticos, hs_risco,
      // Pipeline
      pipeline_data,
      // Top leads
      top_leads
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { created_at: { gte: inicioMes } } }),
      prisma.lead.count({ where: { status: 'GANHO', updated_at: { gte: inicioMes } } }),
      prisma.lead.count({ where: { status: 'GANHO', updated_at: { gte: inicioMesAnterior, lte: fimMesAnterior } } }),

      prisma.contrato.count({ where: { status: 'ATIVO' } }),
      prisma.contrato.count({ where: { status: 'ATIVO', created_at: { gte: inicioMes } } }),

      prisma.proposta.count({ where: { status: { in: ['ENVIADA', 'VISUALIZADA'] } } }),
      prisma.proposta.count({ where: { status: 'ACEITA', updated_at: { gte: inicioMes } } }),

      prisma.atividade.count({ where: { status: 'PENDENTE', data_prevista: { gte: hoje_inicio, lt: hoje_fim } } }),
      prisma.atividade.count({ where: { status: 'PENDENTE', data_prevista: { lt: now } } }),

      prisma.ticketSuporte.count({ where: { status: { in: ['ABERTO', 'EM_ATENDIMENTO'] } } }),
      prisma.ticketSuporte.count({ where: { status: { in: ['ABERTO', 'EM_ATENDIMENTO'] }, prioridade: 'CRITICA' } }),

      prisma.renovacao.count({
        where: {
          status: { in: ['PENDENTE', 'EM_NEGOCIACAO'] },
          data_vencimento: { lt: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000) }
        }
      }),

      prisma.healthScore.count({ where: { nivel: 'CRITICO' } }),
      prisma.healthScore.count({ where: { nivel: 'RISCO' } }),

      // Pipeline por etapa
      prisma.lead.groupBy({
        by: ['etapa_funil'],
        where: { status: { notIn: ['GANHO', 'PERDIDO'] } },
        _count: { id: true },
        _sum: { valor_estimado: true }
      }),

      // Top leads por valor ponderado
      prisma.lead.findMany({
        where: {
          status: { notIn: ['GANHO', 'PERDIDO', 'NUTRICAO'] },
          valor_estimado: { gt: 0 }
        },
        orderBy: { valor_estimado: 'desc' },
        take: 5,
        select: {
          id: true, nome: true, empresa: true,
          valor_estimado: true, probabilidade: true,
          etapa_funil: true, temperatura: true
        }
      })
    ]);

    // MRR dos contratos ativos
    const mrr_result = await prisma.contrato.aggregate({
      where: { status: 'ATIVO' },
      _sum: { valor: true }
    });

    // MRR mês anterior
    const mrr_anterior = await prisma.contrato.aggregate({
      where: { status: 'ATIVO', created_at: { lte: fimMesAnterior } },
      _sum: { valor: true }
    });

    // Pipeline valor total
    const pipeline_valor = pipeline_data.reduce((s, p) => s + (p._sum.valor_estimado || 0), 0);

    // Atividades atrasadas (detalhes)
    const atividades_atrasadas_lista = await prisma.atividade.findMany({
      where: { status: 'PENDENTE', data_prevista: { lt: now } },
      include: { lead: { select: { nome: true, empresa: true } } },
      orderBy: { data_prevista: 'asc' },
      take: 5
    });

    // Atividades hoje (detalhes)
    const atividades_hoje_lista = await prisma.atividade.findMany({
      where: { status: 'PENDENTE', data_prevista: { gte: hoje_inicio, lt: hoje_fim } },
      include: { lead: { select: { nome: true } } },
      orderBy: { data_prevista: 'asc' },
      take: 8
    });

    // NPS rápido
    const nps_total = await prisma.surveyResposta.count();
    const nps_promoters = await prisma.surveyResposta.count({ where: { q3_score: { gte: 9 } } });
    const nps_detractors = await prisma.surveyResposta.count({ where: { q3_score: { lte: 6 } } });
    const nps_score = nps_total > 0 ? Math.round(((nps_promoters - nps_detractors) / nps_total) * 100) : null;

    // Taxa de conversão
    const taxa_conversao = leads_total > 0 ? Math.round((leads_ganhos_mes / Math.max(leads_mes, 1)) * 100) : 0;

    // Delta MRR
    const mrr_atual = mrr_result._sum.valor || 0;
    const mrr_ant = mrr_anterior._sum.valor || 0;
    const mrr_delta = mrr_ant > 0 ? Math.round(((mrr_atual - mrr_ant) / mrr_ant) * 100) : 0;

    const ETAPA_ORDER = ['PROSPECCAO', 'QUALIFICACAO', 'APRESENTACAO', 'PROPOSTA', 'NEGOCIACAO', 'FECHAMENTO'];
    const pipeline_funil = ETAPA_ORDER.map(etapa => {
      const d = pipeline_data.find(p => p.etapa_funil === etapa);
      return {
        etapa,
        count: d?._count.id || 0,
        valor: Math.round(d?._sum.valor_estimado || 0)
      };
    });

    return reply.send({
      status: 'success',
      data: {
        kpis: {
          mrr: Math.round(mrr_atual),
          mrr_delta,
          leads_mes,
          leads_ganhos_mes,
          leads_ganhos_mes_anterior,
          taxa_conversao,
          contratos_ativos,
          contratos_mes,
          propostas_abertas,
          propostas_aceitas_mes,
          pipeline_valor: Math.round(pipeline_valor),
          tickets_abertos,
          tickets_criticos,
          renovacoes_criticas,
          hs_criticos,
          nps_score
        },
        pipeline_funil,
        top_leads: top_leads.map(l => ({
          ...l,
          valor_ponderado: Math.round((l.valor_estimado || 0) * ((l.probabilidade || 50) / 100))
        })),
        agenda_hoje: atividades_hoje_lista,
        atividades_atrasadas: atividades_atrasadas_lista,
        alertas: {
          atividades_atrasadas,
          atividades_hoje,
          tickets_criticos,
          renovacoes_criticas,
          hs_em_risco: hs_criticos + hs_risco
        }
      }
    });
  });
}
