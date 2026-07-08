import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireGestor } from '@/lib/scope';

export async function kbRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // ─── CATEGORIAS ─────────────────────────────────────────────────────────────

  fastify.get('/kb/categorias', async (request, reply) => {
    const cats = await prisma.kbCategoria.findMany({
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      include: { filhas: { orderBy: [{ ordem: 'asc' }, { nome: 'asc' }] } },
    });
    // retorna apenas raízes (parent_id null) com filhas embutidas
    const raizes = cats.filter(c => !c.parent_id);
    return reply.send({ status: 'success', data: raizes });
  });

  fastify.post('/kb/categorias', { preHandler: [requireGestor] }, async (request, reply) => {
    const body = z.object({
      nome: z.string().min(1),
      descricao: z.string().optional(),
      icone: z.string().optional(),
      ordem: z.number().optional(),
      parent_id: z.string().nullable().optional(),
    }).parse(request.body);
    const cat = await prisma.kbCategoria.create({ data: body });
    return reply.send({ status: 'success', data: cat });
  });

  fastify.patch('/kb/categorias/:id', { preHandler: [requireGestor] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      nome: z.string().optional(),
      descricao: z.string().optional(),
      icone: z.string().optional(),
      ordem: z.number().optional(),
      parent_id: z.string().nullable().optional(),
    }).parse(request.body);
    const cat = await prisma.kbCategoria.update({ where: { id }, data: body });
    return reply.send({ status: 'success', data: cat });
  });

  fastify.delete('/kb/categorias/:id', { preHandler: [requireGestor] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.kbCategoria.delete({ where: { id } });
    return reply.send({ status: 'success' });
  });

  // ─── ARTIGOS ────────────────────────────────────────────────────────────────

  fastify.get('/kb/artigos', async (request, reply) => {
    const q = z.object({
      status:       z.string().optional(),
      visibilidade: z.string().optional(),
      categoria_id: z.string().optional(),
      busca:        z.string().optional(),
      page:         z.coerce.number().default(0),
      limit:        z.coerce.number().default(30),
    }).parse(request.query);

    const where: any = {};
    if (q.status)       where.status       = q.status;
    if (q.visibilidade) where.visibilidade = q.visibilidade;
    if (q.categoria_id) where.categoria_id = q.categoria_id;
    if (q.busca) {
      where.OR = [
        { titulo:   { contains: q.busca } },
        { resumo:   { contains: q.busca } },
        { conteudo: { contains: q.busca } },
        { tags:     { contains: q.busca } },
      ];
    }

    const [artigos, total] = await Promise.all([
      prisma.kbArtigo.findMany({
        where,
        include: { categoria: { select: { id: true, nome: true, icone: true } } },
        orderBy: { updated_at: 'desc' },
        skip: q.page * q.limit,
        take: q.limit,
      }),
      prisma.kbArtigo.count({ where }),
    ]);

    return reply.send({ status: 'success', data: { artigos, total } });
  });

  fastify.get('/kb/artigos/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const artigo = await prisma.kbArtigo.findUnique({
      where: { id },
      include: { categoria: true },
    });
    if (!artigo) return reply.status(404).send({ status: 'error', message: 'Artigo não encontrado' });

    // incrementa views de forma assíncrona (não bloqueia resposta)
    prisma.kbArtigo.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {});

    return reply.send({ status: 'success', data: artigo });
  });

  fastify.post('/kb/artigos', { preHandler: [requireGestor] }, async (request, reply) => {
    const user = (request as any).user;
    const body = z.object({
      titulo:       z.string().min(1),
      conteudo:     z.string(),
      resumo:       z.string().optional(),
      categoria_id: z.string().nullable().optional(),
      status:       z.string().default('RASCUNHO'),
      visibilidade: z.string().default('INTERNO'),
      tags:         z.array(z.string()).optional(),
    }).parse(request.body);

    const artigo = await prisma.kbArtigo.create({
      data: {
        ...body,
        tags: body.tags ? JSON.stringify(body.tags) : null,
        autor_id:   user?.id,
        autor_nome: user?.nome || user?.name,
      },
    });
    return reply.send({ status: 'success', data: artigo });
  });

  fastify.patch('/kb/artigos/:id', { preHandler: [requireGestor] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      titulo:       z.string().optional(),
      conteudo:     z.string().optional(),
      resumo:       z.string().optional(),
      categoria_id: z.string().nullable().optional(),
      status:       z.string().optional(),
      visibilidade: z.string().optional(),
      tags:         z.array(z.string()).optional(),
    }).parse(request.body);

    const data: any = { ...body };
    if (body.tags !== undefined) data.tags = JSON.stringify(body.tags);

    const artigo = await prisma.kbArtigo.update({ where: { id }, data });
    return reply.send({ status: 'success', data: artigo });
  });

  fastify.delete('/kb/artigos/:id', { preHandler: [requireGestor] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.kbArtigo.delete({ where: { id } });
    return reply.send({ status: 'success' });
  });

  // Feedback útil/não-útil (sem auth — qualquer técnico vota)
  fastify.post('/kb/artigos/:id/feedback', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { util } = z.object({ util: z.boolean() }).parse(request.body);
    await prisma.kbArtigo.update({
      where: { id },
      data: util ? { util_sim: { increment: 1 } } : { util_nao: { increment: 1 } },
    });
    return reply.send({ status: 'success' });
  });
}
