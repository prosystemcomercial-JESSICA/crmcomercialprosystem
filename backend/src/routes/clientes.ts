import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const CreateClienteSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  telefone: z.string().optional(),
  empresa: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional()
});

const UpdateClienteSchema = CreateClienteSchema.partial();

const ListClienteSchema = z.object({
  page: z.coerce.number().default(0),
  limit: z.coerce.number().default(20),
  search: z.string().optional()
});

export async function clientesRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // List clientes
  fastify.get('/clientes', async (request, reply) => {
    const query = ListClienteSchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ status: 'error', message: 'Invalid query', errors: query.error.errors });
    }
    const { page, limit, search } = query.data;

    const where = search ? {
      OR: [
        { nome: { contains: search, mode: 'insensitive' as const } },
        { empresa: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } }
      ]
    } : {};

    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          _count: { select: { caso_churn: true } }
        }
      }),
      prisma.cliente.count({ where })
    ]);

    return reply.send({
      status: 'success',
      data: { clientes, total, page, limit }
    });
  });

  // Get cliente by id
  fastify.get('/clientes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        caso_churn: {
          orderBy: { created_at: 'desc' },
          take: 5
        },
        _count: { select: { caso_churn: true } }
      }
    });
    if (!cliente) return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });
    return reply.send({ status: 'success', data: cliente });
  });

  // Create cliente
  fastify.post('/clientes', async (request, reply) => {
    const body = CreateClienteSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });
    }

    try {
      const cliente = await prisma.cliente.create({ data: body.data });
      return reply.status(201).send({ status: 'success', data: cliente });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(409).send({ status: 'error', message: 'Email já cadastrado' });
      }
      throw err;
    }
  });

  // Update cliente
  fastify.patch('/clientes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateClienteSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });
    }

    try {
      const cliente = await prisma.cliente.update({ where: { id }, data: body.data });
      return reply.send({ status: 'success', data: cliente });
    } catch (err: any) {
      if (err.code === 'P2025') {
        return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });
      }
      throw err;
    }
  });

  // Delete cliente
  fastify.delete('/clientes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.cliente.delete({ where: { id } });
      return reply.send({ status: 'success', message: 'Cliente removido' });
    } catch (err: any) {
      if (err.code === 'P2025') {
        return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });
      }
      throw err;
    }
  });
}
