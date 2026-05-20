import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const CreateAtividadeSchema = z.object({
  lead_id: z.string().min(1),
  tipo: z.enum(['LIGACAO', 'EMAIL', 'REUNIAO', 'WHATSAPP', 'VISITA', 'TAREFA', 'OUTRO']),
  titulo: z.string().min(1),
  descricao: z.string().optional(),
  responsavel_id: z.string().optional(),
  data_prevista: z.string().datetime().optional()
});

const UpdateAtividadeSchema = z.object({
  titulo: z.string().optional(),
  descricao: z.string().optional(),
  status: z.enum(['PENDENTE', 'CONCLUIDA', 'CANCELADA']).optional(),
  resultado: z.string().optional(),
  data_prevista: z.string().datetime().optional(),
  data_realizada: z.string().datetime().optional(),
  responsavel_id: z.string().optional()
});

const ListAtividadeSchema = z.object({
  page: z.coerce.number().default(0),
  limit: z.coerce.number().default(30),
  status: z.string().optional(),
  tipo: z.string().optional(),
  responsavel_id: z.string().optional(),
  lead_id: z.string().optional()
});

export async function atividadesRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // List all atividades
  fastify.get('/atividades', async (request, reply) => {
    const query = ListAtividadeSchema.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ status: 'error', message: 'Invalid query' });
    const { page, limit, status, tipo, responsavel_id, lead_id } = query.data;

    const where: any = {};
    if (status) where.status = status;
    if (tipo) where.tipo = tipo;
    if (responsavel_id) where.responsavel_id = responsavel_id;
    if (lead_id) where.lead_id = lead_id;

    const [atividades, total] = await Promise.all([
      prisma.atividade.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: [{ data_prevista: 'asc' }, { created_at: 'desc' }],
        include: {
          lead: { select: { id: true, nome: true, empresa: true } }
        }
      }),
      prisma.atividade.count({ where })
    ]);

    return reply.send({ status: 'success', data: { atividades, total, page, limit } });
  });

  // Create atividade
  fastify.post('/atividades', async (request, reply) => {
    const body = CreateAtividadeSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    const user = (request as any).user;
    const data: any = { ...body.data, created_by: user?.id || 'system' };
    if (data.data_prevista) data.data_prevista = new Date(data.data_prevista);

    const atividade = await prisma.atividade.create({
      data,
      include: { lead: { select: { id: true, nome: true, empresa: true } } }
    });
    return reply.status(201).send({ status: 'success', data: atividade });
  });

  // Update atividade
  fastify.patch('/atividades/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateAtividadeSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    try {
      const data: any = { ...body.data };
      if (data.data_prevista) data.data_prevista = new Date(data.data_prevista);
      if (data.data_realizada) data.data_realizada = new Date(data.data_realizada);
      const atividade = await prisma.atividade.update({ where: { id }, data });
      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // Delete atividade
  fastify.delete('/atividades/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.atividade.delete({ where: { id } });
      return reply.send({ status: 'success', message: 'Atividade removida' });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // Agenda — atividades pendentes por data
  fastify.get('/atividades/agenda', async (request, reply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const atividades = await prisma.atividade.findMany({
      where: {
        status: 'PENDENTE',
        data_prevista: { gte: today, lte: nextWeek }
      },
      orderBy: { data_prevista: 'asc' },
      include: {
        lead: { select: { id: true, nome: true, empresa: true } }
      }
    });

    return reply.send({ status: 'success', data: atividades });
  });
}
