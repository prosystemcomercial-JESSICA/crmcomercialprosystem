import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const CreateLeadSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  telefone: z.string().optional(),
  empresa: z.string().optional(),
  cargo: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  origem: z.enum(['MANUAL', 'SITE', 'INDICACAO', 'CAMPANHA', 'EVENTO', 'OUTRO']).default('MANUAL'),
  temperatura: z.enum(['FRIO', 'MORNO', 'QUENTE']).default('FRIO'),
  valor_estimado: z.number().optional(),
  probabilidade: z.number().min(0).max(100).optional(),
  responsavel_id: z.string().optional(),
  observacoes: z.string().optional()
});

const UpdateLeadSchema = z.object({
  nome: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  telefone: z.string().optional(),
  empresa: z.string().optional(),
  cargo: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  status: z.enum(['NOVO', 'QUALIFICADO', 'EM_CONTATO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO', 'NUTRICAO']).optional(),
  etapa_funil: z.enum(['PROSPECCAO', 'QUALIFICACAO', 'APRESENTACAO', 'PROPOSTA', 'NEGOCIACAO', 'FECHAMENTO']).optional(),
  temperatura: z.enum(['FRIO', 'MORNO', 'QUENTE']).optional(),
  valor_estimado: z.number().optional(),
  probabilidade: z.number().min(0).max(100).optional(),
  responsavel_id: z.string().optional(),
  observacoes: z.string().optional()
});

const ListLeadSchema = z.object({
  page: z.coerce.number().default(0),
  limit: z.coerce.number().default(20),
  status: z.string().optional(),
  etapa_funil: z.string().optional(),
  temperatura: z.string().optional(),
  search: z.string().optional(),
  responsavel_id: z.string().optional()
});

export async function leadsRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // List leads
  fastify.get('/leads', async (request, reply) => {
    const query = ListLeadSchema.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ status: 'error', message: 'Invalid query' });
    const { page, limit, status, etapa_funil, temperatura, search, responsavel_id } = query.data;

    const where: any = {};
    if (status) where.status = status;
    if (etapa_funil) where.etapa_funil = etapa_funil;
    if (temperatura) where.temperatura = temperatura;
    if (responsavel_id) where.responsavel_id = responsavel_id;
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { empresa: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { telefone: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          _count: { select: { atividades: true, propostas: true } }
        }
      }),
      prisma.lead.count({ where })
    ]);

    return reply.send({ status: 'success', data: { leads, total, page, limit } });
  });

  // Funil data — grouped by etapa
  fastify.get('/leads/funil', async (request, reply) => {
    const etapas = ['PROSPECCAO', 'QUALIFICACAO', 'APRESENTACAO', 'PROPOSTA', 'NEGOCIACAO', 'FECHAMENTO'];

    const funil = await Promise.all(
      etapas.map(async (etapa) => {
        const leads = await prisma.lead.findMany({
          where: { etapa_funil: etapa, status: { notIn: ['GANHO', 'PERDIDO'] } },
          orderBy: { created_at: 'desc' },
          include: {
            _count: { select: { atividades: true, propostas: true } }
          }
        });
        const valor_total = leads.reduce((sum, l) => sum + (l.valor_estimado || 0), 0);
        return { etapa, leads, total: leads.length, valor_total };
      })
    );

    return reply.send({ status: 'success', data: funil });
  });

  // Get lead by id
  fastify.get('/leads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        atividades: { orderBy: { created_at: 'desc' } },
        propostas: { orderBy: { created_at: 'desc' } },
        contrato: true
      }
    });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });
    return reply.send({ status: 'success', data: lead });
  });

  // Create lead
  fastify.post('/leads', async (request, reply) => {
    const body = CreateLeadSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    const user = (request as any).user;
    const data: any = { ...body.data, created_by: user?.id || 'system' };
    if (data.email === '') delete data.email;

    const lead = await prisma.lead.create({ data });
    return reply.status(201).send({ status: 'success', data: lead });
  });

  // Update lead
  fastify.patch('/leads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateLeadSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    try {
      const data: any = { ...body.data };
      if (data.email === '') delete data.email;
      const lead = await prisma.lead.update({ where: { id }, data });
      return reply.send({ status: 'success', data: lead });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });
      throw err;
    }
  });

  // Delete lead
  fastify.delete('/leads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.lead.delete({ where: { id } });
      return reply.send({ status: 'success', message: 'Lead removido' });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });
      throw err;
    }
  });

  // Stats
  fastify.get('/leads/stats/resumo', async (request, reply) => {
    const [total, novos, qualificados, ganhos, perdidos, emContato] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: 'NOVO' } }),
      prisma.lead.count({ where: { status: 'QUALIFICADO' } }),
      prisma.lead.count({ where: { status: 'GANHO' } }),
      prisma.lead.count({ where: { status: 'PERDIDO' } }),
      prisma.lead.count({ where: { status: 'EM_CONTATO' } })
    ]);

    const valorPipeline = await prisma.lead.aggregate({
      _sum: { valor_estimado: true },
      where: { status: { notIn: ['GANHO', 'PERDIDO'] } }
    });

    const valorGanho = await prisma.lead.aggregate({
      _sum: { valor_estimado: true },
      where: { status: 'GANHO' }
    });

    return reply.send({
      status: 'success',
      data: {
        total, novos, qualificados, ganhos, perdidos, emContato,
        valor_pipeline: valorPipeline._sum.valor_estimado || 0,
        valor_ganho: valorGanho._sum.valor_estimado || 0,
        taxa_conversao: total > 0 ? ((ganhos / total) * 100).toFixed(1) : '0'
      }
    });
  });
}
