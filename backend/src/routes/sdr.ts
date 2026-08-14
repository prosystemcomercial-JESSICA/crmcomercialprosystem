import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { getUser, podeVerTudo } from '@/lib/scope';

// Painel de desempenho do SDR — funil de prospecção (Task 7).
// SDR só vê o próprio desempenho; gestão comercial (CEO/ADMIN/SUPERVISAO_COMERCIAL)
// vê agregado geral ou filtrado por um SDR específico via ?sdr_id=.
export async function sdrRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  fastify.get('/sdr/desempenho', async (request, reply) => {
    const user = getUser(request);
    const q = request.query as { data_inicio?: string; data_fim?: string; sdr_id?: string };

    // SDR só vê o próprio; gestor pode filtrar por sdr_id ou ver agregado geral.
    let sdrId: string | null;
    if (!podeVerTudo(user)) {
      sdrId = user?.id || '__no_user__';
    } else {
      sdrId = q.sdr_id || null;
    }

    const dataInicio = q.data_inicio ? new Date(q.data_inicio) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dataFim = q.data_fim ? new Date(q.data_fim) : new Date();

    const whereLead: any = { created_at: { gte: dataInicio, lte: dataFim }, deleted_at: null };
    if (sdrId) whereLead.created_by = sdrId;

    const leadsCadastrados = await prisma.lead.count({ where: whereLead });
    const leadsQualificados = await prisma.lead.count({ where: { ...whereLead, etapa_comercial: 'QUALIFICADO' } });
    const vendasOriginadas = await prisma.lead.count({ where: { ...whereLead, etapa_comercial: { in: ['ACEITO', 'FECHADO'] } } });

    const whereAtiv: any = { created_at: { gte: dataInicio, lte: dataFim } };
    if (sdrId) whereAtiv.created_by = sdrId;

    const tentativas = await prisma.atividade.count({ where: { ...whereAtiv, tipo: { in: ['LIGACAO', 'WHATSAPP', 'EMAIL'] } } });
    const contatosEfetivos = await prisma.atividade.count({ where: { ...whereAtiv, tipo: { in: ['LIGACAO', 'WHATSAPP', 'EMAIL'] }, status: 'REALIZADA' } });
    const reunioesAgendadas = await prisma.atividade.count({ where: { ...whereAtiv, tipo: 'REUNIAO' } });
    const reunioesRealizadas = await prisma.atividade.count({ where: { ...whereAtiv, tipo: 'REUNIAO', status: 'REALIZADA' } });

    // Leads distribuídos: via LeadHistorico (acao='DISTRIBUICAO_SDR'), filtrando pelo
    // lead cujo created_by é o SDR em questão. LeadHistorico é expurgado após 60 dias
    // (backend/src/services/automation.service.ts, expurgarAuditoriaAntiga) — para
    // períodos além disso, este número fica subestimado. Documentado na UI (nota junto
    // ao card "Leads distribuídos" no frontend).
    const leadsDistribuidos: any[] = sdrId
      ? await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as c FROM LeadHistorico h
           JOIN \`Lead\` l ON l.id = h.lead_id
           WHERE h.acao = 'DISTRIBUICAO_SDR' AND l.created_by = ? AND h.created_at BETWEEN ? AND ?`,
          sdrId, dataInicio, dataFim
        ).catch(() => [{ c: 0 }])
      : await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as c FROM LeadHistorico h
           WHERE h.acao = 'DISTRIBUICAO_SDR' AND h.created_at BETWEEN ? AND ?`,
          dataInicio, dataFim
        ).catch(() => [{ c: 0 }]);
    const totalDistribuidos = Number(leadsDistribuidos[0]?.c || 0);

    const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 1000) / 10 : 0;

    return reply.send({
      status: 'success',
      data: {
        periodo: { data_inicio: dataInicio.toISOString(), data_fim: dataFim.toISOString() },
        funil: {
          leads_cadastrados: leadsCadastrados,
          tentativas_contato: tentativas,
          contatos_efetivos: contatosEfetivos,
          leads_qualificados: leadsQualificados,
          reunioes_agendadas: reunioesAgendadas,
          reunioes_realizadas: reunioesRealizadas,
          leads_distribuidos: totalDistribuidos,
          vendas_originadas: vendasOriginadas,
        },
        taxas: {
          taxa_contato: pct(contatosEfetivos, tentativas),
          taxa_qualificacao: pct(leadsQualificados, leadsCadastrados),
          taxa_comparecimento: pct(reunioesRealizadas, reunioesAgendadas),
          conversao_distribuido_venda: pct(vendasOriginadas, totalDistribuidos),
        },
      },
    });
  });
}
