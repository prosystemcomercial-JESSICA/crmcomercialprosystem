import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { getUser, requireGestor } from '../lib/scope';

// Joana (jornalista): edições do Informativo Prosystem. Ela escreve; a gestão aprova (e aí sai).
export async function joanaRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;
  let escrevendo = false;

  fastify.get('/joana/edicoes', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const eds = await prisma.especialistaDoc.findMany({
      where: { origem: 'joana', status: { not: 'ARQUIVADO' } }, orderBy: { created_at: 'desc' }, take: 12,
      select: { id: true, titulo: true, status: true, conteudo: true, fontes: true, created_at: true, decidido_em: true },
    });
    return reply.send({
      status: 'success',
      data: {
        escrevendo,
        edicoes: eds.map(e => {
          const f: any = e.fontes || {};
          const env = f.envio;
          return { id: e.id, titulo: e.titulo, status: e.status, conteudo: e.conteudo, criado_em: e.created_at, decidido_em: e.decidido_em, edicao: f.edicao || null,
            envio: env ? { total: env.total, enviados: env.enviados, falhas: env.falhas, whatsapp: env.whatsapp } : null };
        }),
      },
    });
  });

  fastify.post('/joana/escrever', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    if (escrevendo) return reply.send({ status: 'success', message: 'A Joana já está escrevendo.' });
    escrevendo = true;
    const { escreverInformativo } = await import('../services/joana.service');
    escreverInformativo(prisma).catch((e: any) => console.error('[JOANA]', e?.message)).finally(() => { escrevendo = false; });
    return reply.send({ status: 'success', message: 'A Joana começou a escrever o Informativo (1 a 2 minutos).' });
  });

  fastify.post('/joana/edicoes/:id/aprovar', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const { aprovarInformativo } = await import('../services/joana.service');
    try {
      const r = await aprovarInformativo(prisma, id, getUser(request)?.id || 'gestao');
      return reply.send({ status: 'success', message: `Aprovado! ${r.emails} e-mail(s) saem em lotes nos dias úteis e ${r.whatsapp} WhatsApp vão pelo Zequinha no ritmo seguro.` });
    } catch (e: any) {
      return reply.status(400).send({ status: 'error', message: e?.message || 'Não foi possível aprovar.' });
    }
  });

  fastify.post('/joana/edicoes/:id/arquivar', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    await prisma.especialistaDoc.updateMany({ where: { id, origem: 'joana', status: 'PROPOSTO' }, data: { status: 'ARQUIVADO', decidido_por: getUser(request)?.id || null, decidido_em: new Date() } });
    return reply.send({ status: 'success', message: 'Edição arquivada. Nada foi enviado.' });
  });
}
