import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { podeVerTudo, getUser } from '@/lib/scope';

// MySQL via $queryRawUnsafe devolve BigInt em COUNT/SUM.
// Helper que converte com segurança em number para aritmética.
const num = (v: any): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'bigint') return Number(v);
  return Number(v) || 0;
};

export async function dashboardPowerRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Helper para serializar BigInt com segurança em qualquer nível da resposta
  const safeJson = (data: any) =>
    JSON.parse(JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));

  fastify.get('/dashboard/power', async (request, reply) => {
    try {
    // Painel executivo (MRR, contratos, renovações, projeções) — só gestão comercial.
    // O vendedor não acessa: é "dado apenas para supervisão".
    if (!podeVerTudo(getUser(request))) {
      return reply.status(403).send({ status: 'error', message: 'Painel executivo restrito a Supervisão e CEO' });
    }
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
      // Perdidos
      leads_perdidos_mes, leads_perdidos_mes_anterior,
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
      // Perdidos este mês (via LeadPerda — registra o momento real da perda)
      prisma.$queryRawUnsafe(`SELECT COUNT(*) as n FROM LeadPerda WHERE created_at >= ?`, inicioMes).then((r: any) => num(r[0]?.n)).catch(() => 0),
      prisma.$queryRawUnsafe(`SELECT COUNT(*) as n FROM LeadPerda WHERE created_at >= ? AND created_at <= ?`, inicioMesAnterior, fimMesAnterior).then((r: any) => num(r[0]?.n)).catch(() => 0),

      prisma.contrato.count({ where: { status: 'ATIVO', deleted_at: null } }),
      prisma.contrato.count({ where: { status: 'ATIVO', deleted_at: null, created_at: { gte: inicioMes } } }),

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

    // PropostaComercial — pipeline breakdown por status/temperatura
    const pipeline_propostas_raw: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        status,
        COUNT(*) AS count,
        COALESCE(SUM(valor_final), 0) AS setup_total,
        COALESCE(SUM(
          CASE
            WHEN plano_selecionado = 'PLUS' THEN COALESCE(mensalidade_plus, 0)
            WHEN plano_selecionado = 'PRO'  THEN COALESCE(mensalidade_pro,  0)
            ELSE COALESCE(mensalidade_plus, COALESCE(mensalidade_pro, 0))
          END
        ), 0) AS mrr_total
      FROM PropostaComercial
      GROUP BY status
    `).catch(() => []);

    const ppBucket = (statuses: string[]) => {
      const rows = pipeline_propostas_raw.filter(r => statuses.includes(r.status));
      return {
        count: rows.reduce((s, r) => s + num(r.count), 0),
        mrr:   Math.round(rows.reduce((s, r) => s + num(r.mrr_total), 0)),
        setup: Math.round(rows.reduce((s, r) => s + num(r.setup_total), 0)),
      };
    };

    const propostas_total_count = pipeline_propostas_raw.reduce((s, r) => s + num(r.count), 0);
    const pipeline_propostas = {
      total:   propostas_total_count,
      fechado: ppBucket(['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO']),
      quente:  ppBucket(['EM_NEGOCIACAO']),
      morno:   ppBucket(['ENVIADA']),
      frio:    ppBucket(['RASCUNHO']),
      perdido: { count: pipeline_propostas_raw.filter(r => ['RECUSADA','PERDIDA'].includes(r.status)).reduce((s,r)=>s+num(r.count),0) },
    };

    // MRR dos contratos ativos
    const mrr_result = await prisma.contrato.aggregate({
      where: { status: 'ATIVO', deleted_at: null },
      _sum: { valor: true }
    });

    // MRR mês anterior
    const mrr_anterior = await prisma.contrato.aggregate({
      where: { status: 'ATIVO', deleted_at: null, created_at: { lte: fimMesAnterior } },
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

    // Valor total perdido no mês
    const valor_perdido_mes_result: any[] = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(valor_oportunidade),0) as total FROM LeadPerda WHERE created_at >= ?`, inicioMes
    ).catch(() => [{ total: 0 }]);
    const valor_perdido_mes = Math.round(num(valor_perdido_mes_result[0]?.total));

    // Ranking de motivos de perda (todos os tempos, top 8)
    const ranking_motivos_raw: any[] = await prisma.$queryRawUnsafe(
      `SELECT motivo, COUNT(*) as total, COALESCE(SUM(valor_oportunidade),0) as valor_total
       FROM LeadPerda
       WHERE motivo IS NOT NULL
       GROUP BY motivo
       ORDER BY total DESC
       LIMIT 8`
    ).catch(() => []);
    const total_perdas = ranking_motivos_raw.reduce((s, r) => s + num(r.total), 0);
    const ranking_motivos = ranking_motivos_raw.map(r => ({
      motivo: r.motivo,
      total: num(r.total),
      valor_total: Math.round(num(r.valor_total)),
      pct: total_perdas > 0 ? Math.round((num(r.total) / total_perdas) * 100) : 0
    }));

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

    const responseData = safeJson({
      kpis: {
        mrr: Math.round(mrr_atual),
        mrr_delta,
        leads_mes,
        leads_ganhos_mes,
        leads_ganhos_mes_anterior,
        leads_perdidos_mes: Number(leads_perdidos_mes),
        leads_perdidos_mes_anterior: Number(leads_perdidos_mes_anterior),
        valor_perdido_mes,
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
      ranking_motivos_perda: ranking_motivos,
      pipeline_funil,
      top_leads: top_leads.map(l => ({
        ...l,
        valor_ponderado: Math.round((l.valor_estimado || 0) * ((l.probabilidade || 50) / 100))
      })),
      pipeline_propostas,
      agenda_hoje: atividades_hoje_lista,
      atividades_atrasadas: atividades_atrasadas_lista,
      alertas: {
        atividades_atrasadas,
        atividades_hoje,
        tickets_criticos,
        renovacoes_criticas,
        hs_em_risco: hs_criticos + hs_risco
      }
    });

    return reply.send({ status: 'success', data: responseData });

    } catch (err: any) {
      fastify.log.error({ err, url: '/dashboard/power' }, 'DASHBOARD_POWER_ERROR');
      return reply.status(500).send({
        status: 'error',
        message: `Erro no dashboard: ${err?.message || 'desconhecido'}`,
        code: err?.code || null
      });
    }
  });
}
