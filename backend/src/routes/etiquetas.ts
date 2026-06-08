import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const DEFAULT_ETIQUETAS = [
  { nome: 'Farmácia',            cor: '#0891b2' },
  { nome: 'Padaria',             cor: '#d97706' },
  { nome: 'Plano Plus',          cor: '#7c3aed' },
  { nome: 'Plano Pro',           cor: '#2563eb' },
  { nome: 'Migração',            cor: '#dc2626' },
  { nome: 'Nova implantação',    cor: '#16a34a' },
  { nome: 'Upgrade',             cor: '#0891b2' },
  { nome: 'Cliente antigo',      cor: '#6b7280' },
  { nome: 'Campanha Meta',       cor: '#1877f2' },
  { nome: 'Indicação',           cor: '#f59e0b' },
  { nome: 'Urgente',             cor: '#dc2626' },
  { nome: 'Precisa retorno',     cor: '#d97706' },
  { nome: 'Aguardando documentos', cor: '#6b7280' },
  { nome: 'Pediu desconto',      cor: '#7c3aed' },
];

export async function etiquetasRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Seed default tags
  fastify.addHook('onReady', async () => {
    const count = await prisma.etiqueta.count();
    if (count === 0) {
      await prisma.etiqueta.createMany({
        data: DEFAULT_ETIQUETAS.map(e => ({ ...e, created_by: 'system' })),
        skipDuplicates: true,
      });
    }
  });

  fastify.get('/etiquetas', async (request, reply) => {
    const { tipo } = request.query as { tipo?: string };
    const etiquetas = await prisma.etiqueta.findMany({
      where: { ativa: true, ...(tipo ? { tipo } : {}) },
      orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
    });
    return reply.send({ status: 'success', data: etiquetas });
  });

  fastify.post('/etiquetas', async (request, reply) => {
    const body = z.object({
      nome:      z.string().min(1),
      cor:       z.string().default('#4B8EC8'),
      descricao: z.string().optional(),
      tipo:      z.enum(['LEAD', 'CLIENTE', 'PARCEIRO']).default('LEAD'),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const user = (request as any).user;
    const etiqueta = await prisma.etiqueta.create({ data: { ...body.data, created_by: user?.id || 'system' } });
    return reply.status(201).send({ status: 'success', data: etiqueta });
  });

  fastify.patch('/etiquetas/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      nome:      z.string().optional(),
      cor:       z.string().optional(),
      descricao: z.string().optional(),
      ativa:     z.boolean().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const et = await prisma.etiqueta.update({ where: { id }, data: body.data });
    return reply.send({ status: 'success', data: et });
  });

  fastify.delete('/etiquetas/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.etiqueta.update({ where: { id }, data: { ativa: false } });
    return reply.send({ status: 'success', message: 'Etiqueta desativada' });
  });

  // Apply / remove etiqueta from lead
  fastify.post('/leads/:leadId/etiquetas/:etiquetaId', async (request, reply) => {
    const { leadId, etiquetaId } = request.params as { leadId: string; etiquetaId: string };
    try {
      await prisma.leadEtiquetaAplicada.create({ data: { lead_id: leadId, etiqueta_id: etiquetaId } });
    } catch { /* already applied */ }
    return reply.send({ status: 'success' });
  });

  fastify.delete('/leads/:leadId/etiquetas/:etiquetaId', async (request, reply) => {
    const { leadId, etiquetaId } = request.params as { leadId: string; etiquetaId: string };
    await prisma.leadEtiquetaAplicada.deleteMany({ where: { lead_id: leadId, etiqueta_id: etiquetaId } });
    return reply.send({ status: 'success' });
  });
}
