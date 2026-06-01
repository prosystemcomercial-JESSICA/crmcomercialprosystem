import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { scopeUserId, requireGestor } from '@/lib/scope';

const CreateMetaSchema = z.object({
  titulo: z.string().min(1),
  responsavel_id: z.string().min(1),
  tipo: z.enum(['RECEITA', 'LEADS', 'PROPOSTAS', 'CONTRATOS', 'ATIVIDADES']),
  valor_alvo: z.number().min(0),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, 'Formato: YYYY-MM')
});

const UpdateMetaSchema = z.object({
  titulo: z.string().optional(),
  valor_alvo: z.number().optional(),
  valor_atual: z.number().optional(),
  status: z.enum(['ATIVA', 'CONCLUIDA', 'CANCELADA']).optional()
});

export async function metasRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  fastify.get('/metas', async (request, reply) => {
    const query = z.object({
      periodo: z.string().optional(),
      responsavel_id: z.string().optional(),
      tipo: z.string().optional()
    }).safeParse(request.query);
    if (!query.success) return reply.status(400).send({ status: 'error', message: 'Invalid query' });
    const { periodo, responsavel_id, tipo } = query.data;

    const where: any = {};
    if (periodo) where.periodo = periodo;
    if (tipo) where.tipo = tipo;
    // Escopo: vendedor só vê a própria meta; gestor vê todas (ou filtra por responsavel_id).
    const scopeId = scopeUserId(request);
    if (scopeId !== null) where.responsavel_id = scopeId;
    else if (responsavel_id) where.responsavel_id = responsavel_id;

    const metas = await prisma.meta.findMany({
      where,
      orderBy: [{ periodo: 'desc' }, { created_at: 'desc' }]
    });

    return reply.send({ status: 'success', data: metas });
  });

  fastify.post('/metas', async (request, reply) => {
    const body = CreateMetaSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    const user = (request as any).user;
    const meta = await prisma.meta.create({
      data: { ...body.data, created_by: user?.id || 'system' }
    });
    return reply.status(201).send({ status: 'success', data: meta });
  });

  fastify.patch('/metas/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateMetaSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    try {
      const meta = await prisma.meta.update({ where: { id }, data: body.data });
      return reply.send({ status: 'success', data: meta });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Meta não encontrada' });
      throw err;
    }
  });

  fastify.delete('/metas/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.meta.delete({ where: { id } });
      return reply.send({ status: 'success', message: 'Meta removida' });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Meta não encontrada' });
      throw err;
    }
  });

  // Ranking — vendedores com mais contratos/leads ganhos no período
  fastify.get('/metas/ranking', async (request, reply) => {
    if (!requireGestor(request, reply)) return;  // ranking só p/ supervisão
    const query = z.object({
      periodo: z.string().optional()
    }).safeParse(request.query);
    const periodo = query.data?.periodo;

    const where: any = {};
    if (periodo) {
      const [year, month] = periodo.split('-');
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      where.created_at = { gte: start, lte: end };
    }

    const [leadsGanhos, propostasAceitas, contratos] = await Promise.all([
      prisma.lead.groupBy({
        by: ['responsavel_id'],
        where: { ...where, status: 'GANHO', responsavel_id: { not: null } },
        _count: { _all: true },
        _sum: { valor_estimado: true }
      }),
      prisma.proposta.groupBy({
        by: ['created_by'],
        where: { ...where, status: 'ACEITA' },
        _count: { _all: true },
        _sum: { valor: true }
      }),
      prisma.contrato.groupBy({
        by: ['created_by'],
        where: { ...where, status: 'ATIVO' },
        _count: { _all: true },
        _sum: { valor: true }
      })
    ]);

    // Merge by responsavel_id/created_by
    const rankingMap: Record<string, any> = {};

    leadsGanhos.forEach(l => {
      const id = l.responsavel_id!;
      if (!rankingMap[id]) rankingMap[id] = { responsavel_id: id, leads_ganhos: 0, propostas_aceitas: 0, contratos: 0, valor_total: 0 };
      rankingMap[id].leads_ganhos = l._count._all;
      rankingMap[id].valor_total += l._sum.valor_estimado || 0;
    });

    propostasAceitas.forEach(p => {
      if (!rankingMap[p.created_by]) rankingMap[p.created_by] = { responsavel_id: p.created_by, leads_ganhos: 0, propostas_aceitas: 0, contratos: 0, valor_total: 0 };
      rankingMap[p.created_by].propostas_aceitas = p._count._all;
      rankingMap[p.created_by].valor_total += p._sum.valor || 0;
    });

    contratos.forEach(c => {
      if (!rankingMap[c.created_by]) rankingMap[c.created_by] = { responsavel_id: c.created_by, leads_ganhos: 0, propostas_aceitas: 0, contratos: 0, valor_total: 0 };
      rankingMap[c.created_by].contratos = c._count._all;
    });

    const ranking = Object.values(rankingMap)
      .sort((a, b) => b.valor_total - a.valor_total)
      .map((r, i) => ({ ...r, posicao: i + 1 }));

    return reply.send({ status: 'success', data: ranking });
  });
}
