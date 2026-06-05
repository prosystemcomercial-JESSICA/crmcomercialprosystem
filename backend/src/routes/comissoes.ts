import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { scopeUserId, requireGestor } from '@/lib/scope';

export async function comissoesRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Resolve a RAZÃO SOCIAL do cliente de cada comissão (em vez do id do contrato):
  //  - CONTRATO        → ContratoComercial.razao_social (via referencia_id)
  //  - VENDA_ADICIONAL → VendaAdicional → Cliente.nome
  async function mapaClientes(comissoes: any[]): Promise<Record<string, string>> {
    const mapa: Record<string, string> = {};
    const contratoIds = [...new Set(comissoes.filter(c => c.tipo === 'CONTRATO' && c.referencia_id).map(c => c.referencia_id))];
    const vendaIds = [...new Set(comissoes.filter(c => c.tipo === 'VENDA_ADICIONAL' && c.referencia_id).map(c => c.referencia_id))];

    if (contratoIds.length) {
      const cts = await prisma.contratoComercial.findMany({
        where: { id: { in: contratoIds } }, select: { id: true, razao_social: true, numero_contrato: true },
      }).catch(() => [] as any[]);
      cts.forEach((c: any) => { mapa[c.id] = c.razao_social || c.numero_contrato || c.id; });
    }
    if (vendaIds.length) {
      const vas = await prisma.vendaAdicional.findMany({
        where: { id: { in: vendaIds } }, select: { id: true, cliente: { select: { nome: true, empresa: true } } },
      }).catch(() => [] as any[]);
      vas.forEach((v: any) => { mapa[v.id] = v.cliente?.empresa || v.cliente?.nome || v.id; });
    }
    return mapa;
  }

  // ===== REGRAS DE COMISSÃO =====
  fastify.get('/comissoes/regras', async (request, reply) => {
    const regras = await prisma.regraComissao.findMany({
      orderBy: { created_at: 'desc' }
    });
    return reply.send({ status: 'success', data: regras });
  });

  fastify.post('/comissoes/regras', async (request, reply) => {
    const body = z.object({
      nome: z.string().min(1),
      responsavel_id: z.string(),
      tipo: z.enum(['CONTRATO', 'PROPOSTA', 'LEAD']).default('CONTRATO'),
      percentual: z.number().min(0).max(100),
      observacoes: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const regra = await prisma.regraComissao.create({ data: body.data });
    return reply.status(201).send({ status: 'success', data: regra });
  });

  fastify.patch('/comissoes/regras/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      percentual: z.number().optional(),
      ativo: z.boolean().optional(),
      observacoes: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    try {
      const regra = await prisma.regraComissao.update({ where: { id }, data: body.data });
      return reply.send({ status: 'success', data: regra });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Regra não encontrada' });
      throw err;
    }
  });

  // ===== COMISSÃO DA SUPERVISÃO COMERCIAL =====
  // Regra: 5% sobre TODO o faturamento do setor comercial no período, ou seja:
  //   • SETUP/instalação de todos os contratos ASSINADOS (de todos os vendedores)
  //   • valor das VENDAS ADICIONAIS confirmadas (serviços vendidos, sem contrato)
  // Cada usuário com cargo SUPERVISAO_COMERCIAL recebe os 5% cheios.
  const COMISSAO_SUPERVISAO_PCT = 5;

  fastify.get('/comissoes/supervisao', async (request, reply) => {
    const q = z.object({ periodo: z.string().optional() }).safeParse(request.query);
    // periodo "YYYY-MM" (default: mês corrente)
    const now = new Date();
    const periodo = q.success && q.data.periodo ? q.data.periodo
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [ano, mes] = periodo.split('-').map(Number);
    const inicio = new Date(ano, (mes || 1) - 1, 1);
    const fim = new Date(ano, (mes || 1), 0, 23, 59, 59);

    // 1) Setup dos contratos ASSINADOS no período
    const contratos = await prisma.contratoComercial.findMany({
      where: { status: 'ASSINADO', signed_at: { gte: inicio, lte: fim } },
      select: { id: true, numero_contrato: true, razao_social: true, valor_setup_total: true, signed_at: true, vendedor_nome: true },
    }).catch(() => [] as any[]);
    const fatContratos = contratos.reduce((s: number, c: any) => s + Number(c.valor_setup_total || 0), 0);

    // 2) Vendas adicionais confirmadas/pagas no período
    const vendas = await prisma.vendaAdicional.findMany({
      where: { status: { in: ['CONFIRMADA', 'PAGA'] }, created_at: { gte: inicio, lte: fim } },
      select: { id: true, valor_venda: true, plano_novo: true, created_at: true },
    }).catch(() => [] as any[]);
    const fatVendas = vendas.reduce((s: number, v: any) => s + Number(v.valor_venda || 0), 0);

    const faturamento = Math.round((fatContratos + fatVendas) * 100) / 100;
    const comissaoUnit = Math.round(faturamento * (COMISSAO_SUPERVISAO_PCT / 100) * 100) / 100;

    // 3) Supervisores comerciais ativos (cada um recebe os 0,5% cheios)
    const supervisores: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome FROM UsuarioCRM WHERE cargo = 'SUPERVISAO_COMERCIAL' AND status = 'ATIVO' ORDER BY nome ASC`
    ).catch(() => []);

    return reply.send({
      status: 'success',
      data: {
        periodo,
        percentual: COMISSAO_SUPERVISAO_PCT,
        faturamento_setor: faturamento,
        faturamento_contratos: Math.round(fatContratos * 100) / 100,
        faturamento_vendas_adicionais: Math.round(fatVendas * 100) / 100,
        qtd_contratos: contratos.length,
        qtd_vendas_adicionais: vendas.length,
        comissao_por_supervisor: comissaoUnit,
        supervisores: supervisores.map(s => ({ id: s.id, nome: s.nome, comissao: comissaoUnit })),
        detalhamento: {
          contratos: contratos.map((c: any) => ({
            numero: c.numero_contrato, cliente: c.razao_social, setup: Number(c.valor_setup_total || 0),
            vendedor: c.vendedor_nome, data: c.signed_at,
          })),
        },
      },
    });
  });

  // ===== RELATÓRIO DE COMISSÕES A PAGAR (supervisão → financeiro) =====
  // Por mês de pagamento E por vendedor. Inclui as comissões de vendedores e supervisão.
  // estagio: A_RECEBER | A_CONFIRMAR | CONFIRMADA | PAGA | CANCELADA
  fastify.get('/comissoes/relatorio', async (request, reply) => {
    const q = z.object({ mes_pagamento: z.string().optional(), estagio: z.string().optional() }).safeParse(request.query);
    const where: any = { status: { not: 'CANCELADA' } };
    if (q.success && q.data.mes_pagamento) where.mes_pagamento = q.data.mes_pagamento;
    if (q.success && q.data.estagio) where.estagio = q.data.estagio;

    const comissoes = await prisma.comissao.findMany({ where, orderBy: { created_at: 'desc' } });

    // Nomes dos responsáveis (vendedores/supervisores)
    const ids = [...new Set(comissoes.map(c => c.responsavel_id))];
    const usuarios: any[] = ids.length
      ? await prisma.$queryRawUnsafe(
          `SELECT id, nome, cargo FROM UsuarioCRM WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids)
      : [];
    const nomeDe: Record<string, any> = {};
    usuarios.forEach(u => { nomeDe[u.id] = u; });

    // Razão social do cliente de cada comissão (em vez do id do contrato).
    const clienteDe = await mapaClientes(comissoes as any[]);

    // Agrupa por mês de pagamento e por responsável
    const porMes: Record<string, any> = {};
    const porResponsavel: Record<string, any> = {};
    for (const c of comissoes as any[]) {
      const mes = c.mes_pagamento || 'A confirmar';
      porMes[mes] = porMes[mes] || { mes_pagamento: mes, total: 0, count: 0, itens: [] };
      porMes[mes].total += c.valor_comissao; porMes[mes].count += 1;
      porMes[mes].itens.push({
        ...c,
        responsavel_nome: nomeDe[c.responsavel_id]?.nome || c.responsavel_id,
        cliente: clienteDe[c.referencia_id || ''] || null,
      });

      const r = c.responsavel_id;
      porResponsavel[r] = porResponsavel[r] || {
        responsavel_id: r, responsavel_nome: nomeDe[r]?.nome || r, cargo: nomeDe[r]?.cargo || '',
        papel: c.papel || '', total: 0, a_receber: 0, a_confirmar: 0, confirmada: 0, paga: 0, count: 0,
      };
      porResponsavel[r].total += c.valor_comissao; porResponsavel[r].count += 1;
      if (c.estagio === 'A_RECEBER') porResponsavel[r].a_receber += c.valor_comissao;
      else if (c.estagio === 'A_CONFIRMAR') porResponsavel[r].a_confirmar += c.valor_comissao;
      else if (c.estagio === 'CONFIRMADA') porResponsavel[r].confirmada += c.valor_comissao;
      else if (c.estagio === 'PAGA') porResponsavel[r].paga += c.valor_comissao;
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    return reply.send({
      status: 'success',
      data: {
        por_mes: Object.values(porMes).map((m: any) => ({ ...m, total: round(m.total) })),
        por_responsavel: Object.values(porResponsavel).map((r: any) => ({
          ...r, total: round(r.total), a_receber: round(r.a_receber), a_confirmar: round(r.a_confirmar),
          confirmada: round(r.confirmada), paga: round(r.paga),
        })),
        totais: {
          total: round(comissoes.reduce((s, c) => s + c.valor_comissao, 0)),
          a_receber: round(comissoes.filter((c: any) => c.estagio === 'A_RECEBER').reduce((s, c) => s + c.valor_comissao, 0)),
          a_confirmar: round(comissoes.filter((c: any) => c.estagio === 'A_CONFIRMAR').reduce((s, c) => s + c.valor_comissao, 0)),
          confirmada: round(comissoes.filter((c: any) => c.estagio === 'CONFIRMADA').reduce((s, c) => s + c.valor_comissao, 0)),
          paga: round(comissoes.filter((c: any) => c.estagio === 'PAGA').reduce((s, c) => s + c.valor_comissao, 0)),
        },
      },
    });
  });

  // Marca comissões como PAGAS (financeiro) — por mês de pagamento ou por ids.
  fastify.post('/comissoes/marcar-pagas', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const body = z.object({ ids: z.array(z.string()).optional(), mes_pagamento: z.string().optional() }).safeParse(request.body);
    if (!body.success || (!body.data.ids?.length && !body.data.mes_pagamento)) {
      return reply.status(400).send({ status: 'error', message: 'Informe ids ou mes_pagamento' });
    }
    const where: any = { estagio: 'CONFIRMADA' };
    if (body.data.ids?.length) where.id = { in: body.data.ids };
    if (body.data.mes_pagamento) where.mes_pagamento = body.data.mes_pagamento;
    const r = await prisma.comissao.updateMany({
      where, data: { estagio: 'PAGA', status: 'PAGA', paga_em: new Date() } as any,
    });
    return reply.send({ status: 'success', data: { pagas: r.count } });
  });

  // ===== EXTRATO DE COMISSÕES =====
  fastify.get('/comissoes', async (request, reply) => {
    const query = z.object({
      responsavel_id: z.string().optional(),
      periodo: z.string().optional(),
      status: z.string().optional()
    }).safeParse(request.query);

    const where: any = {};
    if (query.data?.periodo) where.periodo = query.data.periodo;
    if (query.data?.status) where.status = query.data.status;
    // Escopo: vendedor só vê a própria comissão (ignora responsavel_id de outro);
    // gestor vê todas (ou filtra por responsavel_id da query).
    const scopeId = scopeUserId(request);
    if (scopeId !== null) where.responsavel_id = scopeId;
    else if (query.data?.responsavel_id) where.responsavel_id = query.data.responsavel_id;

    const comissoesRaw = await prisma.comissao.findMany({
      where,
      include: { regra: true },
      orderBy: { created_at: 'desc' }
    });
    // Anexa a razão social do cliente e o NOME do responsável (vendedor/supervisão)
    // de cada comissão — em vez de mostrar o id ou "system".
    const clienteDe = await mapaClientes(comissoesRaw as any[]);
    const respIds = [...new Set(comissoesRaw.map((c: any) => c.responsavel_id).filter(Boolean))];
    const nomeDe: Record<string, string> = {};
    if (respIds.length) {
      const us: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, nome FROM UsuarioCRM WHERE id IN (${respIds.map(() => '?').join(',')})`, ...respIds
      ).catch(() => []);
      us.forEach(u => { nomeDe[u.id] = u.nome; });
    }
    const comissoes = comissoesRaw.map((c: any) => ({
      ...c,
      cliente: clienteDe[c.referencia_id || ''] || null,
      responsavel_nome: nomeDe[c.responsavel_id] || null,
    }));

    // Agrupado por responsável
    const por_responsavel = comissoes.reduce((acc: any, c) => {
      if (!acc[c.responsavel_id]) {
        acc[c.responsavel_id] = { responsavel_id: c.responsavel_id, responsavel_nome: nomeDe[c.responsavel_id] || null, total: 0, pendente: 0, pago: 0, count: 0 };
      }
      acc[c.responsavel_id].total += c.valor_comissao;
      acc[c.responsavel_id].count += 1;
      if (c.status === 'PAGA') acc[c.responsavel_id].pago += c.valor_comissao;
      else if (c.status === 'PENDENTE' || c.status === 'APROVADA') acc[c.responsavel_id].pendente += c.valor_comissao;
      return acc;
    }, {});

    return reply.send({
      status: 'success',
      data: {
        comissoes,
        resumo: Object.values(por_responsavel),
        totais: {
          total: comissoes.reduce((s, c) => s + c.valor_comissao, 0),
          pendente: comissoes.filter(c => c.status === 'PENDENTE').reduce((s, c) => s + c.valor_comissao, 0),
          pago: comissoes.filter(c => c.status === 'PAGA').reduce((s, c) => s + c.valor_comissao, 0)
        }
      }
    });
  });

  fastify.post('/comissoes', async (request, reply) => {
    const body = z.object({
      responsavel_id: z.string(),
      tipo: z.enum(['CONTRATO', 'PROPOSTA', 'LEAD', 'MANUAL', 'BONUS']).default('MANUAL'),
      referencia_id: z.string().optional(),
      descricao: z.string().optional(),
      valor_base: z.number().min(0),
      percentual: z.number().min(0).max(100),
      periodo: z.string(),
      regra_id: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const valor_comissao = body.data.valor_base * (body.data.percentual / 100);
    const comissao = await prisma.comissao.create({
      data: { ...body.data, valor_comissao }
    });
    return reply.status(201).send({ status: 'success', data: comissao });
  });

  fastify.patch('/comissoes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      status: z.enum(['PENDENTE', 'APROVADA', 'PAGA', 'CANCELADA']).optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    try {
      const comissao = await prisma.comissao.update({ where: { id }, data: body.data });
      return reply.send({ status: 'success', data: comissao });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Comissão não encontrada' });
      throw err;
    }
  });

  // Auto-calcular comissões de contratos do mês
  fastify.post('/comissoes/calcular-mes', async (request, reply) => {
    const body = z.object({ periodo: z.string() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Período inválido (formato YYYY-MM)' });

    const { periodo } = body.data;
    const [ano, mes] = periodo.split('-').map(Number);
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0, 23, 59, 59);

    // Buscar contratos criados no período
    const contratos = await prisma.contrato.findMany({
      where: { created_at: { gte: inicio, lte: fim }, status: 'ATIVO' },
      include: { lead: { select: { responsavel_id: true } } }
    });

    // Buscar regras ativas
    const regras = await prisma.regraComissao.findMany({ where: { ativo: true, tipo: 'CONTRATO' } });

    let criadas = 0;
    for (const contrato of contratos) {
      const responsavel_id = contrato.lead?.responsavel_id;
      if (!responsavel_id) continue;

      const regra = regras.find(r => r.responsavel_id === responsavel_id) || regras[0];
      if (!regra) continue;

      const existente = await prisma.comissao.findFirst({
        where: { referencia_id: contrato.id, tipo: 'CONTRATO', periodo }
      });
      if (existente) continue;

      await prisma.comissao.create({
        data: {
          responsavel_id,
          regra_id: regra.id,
          tipo: 'CONTRATO',
          referencia_id: contrato.id,
          descricao: `Contrato #${contrato.numero || contrato.id.slice(-6)}`,
          valor_base: contrato.valor,
          percentual: regra.percentual,
          valor_comissao: contrato.valor * (regra.percentual / 100),
          periodo
        }
      });
      criadas++;
    }

    return reply.send({ status: 'success', data: { criadas, periodo } });
  });

  // ===== INDICAÇÕES =====
  fastify.get('/indicacoes', async (request, reply) => {
    const query = z.object({ status: z.string().optional() }).safeParse(request.query);
    const where: any = {};
    if (query.data?.status) where.status = query.data.status;

    const indicacoes = await prisma.indicacao.findMany({
      where,
      include: {
        cliente_indicador: { select: { id: true, nome: true, empresa: true } },
        lead: { select: { id: true, nome: true, status: true, valor_estimado: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    const stats = {
      total: indicacoes.length,
      convertidas: indicacoes.filter(i => i.status === 'CONVERTIDO').length,
      pendentes: indicacoes.filter(i => i.status === 'PENDENTE').length,
      bonus_total: indicacoes.filter(i => i.bonus_pago).reduce((s, i) => s + i.bonus_valor, 0)
    };

    return reply.send({ status: 'success', data: { indicacoes, stats } });
  });

  fastify.post('/indicacoes', async (request, reply) => {
    const body = z.object({
      cliente_indicador_id: z.string(),
      nome_indicado: z.string().min(1),
      email_indicado: z.string().email().optional(),
      telefone_indicado: z.string().optional(),
      empresa_indicado: z.string().optional(),
      bonus_valor: z.number().default(0),
      observacoes: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const indicacao = await prisma.indicacao.create({ data: body.data });
    return reply.status(201).send({ status: 'success', data: indicacao });
  });

  fastify.patch('/indicacoes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      status: z.enum(['PENDENTE', 'CONTATO', 'CONVERTIDO', 'PERDIDO']).optional(),
      lead_id: z.string().optional(),
      bonus_pago: z.boolean().optional(),
      bonus_valor: z.number().optional(),
      observacoes: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    try {
      const indicacao = await prisma.indicacao.update({ where: { id }, data: body.data });
      return reply.send({ status: 'success', data: indicacao });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Indicação não encontrada' });
      throw err;
    }
  });
}
