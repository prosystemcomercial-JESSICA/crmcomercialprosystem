import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { podeVerTudo, getUser, ownerWhereId, effectiveScopeId } from '@/lib/scope';

// MySQL via $queryRawUnsafe devolve BigInt em COUNT/SUM.
// Helper que converte com segurança em number para aritmética.
const num = (v: any): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'bigint') return Number(v);
  return Number(v) || 0;
};

const STATUS_FECHADA = ['CONTRATO_ASSINADO', 'ASSINADO', 'ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO'];

// Contratos ativos = ContratoComercial ASSINADO + PropostaComercial fechada que ainda
// NÃO gerou um ContratoComercial vinculado (não há relação Prisma nomeada entre os dois
// modelos, só o campo solto proposta_comercial_id — por isso a checagem via notIn).
// `desde` filtra por "fechado a partir de" (contratos: signed_at; propostas: data_aceite
// com fallback created_at) — usado pro card "+N este mês".
async function contarContratosAtivos(opts: { prisma: PrismaClient; scopeId: string | null; desde?: Date }): Promise<number> {
  const { prisma, scopeId, desde } = opts;
  const vinculadas = await prisma.contratoComercial.findMany({
    where: { proposta_comercial_id: { not: null } },
    select: { proposta_comercial_id: true },
  });
  const idsVinculados = vinculadas.map(c => c.proposta_comercial_id).filter((id): id is string => !!id);

  const [contratos, propostasSemContrato] = await Promise.all([
    prisma.contratoComercial.count({
      where: {
        status: 'ASSINADO',
        ...(desde ? { signed_at: { gte: desde } } : {}),
        ...(scopeId ? { vendedor_id: scopeId } : {}),
      },
    }),
    prisma.propostaComercial.count({
      where: {
        status: { in: STATUS_FECHADA },
        deleted_at: null,
        id: { notIn: idsVinculados },
        ...(desde ? {
          OR: [
            { data_aceite: { gte: desde } },
            { AND: [{ data_aceite: null }, { created_at: { gte: desde } }] },
          ],
        } : {}),
        ...(scopeId ? { vendedor_id: scopeId } : {}),
      },
    }),
  ]);
  return contratos + propostasSemContrato;
}

// Perdidos no período: usa a data REAL da mudança de status pra RECUSADA/PERDIDA,
// registrada em PropostaHistorico (tipo=STATUS, campo_alterado=status). O campo
// updated_at da proposta é impreciso — qualquer edição posterior (ex: corrigir um
// dado meses depois) reabre o "mês de perda". Propostas sem histórico registrado
// (perdas antigas, antes desse tracking existir) caem no fallback por updated_at.
async function contarPerdidosNoPeriodo(opts: { prisma: PrismaClient; scopeId: string | null; inicio: Date; fim?: Date }): Promise<number> {
  const { prisma, scopeId, inicio, fim } = opts;
  const STATUS_PERDIDA = ['RECUSADA', 'PERDIDA'];

  const propostasPerdidas = await prisma.propostaComercial.findMany({
    where: { status: { in: STATUS_PERDIDA }, deleted_at: null, ...(scopeId ? { vendedor_id: scopeId } : {}) },
    select: { id: true, updated_at: true },
  });
  if (propostasPerdidas.length === 0) return 0;

  const historicos = await prisma.propostaHistorico.findMany({
    where: {
      proposta_id: { in: propostasPerdidas.map(p => p.id) },
      tipo: 'STATUS', campo_alterado: 'status',
      valor_novo: { in: STATUS_PERDIDA },
    },
    orderBy: { created_at: 'asc' },
    select: { proposta_id: true, created_at: true },
  });
  const dataPerdaPorProposta = new Map<string, Date>();
  for (const h of historicos) {
    if (!dataPerdaPorProposta.has(h.proposta_id)) dataPerdaPorProposta.set(h.proposta_id, h.created_at);
  }

  return propostasPerdidas.filter(p => {
    const data = dataPerdaPorProposta.get(p.id) ?? p.updated_at;
    return data >= inicio && (!fim || data <= fim);
  }).length;
}

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
    // Filtro opcional por vendedor (gestor escolhe um vendedor específico).
    const filtroVendedor = (request.query as any)?.vendedor_id as string | undefined;
    const scopeId = effectiveScopeId(request, filtroVendedor);   // null = todos
    const fLead = ownerWhereId('Lead', scopeId);                 // {} ou filtro do dono
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
      prisma.lead.count({ where: { ...fLead } }),
      prisma.lead.count({ where: { created_at: { gte: inicioMes }, ...fLead } }),
      prisma.lead.count({ where: { status: 'GANHO', updated_at: { gte: inicioMes }, ...fLead } }),
      prisma.lead.count({ where: { status: 'GANHO', updated_at: { gte: inicioMesAnterior, lte: fimMesAnterior }, ...fLead } }),
      // Perdidos este mês (via PropostaComercial — LeadPerda é uma tabela legada nunca populada)
      contarPerdidosNoPeriodo({ prisma, scopeId, inicio: inicioMes }),
      contarPerdidosNoPeriodo({ prisma, scopeId, inicio: inicioMesAnterior, fim: fimMesAnterior }),

      // ContratoComercial ASSINADO + PropostaComercial fechada que NÃO gerou contrato formal
      // (muitos fechamentos são lançados direto como proposta, sem passar pelo fluxo ZapSign —
      // contar só ContratoComercial subestimava bastante os contratos ativos reais).
      contarContratosAtivos({ prisma, scopeId }),
      contarContratosAtivos({ prisma, scopeId, desde: inicioMes }),

      prisma.propostaComercial.count({ where: { status: { in: ['ENVIADA', 'EM_NEGOCIACAO'] }, deleted_at: null, ...(scopeId ? { vendedor_id: scopeId } : {}) } }),
      prisma.propostaComercial.count({ where: { status: { in: ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'] }, updated_at: { gte: inicioMes }, deleted_at: null, ...(scopeId ? { vendedor_id: scopeId } : {}) } }),

      prisma.atividade.count({ where: { status: 'PENDENTE', data_prevista: { gte: hoje_inicio, lt: hoje_fim }, ...(scopeId ? { OR: [{ responsavel_id: scopeId }, { created_by: scopeId }] } : {}) } }),
      prisma.atividade.count({ where: { status: 'PENDENTE', data_prevista: { lt: now }, ...(scopeId ? { OR: [{ responsavel_id: scopeId }, { created_by: scopeId }] } : {}) } }),

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
        where: { status: { notIn: ['GANHO', 'PERDIDO'] }, ...fLead },
        _count: { id: true },
        _sum: { valor_estimado: true }
      }),

      // Top leads por valor ponderado
      prisma.lead.findMany({
        where: {
          status: { notIn: ['GANHO', 'PERDIDO', 'NUTRICAO'] },
          valor_estimado: { gt: 0 },
          ...fLead
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
      WHERE deleted_at IS NULL${scopeId ? ' AND (vendedor_id = ? OR created_by = ?)' : ''}
      GROUP BY status
    `, ...(scopeId ? [scopeId, scopeId] : [])).catch(() => []);

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

    // Funil de propostas comerciais por etapa (fonte real do funil comercial —
    // complementa o pipeline_funil de Lead.etapa_funil, que hoje só tem a etapa Prospecção em uso).
    const FUNIL_PROPOSTA_ETAPAS: { chave: string; statuses: string[] }[] = [
      { chave: 'RASCUNHO', statuses: ['RASCUNHO'] },
      { chave: 'ENVIADA', statuses: ['ENVIADA'] },
      { chave: 'EM_NEGOCIACAO', statuses: ['EM_NEGOCIACAO'] },
      { chave: 'FECHADA', statuses: ['ACEITA', 'CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO'] },
    ];
    const pipeline_funil_propostas = FUNIL_PROPOSTA_ETAPAS.map(({ chave, statuses }) => {
      const rows = pipeline_propostas_raw.filter(r => statuses.includes(r.status));
      return {
        etapa: chave,
        count: rows.reduce((s, r) => s + num(r.count), 0),
        valor: Math.round(rows.reduce((s, r) => s + num(r.setup_total), 0)),
      };
    });

    // MRR dos contratos ativos (ContratoComercial é a fonte real — Contrato é legado e está sempre vazio)
    const mrr_result = await prisma.contratoComercial.aggregate({
      where: { status: 'ASSINADO' },
      _sum: { mensalidade: true }
    });

    // MRR mês anterior
    const mrr_anterior = await prisma.contratoComercial.aggregate({
      where: { status: 'ASSINADO', signed_at: { lte: fimMesAnterior } },
      _sum: { mensalidade: true }
    });

    // Pipeline valor total — soma de PropostaComercial em aberto (setup + mensalidade).
    // Trocado de Lead.valor_estimado: só 7 de ~206 leads ativos tinham esse campo
    // preenchido (o vendedor raramente registra valor no lead), subestimando o pipeline
    // em quase 100%. A proposta sempre carrega o valor (é gerada a partir do plano).
    const propostasEmAberto = await prisma.propostaComercial.findMany({
      where: { status: { in: ['ENVIADA', 'EM_NEGOCIACAO'] }, deleted_at: null, ...(scopeId ? { vendedor_id: scopeId } : {}) },
      select: { valor_final: true, mensalidade_plus: true, mensalidade_pro: true },
    });
    const pipeline_valor = propostasEmAberto.reduce((s, p) => {
      const setup = p.valor_final ?? 0;
      const mrr = p.mensalidade_plus ?? p.mensalidade_pro ?? 0;
      return s + setup + mrr;
    }, 0);

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

    // Valor total perdido no mês (via PropostaComercial — LeadPerda é legada e nunca é populada)
    const valor_perdido_mes_result = await prisma.propostaComercial.aggregate({
      where: { status: { in: ['RECUSADA', 'PERDIDA'] }, updated_at: { gte: inicioMes }, deleted_at: null, ...(scopeId ? { vendedor_id: scopeId } : {}) },
      _sum: { valor_final: true }
    });
    const valor_perdido_mes = Math.round(valor_perdido_mes_result._sum.valor_final || 0);

    // Ranking de motivos de perda: o fluxo atual de PropostaComercial não captura motivo
    // estruturado de recusa/perda (só existe na tabela legada LeadPerda, nunca populada).
    // Fica vazio até que a captura de motivo seja implementada no fluxo de propostas.
    const ranking_motivos: { motivo: string; total: number; valor_total: number; pct: number }[] = [];

    // NPS rápido — combina as duas fontes reais (mesma lógica de /nps/dashboard em health-score.ts):
    // SurveyResposta (pós-churn, score 0-10 direto) + PesquisaSatisfacao (nota geral 1-5 → 0-10).
    const nps_surveys = await prisma.surveyResposta.findMany({ select: { q3_score: true } });
    const nps_pesquisas = await prisma.pesquisaSatisfacao.findMany({ select: { nota_geral: true, media: true } }).catch(() => [] as any[]);
    const nps_scores = [
      ...nps_surveys.map(s => s.q3_score),
      ...nps_pesquisas.map((p: any) => {
        const base = p.nota_geral && p.nota_geral > 0 ? p.nota_geral : p.media;
        return Math.round(base * 2);
      }),
    ].filter((s): s is number => s !== null && s !== undefined);
    const nps_total = nps_scores.length;
    const nps_promoters = nps_scores.filter(s => s >= 9).length;
    const nps_detractors = nps_scores.filter(s => s <= 6).length;
    const nps_score = nps_total > 0 ? Math.round(((nps_promoters - nps_detractors) / nps_total) * 100) : null;

    // Taxa de conversão
    const taxa_conversao = leads_total > 0 ? Math.round((leads_ganhos_mes / Math.max(leads_mes, 1)) * 100) : 0;

    // Delta MRR
    const mrr_atual = mrr_result._sum.mensalidade || 0;
    const mrr_ant = mrr_anterior._sum.mensalidade || 0;
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
      pipeline_funil_propostas,
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
