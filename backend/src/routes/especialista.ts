import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getUser, requireGestor } from '../lib/scope';

// Rafael (especialista em vendas de software): documentos, aprovação e ações sob demanda.
// Estudo/abordagem pesquisam na internet e levam alguns minutos: rodam em segundo plano.
export async function especialistaRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;
  const emAndamento = new Set<string>();
  const emSegundoPlano = (nome: string, fn: () => Promise<any>) => {
    if (emAndamento.has(nome)) return false;
    emAndamento.add(nome);
    fn().catch((e: any) => console.error(`[RAFAEL] ${nome}:`, e?.message)).finally(() => emAndamento.delete(nome));
    return true;
  };

  fastify.get('/especialista/docs', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = request.query as { status?: string };
    const docs = await prisma.especialistaDoc.findMany({
      where: q.status ? { status: q.status } : { status: { not: 'ARQUIVADO' } },
      orderBy: [{ status: 'desc' }, { created_at: 'desc' }], take: 150,
    });
    return reply.send({ status: 'success', data: { docs, em_andamento: [...emAndamento] } });
  });

  fastify.post('/especialista/estudar', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const b = z.object({ tema: z.string().max(200).optional().nullable() }).safeParse(request.body || {});
    const { estudarVendas } = await import('../services/especialista.service');
    const ok = emSegundoPlano('estudo', () => estudarVendas(prisma, b.success ? b.data.tema || null : null));
    return reply.send({ status: 'success', message: ok ? 'O Rafael começou a estudar. Os documentos aparecem aqui em alguns minutos.' : 'O Rafael já está estudando.' });
  });

  fastify.post('/especialista/revisar', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { revisarConversas } = await import('../services/especialista.service');
    const ok = emSegundoPlano('revisao', () => revisarConversas(prisma));
    return reply.send({ status: 'success', message: ok ? 'O Rafael está revisando as conversas das últimas 48 h (1 a 2 minutos).' : 'A revisão já está em andamento.' });
  });

  fastify.post('/especialista/abordagem', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { proporAbordagem } = await import('../services/especialista.service');
    const ok = emSegundoPlano('abordagem', () => proporAbordagem(prisma));
    return reply.send({ status: 'success', message: ok ? 'O Rafael está preparando a nova abordagem inicial (alguns minutos).' : 'Já está preparando.' });
  });

  fastify.post('/especialista/docs/:id/decidir', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const b = z.object({ aprovar: z.boolean() }).safeParse(request.body);
    if (!b.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos.' });
    const { decidirDoc } = await import('../services/especialista.service');
    try {
      const d = await decidirDoc(prisma, id, b.data.aprovar, getUser(request)!.id);
      return reply.send({ status: 'success', data: d, message: b.data.aprovar ? (d.tipo === 'ABORDAGEM' ? 'Aprovada: o agente já usa a nova abordagem.' : 'Aprovado: agora é parâmetro do setor.') : 'Arquivado.' });
    } catch (e: any) { return reply.status(400).send({ status: 'error', message: e?.message || 'Falhou.' }); }
  });

  fastify.get('/especialista/caderno', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { cadernoRafael } = await import('../services/especialista.service');
    reply.header('Content-Type', 'text/markdown; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="caderno-do-rafael.md"');
    return reply.send(await cadernoRafael(prisma));
  });
}
