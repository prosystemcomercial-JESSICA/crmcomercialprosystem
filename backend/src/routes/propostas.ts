import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const CreatePropostaSchema = z.object({
  lead_id: z.string().min(1),
  titulo: z.string().min(1),
  descricao: z.string().optional(),
  valor: z.number().min(0),
  validade: z.string().datetime().optional(),
  produtos: z.array(z.object({
    nome: z.string(),
    qtd: z.number(),
    valor_unit: z.number()
  })).optional(),
  condicoes: z.string().optional(),
  observacoes: z.string().optional()
});

const UpdatePropostaSchema = z.object({
  titulo: z.string().optional(),
  descricao: z.string().optional(),
  valor: z.number().min(0).optional(),
  status: z.enum(['RASCUNHO', 'ENVIADA', 'VISUALIZADA', 'ACEITA', 'RECUSADA', 'EXPIRADA']).optional(),
  validade: z.string().datetime().optional(),
  produtos: z.any().optional(),
  condicoes: z.string().optional(),
  observacoes: z.string().optional()
});

const ListPropostaSchema = z.object({
  page: z.coerce.number().default(0),
  limit: z.coerce.number().default(20),
  status: z.string().optional(),
  lead_id: z.string().optional()
});

export async function propostasRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // List propostas
  fastify.get('/propostas', async (request, reply) => {
    const query = ListPropostaSchema.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ status: 'error', message: 'Invalid query' });
    const { page, limit, status, lead_id } = query.data;

    const where: any = {};
    if (status) where.status = status;
    if (lead_id) where.lead_id = lead_id;

    const [propostas, total] = await Promise.all([
      prisma.proposta.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          lead: { select: { id: true, nome: true, empresa: true } }
        }
      }),
      prisma.proposta.count({ where })
    ]);

    return reply.send({ status: 'success', data: { propostas, total, page, limit } });
  });

  // Get proposta by id
  fastify.get('/propostas/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const proposta = await prisma.proposta.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, nome: true, empresa: true, email: true, telefone: true } }
      }
    });
    if (!proposta) return reply.status(404).send({ status: 'error', message: 'Proposta não encontrada' });
    return reply.send({ status: 'success', data: proposta });
  });

  // Create proposta
  fastify.post('/propostas', async (request, reply) => {
    const body = CreatePropostaSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    const user = (request as any).user;
    const data: any = { ...body.data, created_by: user?.id || 'system' };
    if (data.validade) data.validade = new Date(data.validade);

    const proposta = await prisma.proposta.create({
      data,
      include: { lead: { select: { id: true, nome: true, empresa: true } } }
    });

    // Update lead status to PROPOSTA
    await prisma.lead.update({
      where: { id: body.data.lead_id },
      data: { status: 'PROPOSTA', etapa_funil: 'PROPOSTA' }
    });

    return reply.status(201).send({ status: 'success', data: proposta });
  });

  // Update proposta
  fastify.patch('/propostas/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdatePropostaSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    try {
      const data: any = { ...body.data };
      if (data.validade) data.validade = new Date(data.validade);

      const proposta = await prisma.proposta.update({
        where: { id },
        data,
        include: { lead: { select: { id: true, nome: true, empresa: true } } }
      });

      // Sync lead status when proposta is ACEITA
      if (body.data.status === 'ACEITA') {
        await prisma.lead.update({
          where: { id: proposta.lead_id },
          data: { status: 'GANHO', etapa_funil: 'FECHAMENTO' }
        });
      }

      return reply.send({ status: 'success', data: proposta });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Proposta não encontrada' });
      throw err;
    }
  });

  // Delete proposta
  fastify.delete('/propostas/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.proposta.delete({ where: { id } });
      return reply.send({ status: 'success', message: 'Proposta removida' });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Proposta não encontrada' });
      throw err;
    }
  });

  // Convert proposta to contrato
  fastify.post('/propostas/:id/converter-contrato', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      data_inicio: z.string().datetime(),
      data_fim: z.string().datetime().optional(),
      recorrencia: z.enum(['UNICO', 'MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL']).default('MENSAL')
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const proposta = await prisma.proposta.findUnique({ where: { id } });
    if (!proposta) return reply.status(404).send({ status: 'error', message: 'Proposta não encontrada' });

    const user = (request as any).user;

    // Update proposta to ACEITA
    await prisma.proposta.update({ where: { id }, data: { status: 'ACEITA' } });

    // Create contrato
    const contrato = await prisma.contrato.create({
      data: {
        lead_id: proposta.lead_id,
        proposta_id: id,
        valor: proposta.valor,
        produtos: proposta.produtos as any,
        recorrencia: body.data.recorrencia,
        data_inicio: new Date(body.data.data_inicio),
        data_fim: body.data.data_fim ? new Date(body.data.data_fim) : undefined,
        created_by: user?.id || 'system'
      }
    });

    // Update lead to GANHO
    await prisma.lead.update({
      where: { id: proposta.lead_id },
      data: { status: 'GANHO', etapa_funil: 'FECHAMENTO' }
    });

    return reply.status(201).send({ status: 'success', data: contrato });
  });

  // Stats
  fastify.get('/propostas/stats/resumo', async (request, reply) => {
    const [total, rascunhos, enviadas, aceitas, recusadas] = await Promise.all([
      prisma.proposta.count(),
      prisma.proposta.count({ where: { status: 'RASCUNHO' } }),
      prisma.proposta.count({ where: { status: { in: ['ENVIADA', 'VISUALIZADA'] } } }),
      prisma.proposta.count({ where: { status: 'ACEITA' } }),
      prisma.proposta.count({ where: { status: 'RECUSADA' } })
    ]);

    const valorTotal = await prisma.proposta.aggregate({ _sum: { valor: true } });
    const valorAceito = await prisma.proposta.aggregate({ _sum: { valor: true }, where: { status: 'ACEITA' } });

    return reply.send({
      status: 'success',
      data: {
        total, rascunhos, enviadas, aceitas, recusadas,
        valor_total: valorTotal._sum.valor || 0,
        valor_aceito: valorAceito._sum.valor || 0,
        taxa_aprovacao: total > 0 ? ((aceitas / total) * 100).toFixed(1) : '0'
      }
    });
  });
}
