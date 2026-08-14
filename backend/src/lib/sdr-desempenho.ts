import { PrismaClient } from '@prisma/client';

// Cálculo do funil de desempenho de um SDR (ou agregado geral quando sdrId=null),
// extraído de backend/src/routes/sdr.ts (Task 7) para ser reaproveitado também
// pela seção comparativa de SDRs do Relatório Comercial (Task 8).
export async function calcularDesempenhoSdr(prisma: PrismaClient, sdrId: string | null, dataInicio: Date, dataFim: Date) {
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

  return {
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
  };
}
