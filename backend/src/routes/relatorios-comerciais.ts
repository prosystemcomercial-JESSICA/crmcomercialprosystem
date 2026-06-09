import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const ROLES_PERMITIDOS = ['SUPERVISAO', 'SUPERVISAO_COMERCIAL', 'CEO', 'ADMIN'];

const UpsertRelatorioSchema = z.object({
  meta_contratos: z.number().int().default(10),
  contratos_fechados: z.number().int().nullable().optional(),
  propostas_pipeline: z.number().int().nullable().optional(),
  mrr_potencial: z.number().nullable().optional(),
  mrr_novo: z.number().nullable().optional(),
  ticket_medio: z.number().nullable().optional(),
  cancelamentos: z.number().int().nullable().optional(),
  mrr_perdido: z.number().nullable().optional(),
  motivos_cancelamento: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  vendedores: z.array(z.object({
    vendedor_id: z.string().nullable().optional(),
    vendedor_nome: z.string(),
    contatos_realizados: z.number().int().nullable().optional(),
    leads_qualificados: z.number().int().nullable().optional(),
    propostas_enviadas: z.number().int().nullable().optional(),
    contratos_fechados: z.number().int().nullable().optional(),
    mrr_vendido: z.number().nullable().optional()
  })).optional()
});

function checkRole(request: any, reply: any): boolean {
  const user = (request as any).user;
  if (!user || !ROLES_PERMITIDOS.includes(user.role)) {
    reply.status(403).send({ status: 'error', message: 'Acesso restrito a Supervisão e CEO' });
    return false;
  }
  return true;
}

export async function relatoriosComerciais(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Analytics gerais — dados para gráficos (registrado antes das rotas com parâmetros)
  fastify.get('/relatorios-comerciais/analytics/dados', async (request, reply) => {
    if (!checkRole(request, reply)) return;

    const now = new Date();
    const dozeAtras = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [
      leadsOrigem,
      leadsTemperatura,
      leadsEtapa,
      leadsEstado,
      propostasStatus,
      atividadesTipo
    ] = await Promise.all([
      prisma.lead.groupBy({ by: ['origem'], _count: { id: true }, where: { deleted_at: null } }),
      prisma.lead.groupBy({ by: ['temperatura'], _count: { id: true }, where: { deleted_at: null, status: { notIn: ['GANHO', 'PERDIDO'] } } }),
      prisma.lead.groupBy({ by: ['etapa_funil'], _count: { id: true }, _sum: { valor_estimado: true }, where: { deleted_at: null, status: { notIn: ['GANHO', 'PERDIDO'] } } }),
      prisma.lead.groupBy({ by: ['estado'], _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 8, where: { deleted_at: null, estado: { not: null } } }),
      prisma.proposta.groupBy({ by: ['status'], _count: { id: true }, _sum: { valor: true } }),
      prisma.atividade.groupBy({ by: ['tipo'], _count: { id: true } })
    ]);

    // Evolução mensal de contratos (últimos 12 meses)
    const contratosRaw = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        DATE_FORMAT(created_at, '%Y-%m-01') AS mes,
        COUNT(*) AS total,
        SUM(valor) AS mrr
      FROM Contrato
      WHERE created_at >= ?
        AND deleted_at IS NULL
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-01')
      ORDER BY mes ASC`,
      dozeAtras
    );

    const canceladosRaw = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        DATE_FORMAT(updated_at, '%Y-%m-01') AS mes,
        COUNT(*) AS total,
        SUM(valor) AS mrr_perdido
      FROM Contrato
      WHERE status = 'CANCELADO'
        AND updated_at >= ?
      GROUP BY DATE_FORMAT(updated_at, '%Y-%m-01')
      ORDER BY mes ASC`,
      dozeAtras
    );

    // Performance por vendedor (leads ganhos + contratos)
    const vendedoresPerf = await prisma.lead.groupBy({
      by: ['responsavel_id'],
      _count: { id: true },
      where: { deleted_at: null, status: 'GANHO', responsavel_id: { not: null } }
    });

    // Taxa de conversão: leads ganhos / total por origem
    const leadsGanhosPorOrigem = await prisma.lead.groupBy({
      by: ['origem'],
      _count: { id: true },
      where: { deleted_at: null, status: 'GANHO' }
    });

    const ETAPA_ORDER = ['PROSPECCAO','QUALIFICACAO','APRESENTACAO','PROPOSTA','NEGOCIACAO','FECHAMENTO'];
    const etapaOrdenada = ETAPA_ORDER.map(e => {
      const d = leadsEtapa.find(x => x.etapa_funil === e);
      return { etapa: e, count: d?._count.id || 0, valor: Math.round(Number(d?._sum.valor_estimado) || 0) };
    });

    return reply.send({
      status: 'success',
      data: {
        leads_origem: leadsOrigem.map(x => ({ nome: x.origem, total: x._count.id })),
        leads_temperatura: leadsTemperatura.map(x => ({ nome: x.temperatura, total: x._count.id })),
        leads_etapa: etapaOrdenada,
        leads_estado: leadsEstado.map(x => ({ nome: x.estado || 'N/D', total: x._count.id })),
        propostas_status: propostasStatus.map(x => ({ nome: x.status, total: x._count.id, valor: Math.round(Number(x._sum.valor) || 0) })),
        atividades_tipo: atividadesTipo.map(x => ({ nome: x.tipo, total: x._count.id })),
        evolucao_contratos: contratosRaw.map(x => ({
          mes: new Date(x.mes).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          contratos: Number(x.total),
          mrr: Math.round(Number(x.mrr) || 0)
        })),
        cancelados_evolucao: canceladosRaw.map(x => ({
          mes: new Date(x.mes).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          cancelamentos: Number(x.total),
          mrr_perdido: Math.round(Number(x.mrr_perdido) || 0)
        })),
        conversao_por_origem: leadsOrigem.map(x => {
          const ganhos = leadsGanhosPorOrigem.find(g => g.origem === x.origem)?._count.id || 0;
          return {
            nome: x.origem,
            total: x._count.id,
            ganhos,
            taxa: x._count.id > 0 ? Math.round((ganhos / x._count.id) * 100) : 0
          };
        }),
        vendedores_performance: vendedoresPerf.map(x => ({ vendedor_id: x.responsavel_id, ganhos: x._count.id }))
      }
    });
  });

  // Lista todos os meses do ano
  fastify.get('/relatorios-comerciais/:ano', async (request, reply) => {
    if (!checkRole(request, reply)) return;
    const { ano } = request.params as { ano: string };
    const anoInt = parseInt(ano);

    const relatorios: any[] = await prisma.$queryRawUnsafe(
      `SELECT r.*,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'id', v.id, 'relatorio_id', v.relatorio_id, 'vendedor_id', v.vendedor_id,
          'vendedor_nome', v.vendedor_nome, 'contatos_realizados', v.contatos_realizados,
          'leads_qualificados', v.leads_qualificados, 'propostas_enviadas', v.propostas_enviadas,
          'contratos_fechados', v.contratos_fechados, 'mrr_vendido', v.mrr_vendido
        )) FROM RelatorioVendedor v WHERE v.relatorio_id = r.id) AS vendedores
       FROM RelatorioMensal r
       WHERE r.ano = ?
       ORDER BY r.mes ASC`,
      anoInt
    );

    // Preenche meses faltantes com null (para o frontend saber que não há dado)
    const mesesComDados = new Set(relatorios.map((r: any) => r.mes));
    const resultado = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      return mesesComDados.has(mes)
        ? relatorios.find((r: any) => r.mes === mes)
        : { ano: anoInt, mes, fonte: null, dados: null };
    });

    return reply.send({ status: 'success', data: resultado });
  });

  // Detalhe de um mês
  fastify.get('/relatorios-comerciais/:ano/:mes', async (request, reply) => {
    if (!checkRole(request, reply)) return;
    const { ano, mes } = request.params as { ano: string; mes: string };

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT r.*,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'id', v.id, 'relatorio_id', v.relatorio_id, 'vendedor_id', v.vendedor_id,
          'vendedor_nome', v.vendedor_nome, 'contatos_realizados', v.contatos_realizados,
          'leads_qualificados', v.leads_qualificados, 'propostas_enviadas', v.propostas_enviadas,
          'contratos_fechados', v.contratos_fechados, 'mrr_vendido', v.mrr_vendido
        ) ORDER BY v.vendedor_nome) FROM RelatorioVendedor v WHERE v.relatorio_id = r.id) AS vendedores
       FROM RelatorioMensal r
       WHERE r.ano = ? AND r.mes = ?`,
      parseInt(ano), parseInt(mes)
    );

    if (rows.length === 0) return reply.status(404).send({ status: 'error', message: 'Relatório não encontrado' });
    return reply.send({ status: 'success', data: rows[0] });
  });

  // Criar/atualizar relatório manual
  fastify.put('/relatorios-comerciais/:ano/:mes', async (request, reply) => {
    if (!checkRole(request, reply)) return;
    const { ano, mes } = request.params as { ano: string; mes: string };
    const body = UpsertRelatorioSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.flatten() });

    const user = (request as any).user;
    const anoInt = parseInt(ano);
    const mesInt = parseInt(mes);
    const { vendedores, ...campos } = body.data;

    // Upsert do relatório principal
    const existing: any[] = await prisma.$queryRawUnsafe(
      `SELECT id FROM RelatorioMensal WHERE ano = ? AND mes = ?`,
      anoInt, mesInt
    );

    let relatorioId: string;

    if (existing.length > 0) {
      relatorioId = existing[0].id;
      await prisma.$executeRawUnsafe(
        `UPDATE RelatorioMensal SET
          meta_contratos = ?, contratos_fechados = ?, propostas_pipeline = ?,
          mrr_potencial = ?, mrr_novo = ?, ticket_medio = ?,
          cancelamentos = ?, mrr_perdido = ?, motivos_cancelamento = ?,
          observacoes = ?, fonte = 'MANUAL', updated_at = NOW()
         WHERE id = ?`,
        campos.meta_contratos ?? 10,
        campos.contratos_fechados ?? null,
        campos.propostas_pipeline ?? null,
        campos.mrr_potencial ?? null,
        campos.mrr_novo ?? null,
        campos.ticket_medio ?? null,
        campos.cancelamentos ?? null,
        campos.mrr_perdido ?? null,
        campos.motivos_cancelamento ?? null,
        campos.observacoes ?? null,
        relatorioId
      );
    } else {
      relatorioId = randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO RelatorioMensal (id, ano, mes, fonte, meta_contratos, contratos_fechados, propostas_pipeline,
          mrr_potencial, mrr_novo, ticket_medio, cancelamentos, mrr_perdido, motivos_cancelamento, observacoes, created_by)
         VALUES (?, ?, ?, 'MANUAL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        relatorioId, anoInt, mesInt,
        campos.meta_contratos ?? 10,
        campos.contratos_fechados ?? null,
        campos.propostas_pipeline ?? null,
        campos.mrr_potencial ?? null,
        campos.mrr_novo ?? null,
        campos.ticket_medio ?? null,
        campos.cancelamentos ?? null,
        campos.mrr_perdido ?? null,
        campos.motivos_cancelamento ?? null,
        campos.observacoes ?? null,
        user?.nome || user?.id || 'sistema'
      );
    }

    // Substituir vendedores
    if (vendedores !== undefined) {
      await prisma.$executeRawUnsafe(`DELETE FROM RelatorioVendedor WHERE relatorio_id = ?`, relatorioId);
      for (const v of vendedores) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO RelatorioVendedor (relatorio_id, vendedor_id, vendedor_nome,
            contatos_realizados, leads_qualificados, propostas_enviadas, contratos_fechados, mrr_vendido)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          relatorioId, v.vendedor_id ?? null, v.vendedor_nome,
          v.contatos_realizados ?? null, v.leads_qualificados ?? null,
          v.propostas_enviadas ?? null, v.contratos_fechados ?? null,
          v.mrr_vendido ?? null
        );
      }
    }

    return reply.send({ status: 'success', message: 'Relatório salvo', data: { id: relatorioId, ano: anoInt, mes: mesInt } });
  });

  // Auto-gerar a partir dos dados do CRM (Jun/2026 em diante)
  fastify.post('/relatorios-comerciais/:ano/:mes/gerar', async (request, reply) => {
    if (!checkRole(request, reply)) return;
    const { ano, mes } = request.params as { ano: string; mes: string };
    const anoInt = parseInt(ano);
    const mesInt = parseInt(mes);

    const inicioMes = new Date(anoInt, mesInt - 1, 1);
    const fimMes = new Date(anoInt, mesInt, 0, 23, 59, 59);

    const user = (request as any).user;

    // Contratos fechados no mês (status ATIVO, criados no período)
    const contratosResult = await prisma.contrato.findMany({
      where: {
        deleted_at: null,
        status: 'ATIVO',
        created_at: { gte: inicioMes, lte: fimMes }
      },
      select: { id: true, valor: true, created_by: true }
    });

    // Cancelamentos no mês
    const cancelados = await prisma.contrato.findMany({
      where: {
        status: 'CANCELADO',
        updated_at: { gte: inicioMes, lte: fimMes }
      },
      select: { id: true, valor: true }
    });

    // Propostas abertas no fim do mês
    const propostas_pipeline = await prisma.proposta.count({
      where: { status: { in: ['ENVIADA', 'VISUALIZADA'] } }
    });

    const mrr_potencial_result = await prisma.proposta.aggregate({
      _sum: { valor: true },
      where: { status: { in: ['ENVIADA', 'VISUALIZADA'] } }
    });

    const contratos_fechados = contratosResult.length;
    const mrr_novo = contratosResult.reduce((s, c) => s + (c.valor || 0), 0);
    const ticket_medio = contratos_fechados > 0 ? mrr_novo / contratos_fechados : 0;
    const cancelamentos = cancelados.length;
    const mrr_perdido = cancelados.reduce((s, c) => s + (c.valor || 0), 0);
    const mrr_potencial = mrr_potencial_result._sum.valor || 0;

    // Upsert
    const existing: any[] = await prisma.$queryRawUnsafe(
      `SELECT id FROM RelatorioMensal WHERE ano = ? AND mes = ?`, anoInt, mesInt
    );

    let relatorioId: string;
    if (existing.length > 0) {
      relatorioId = existing[0].id;
      await prisma.$executeRawUnsafe(
        `UPDATE RelatorioMensal SET
          contratos_fechados=?, propostas_pipeline=?, mrr_potencial=?, mrr_novo=?,
          ticket_medio=?, cancelamentos=?, mrr_perdido=?, fonte='AUTO', gerado_em=NOW(), updated_at=NOW()
         WHERE id=?`,
        contratos_fechados, propostas_pipeline, mrr_potencial, mrr_novo,
        ticket_medio, cancelamentos, mrr_perdido, relatorioId
      );
    } else {
      relatorioId = randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO RelatorioMensal (id, ano, mes, fonte, meta_contratos, contratos_fechados, propostas_pipeline,
          mrr_potencial, mrr_novo, ticket_medio, cancelamentos, mrr_perdido, gerado_em, created_by)
         VALUES (?,?,'AUTO',10,?,?,?,?,?,?,?,NOW(),?)`,
        relatorioId, anoInt, mesInt, contratos_fechados, propostas_pipeline, mrr_potencial,
        mrr_novo, ticket_medio, cancelamentos, mrr_perdido,
        user?.nome || 'sistema'
      );
    }

    // Vendedores — agrupa contratos fechados por responsavel_id
    const vendedoresMap: Record<string, { nome: string; contratos: number; mrr: number; leads: number }> = {};

    for (const c of contratosResult) {
      const vid = c.created_by || 'desconhecido';
      if (!vendedoresMap[vid]) vendedoresMap[vid] = { nome: vid, contratos: 0, mrr: 0, leads: 0 };
      vendedoresMap[vid].contratos++;
      vendedoresMap[vid].mrr += c.valor || 0;
    }

    // Leads qualificados por vendedor no mês
    const leadsQual = await prisma.lead.findMany({
      where: {
        deleted_at: null,
        status: 'GANHO',
        updated_at: { gte: inicioMes, lte: fimMes }
      },
      select: { responsavel_id: true, created_by: true }
    });
    for (const l of leadsQual) {
      const vid = l.responsavel_id || l.created_by || 'desconhecido';
      if (!vendedoresMap[vid]) vendedoresMap[vid] = { nome: vid, contratos: 0, mrr: 0, leads: 0 };
      vendedoresMap[vid].leads++;
    }

    // Substitui vendedores
    await prisma.$executeRawUnsafe(`DELETE FROM RelatorioVendedor WHERE relatorio_id = ?`, relatorioId);
    for (const [vid, dados] of Object.entries(vendedoresMap)) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO RelatorioVendedor (relatorio_id, vendedor_id, vendedor_nome, contratos_fechados, mrr_vendido, leads_qualificados)
         VALUES (?,?,?,?,?,?)`,
        relatorioId, vid, dados.nome, dados.contratos, dados.mrr, dados.leads
      );
    }

    fastify.log.info(`[RELATORIO] Gerado automaticamente ${anoInt}/${mesInt} por ${user?.nome || 'sistema'}`);
    return reply.send({
      status: 'success',
      message: `Relatório ${mesInt}/${anoInt} gerado automaticamente`,
      data: { id: relatorioId, contratos_fechados, propostas_pipeline, mrr_novo, cancelamentos, mrr_perdido }
    });
  });

  // Resumo anual consolidado
  fastify.get('/relatorios-comerciais/:ano/resumo/anual', async (request, reply) => {
    if (!checkRole(request, reply)) return;
    const { ano } = request.params as { ano: string };

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT mes, fonte, meta_contratos, contratos_fechados, propostas_pipeline,
              mrr_potencial, mrr_novo, ticket_medio, cancelamentos, mrr_perdido, motivos_cancelamento
       FROM RelatorioMensal WHERE ano = ? ORDER BY mes`,
      parseInt(ano)
    );

    const totalContratos = rows.reduce((s, r) => s + Number(r.contratos_fechados || 0), 0);
    const totalCancelamentos = rows.reduce((s, r) => s + Number(r.cancelamentos || 0), 0);
    const totalMrrNovo = rows.reduce((s, r) => s + Number(r.mrr_novo || 0), 0);
    const totalMrrPerdido = rows.reduce((s, r) => s + Number(r.mrr_perdido || 0), 0);

    return reply.send({
      status: 'success',
      data: {
        meses: rows,
        totais: { contratos: totalContratos, cancelamentos: totalCancelamentos, mrr_novo: totalMrrNovo, mrr_perdido: totalMrrPerdido, saldo_mrr: totalMrrNovo - totalMrrPerdido }
      }
    });
  });
}
