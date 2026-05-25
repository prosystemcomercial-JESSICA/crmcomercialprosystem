import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const DEFAULT_COLUMNS = [
  { chave: 'NOVO_LEAD',          nome: 'Novo Lead',           cor: '#6b7280', ordem: 0,  fixa: true },
  { chave: 'PRIMEIRO_CONTATO',   nome: 'Primeiro Contato',    cor: '#2563eb', ordem: 1,  fixa: true },
  { chave: 'EM_ATENDIMENTO',     nome: 'Em Atendimento',      cor: '#7c3aed', ordem: 2,  fixa: false },
  { chave: 'AGUARDANDO_RETORNO', nome: 'Aguardando Retorno',  cor: '#d97706', ordem: 3,  fixa: false },
  { chave: 'PROPOSTA_A_GERAR',   nome: 'Proposta a Gerar',    cor: '#0891b2', ordem: 4,  fixa: false },
  { chave: 'PROPOSTA_ENVIADA',   nome: 'Proposta Enviada',    cor: '#4B8EC8', ordem: 5,  fixa: false },
  { chave: 'EM_NEGOCIACAO',      nome: 'Em Negociação',       cor: '#dc2626', ordem: 6,  fixa: false },
  { chave: 'FECHADO',            nome: 'Fechado',             cor: '#15803d', ordem: 7,  fixa: true },
  { chave: 'PERDIDO',            nome: 'Perdido',             cor: '#9ca3af', ordem: 8,  fixa: true },
];

export async function kanbanColunasRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Seed default columns if none exist
  fastify.addHook('onReady', async () => {
    const count = await prisma.kanbanColuna.count();
    if (count === 0) {
      await prisma.kanbanColuna.createMany({
        data: DEFAULT_COLUMNS.map(c => ({ ...c, created_by: 'system' })),
        skipDuplicates: true,
      });
    }
  });

  fastify.get('/kanban-colunas', async (_req, reply) => {
    const colunas = await prisma.kanbanColuna.findMany({
      where: { ativa: true },
      orderBy: { ordem: 'asc' },
    });
    return reply.send({ status: 'success', data: colunas });
  });

  fastify.get('/kanban-colunas/todas', async (_req, reply) => {
    const colunas = await prisma.kanbanColuna.findMany({ orderBy: { ordem: 'asc' } });
    return reply.send({ status: 'success', data: colunas });
  });

  fastify.post('/kanban-colunas', async (request, reply) => {
    const body = z.object({
      nome:  z.string().min(1),
      cor:   z.string().default('#6b7280'),
      ordem: z.number().int().default(99),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const user = (request as any).user;
    const chave = body.data.nome.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/__+/g, '_');
    const coluna = await prisma.kanbanColuna.create({
      data: { chave, ...body.data, created_by: user?.id || 'system' },
    });
    return reply.status(201).send({ status: 'success', data: coluna });
  });

  fastify.patch('/kanban-colunas/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      nome:  z.string().optional(),
      cor:   z.string().optional(),
      ordem: z.number().int().optional(),
      ativa: z.boolean().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const col = await prisma.kanbanColuna.update({ where: { id }, data: body.data });
    return reply.send({ status: 'success', data: col });
  });

  fastify.delete('/kanban-colunas/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const col = await prisma.kanbanColuna.findUnique({ where: { id } });
    if (!col) return reply.status(404).send({ status: 'error', message: 'Coluna não encontrada' });
    if (col.fixa) return reply.status(400).send({ status: 'error', message: 'Coluna fixa não pode ser excluída' });
    await prisma.kanbanColuna.delete({ where: { id } });
    return reply.send({ status: 'success', message: 'Coluna removida' });
  });
}
