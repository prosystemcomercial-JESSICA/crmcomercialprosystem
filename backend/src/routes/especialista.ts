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
    const q = request.query as { status?: string; agente?: string };
    const dono = q.agente === 'mila' ? { origem: 'mila' } : { OR: [{ origem: null }, { origem: { not: 'mila' } }] };
    const docs = await prisma.especialistaDoc.findMany({
      where: { AND: [q.status ? { status: q.status } : { status: { not: 'ARQUIVADO' } }, dono] },
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

  // Mila (CS): estudo de retenção e experiência do cliente sob demanda.
  fastify.post('/especialista/mila/estudar', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const b = z.object({ tema: z.string().max(200).optional().nullable() }).safeParse(request.body || {});
    const { estudarRetencao } = await import('../services/especialista.service');
    const ok = emSegundoPlano('mila', () => estudarRetencao(prisma, b.success ? b.data.tema || null : null));
    return reply.send({ status: 'success', message: ok ? 'A Mila começou a estudar retenção. Os documentos aparecem aqui em alguns minutos.' : 'A Mila já está estudando.' });
  });

  // Treinamento: o Rafael lê as conversas do agente, gera relatório + conversa de treino + regras.
  fastify.post('/especialista/treinar', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const b = z.object({ agente: z.enum(['luiz_felipe', 'julio', 'caroline']).default('luiz_felipe') }).safeParse(request.body || {});
    const agente = b.success ? b.data.agente : 'luiz_felipe';
    const { treinarAgente } = await import('../services/especialista.service');
    const ok = emSegundoPlano(`treino_${agente}`, () => treinarAgente(prisma, agente));
    return reply.send({ status: 'success', message: ok ? 'O Rafael chamou o agente para o treinamento (2 a 3 minutos). O relatório e a conversa aparecem aqui.' : 'O treinamento já está acontecendo.' });
  });

  fastify.get('/especialista/treinamentos', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const docs = await prisma.especialistaDoc.findMany({
      where: { tipo: 'TREINAMENTO', status: { not: 'ARQUIVADO' } }, orderBy: { created_at: 'desc' }, take: 10,
      select: { id: true, titulo: true, agente_alvo: true, status: true, fontes: true, created_at: true },
    });
    return reply.send({ status: 'success', data: { treinamentos: docs.map(d => ({ ...d, dialogo: (d.fontes as any)?.dialogo || [], regras: (d.fontes as any)?.regras || [], fontes: undefined })), em_andamento: [...emAndamento].filter(x => x.startsWith('treino_')) } });
  });

  // Olívia (concorrentes): pesquisa na internet e entrega para o Rafael.
  fastify.post('/especialista/concorrentes', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const b = z.object({ foco: z.string().max(200).optional().nullable() }).safeParse(request.body || {});
    const { pesquisarConcorrentes } = await import('../services/especialista.service');
    const ok = emSegundoPlano('concorrentes', () => pesquisarConcorrentes(prisma, b.success ? b.data.foco || null : null));
    return reply.send({ status: 'success', message: ok ? 'A Olívia começou a pesquisar a concorrência (alguns minutos).' : 'A Olívia já está pesquisando.' });
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
