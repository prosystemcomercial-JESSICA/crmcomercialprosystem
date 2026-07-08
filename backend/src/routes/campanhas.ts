import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const CampanhaFieldsSchema = {
  nome: z.string().min(1),
  descricao: z.string().optional(),
  data_inicio: z.string().datetime(),
  data_fim: z.string().datetime(),
  nicho: z.string().optional(),
  plano_alvo: z.string().optional(),
  mensalidade: z.number().optional(),
  valor_setup: z.number().optional(),
  setup_condicao: z.string().optional(),
  condicao_especial: z.string().optional(),
  meta_contratos: z.number().int().optional(),
  meta_receita: z.number().optional(),
};

const CreateCampanhaSchema = z.object(CampanhaFieldsSchema);

const UpdateCampanhaSchema = z.object({
  ...Object.fromEntries(
    Object.entries(CampanhaFieldsSchema).map(([k, v]) => [k, (v as any).optional()])
  ),
  status: z.enum(['RASCUNHO', 'ATIVA', 'PAUSADA', 'FINALIZADA', 'ARQUIVADA']).optional(),
});

const ListCampanhaSchema = z.object({
  page: z.coerce.number().default(0),
  limit: z.coerce.number().default(20),
  status: z.string().optional()
});

export async function campanhasRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // List campanhas
  fastify.get('/campanhas', async (request, reply) => {
    const query = ListCampanhaSchema.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ status: 'error', message: 'Invalid query' });
    const { page, limit, status } = query.data;

    const where = status ? { status } : {};
    const [campanhas, total] = await Promise.all([
      prisma.campanha.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          _count: { select: { disparos: true, acoes: true } }
        }
      }),
      prisma.campanha.count({ where })
    ]);

    return reply.send({ status: 'success', data: { campanhas, total, page, limit } });
  });

  // Get campanha by id
  fastify.get('/campanhas/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const campanha = await prisma.campanha.findUnique({
      where: { id },
      include: {
        acoes: { orderBy: { ordem: 'asc' } },
        _count: { select: { disparos: true } }
      }
    });
    if (!campanha) return reply.status(404).send({ status: 'error', message: 'Campanha não encontrada' });
    return reply.send({ status: 'success', data: campanha });
  });

  // Cargos autorizados a gerenciar campanhas
  const PODE_GERENCIAR = ['CEO', 'ADMIN', 'SUPERVISAO', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA', 'GERENTE', 'DIRETOR'];
  const checkGestor = (request: any, reply: any): boolean => {
    const user = (request as any).user;
    if (!user || !PODE_GERENCIAR.includes((user.role || '').toUpperCase())) {
      reply.status(403).send({ status: 'error', message: 'Apenas CEO, Diretor e Supervisores podem gerenciar campanhas' });
      return false;
    }
    return true;
  };

  // Create campanha — só gestores
  fastify.post('/campanhas', async (request, reply) => {
    if (!checkGestor(request, reply)) return;
    const body = CreateCampanhaSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    const user = (request as any).user;
    const campanha = await prisma.campanha.create({
      data: {
        ...body.data,
        data_inicio: new Date(body.data.data_inicio),
        data_fim: new Date(body.data.data_fim),
        created_by: user?.id || 'system'
      }
    });
    return reply.status(201).send({ status: 'success', data: campanha });
  });

  // Update campanha — só gestores
  fastify.patch('/campanhas/:id', async (request, reply) => {
    if (!checkGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = UpdateCampanhaSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    try {
      const data: any = { ...body.data };
      if (data.data_inicio) data.data_inicio = new Date(data.data_inicio);
      if (data.data_fim) data.data_fim = new Date(data.data_fim);
      const campanha = await prisma.campanha.update({ where: { id }, data });
      return reply.send({ status: 'success', data: campanha });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Campanha não encontrada' });
      throw err;
    }
  });

  // Delete campanha — só gestores
  fastify.delete('/campanhas/:id', async (request, reply) => {
    if (!checkGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    try {
      await prisma.campanha.delete({ where: { id } });
      return reply.send({ status: 'success', message: 'Campanha removida' });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Campanha não encontrada' });
      throw err;
    }
  });

  // Stats
  fastify.get('/campanhas/stats/resumo', async (request, reply) => {
    const [total, ativas, finalizadas, rascunhos] = await Promise.all([
      prisma.campanha.count(),
      prisma.campanha.count({ where: { status: 'ATIVA' } }),
      prisma.campanha.count({ where: { status: 'FINALIZADA' } }),
      prisma.campanha.count({ where: { status: 'RASCUNHO' } })
    ]);

    const totalDisparos = await prisma.campanhaDisparo.count();

    return reply.send({
      status: 'success',
      data: { total, ativas, finalizadas, rascunhos, totalDisparos }
    });
  });
}
