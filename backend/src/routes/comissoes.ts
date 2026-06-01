import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { scopeUserId } from '@/lib/scope';

export async function comissoesRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

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

    const comissoes = await prisma.comissao.findMany({
      where,
      include: { regra: true },
      orderBy: { created_at: 'desc' }
    });

    // Agrupado por responsável
    const por_responsavel = comissoes.reduce((acc: any, c) => {
      if (!acc[c.responsavel_id]) {
        acc[c.responsavel_id] = { responsavel_id: c.responsavel_id, total: 0, pendente: 0, pago: 0, count: 0 };
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
