import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getUser, requireGestor } from '../lib/scope';

// Heitor (prospectador): painel, liga/desliga, cotas e rodada sob demanda (em segundo plano).
export async function heitorRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  fastify.get('/heitor/painel', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { painelHeitor } = await import('../services/heitor.service');
    return reply.send({ status: 'success', data: await painelHeitor(prisma) });
  });

  fastify.post('/heitor/config', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const b = z.object({
      ativo: z.boolean().optional(),
      cadastros_dia: z.number().int().min(1).max(60).optional(),
      envios_dia: z.number().int().min(0).max(30).optional(),
      segmentos: z.array(z.enum(['farmacia', 'padaria'])).min(1).optional(),
    }).safeParse(request.body || {});
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos.' });
    const { salvarConfigHeitor } = await import('../services/heitor.service');
    const cfg = await salvarConfigHeitor(prisma, b.data, getUser(request)?.id || 'gestao');
    return reply.send({ status: 'success', data: cfg, message: cfg.ativo ? 'Heitor ligado.' : 'Heitor desligado.' });
  });

  fastify.post('/heitor/rodar', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { rodadaHeitor, heitorRodando } = await import('../services/heitor.service');
    if (heitorRodando()) return reply.send({ status: 'success', message: 'O Heitor já está trabalhando.' });
    rodadaHeitor(prisma).catch((e: any) => console.error('[HEITOR]', e?.message));
    return reply.send({ status: 'success', message: 'O Heitor começou a buscar. Cada bairro leva alguns minutos; os leads aparecem aqui.' });
  });
}
