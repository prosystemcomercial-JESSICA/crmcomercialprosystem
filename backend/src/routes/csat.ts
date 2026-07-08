import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireGestor } from '@/lib/scope';

export async function csatRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Criar survey ao fechar ticket ou concluir implantação
  fastify.post('/csat/surveys', async (request, reply) => {
    const body = z.object({
      tipo:          z.enum(['TICKET', 'IMPLANTACAO']),
      referencia_id: z.string(),
      cliente_id:    z.string().optional(),
      cliente_nome:  z.string().optional(),
    }).parse(request.body);

    const user = (request as any).user;
    const expira_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

    // idempotência: um survey por referência
    const existente = await prisma.csatSurvey.findFirst({
      where: { tipo: body.tipo, referencia_id: body.referencia_id },
    });
    if (existente) return reply.send({ status: 'success', data: existente });

    const survey = await prisma.csatSurvey.create({
      data: { ...body, expira_at, criado_por: user?.id },
    });
    return reply.send({ status: 'success', data: survey });
  });

  // Resposta pública do cliente via magic link (sem autenticação)
  fastify.get('/csat/public/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const survey = await prisma.csatSurvey.findUnique({ where: { token } });
    if (!survey) return reply.status(404).send({ status: 'error', message: 'Pesquisa não encontrada' });
    if (survey.status === 'EXPIRADO' || survey.expira_at < new Date())
      return reply.status(410).send({ status: 'error', message: 'Pesquisa expirada' });
    if (survey.status === 'RESPONDIDO')
      return reply.send({ status: 'success', data: { respondido: true } });

    return reply.send({
      status: 'success',
      data: {
        id:           survey.id,
        tipo:         survey.tipo,
        cliente_nome: survey.cliente_nome,
        respondido:   false,
      },
    });
  });

  fastify.post('/csat/public/:token/votar', async (request, reply) => {
    const { token } = request.params as { token: string };
    const body = z.object({
      nota:       z.number().int().min(1).max(5),
      comentario: z.string().optional(),
    }).parse(request.body);

    const survey = await prisma.csatSurvey.findUnique({ where: { token } });
    if (!survey) return reply.status(404).send({ status: 'error', message: 'Pesquisa não encontrada' });
    if (survey.status !== 'PENDENTE' || survey.expira_at < new Date())
      return reply.status(410).send({ status: 'error', message: 'Pesquisa expirada ou já respondida' });

    await prisma.csatSurvey.update({
      where: { token },
      data: { ...body, status: 'RESPONDIDO', respondido_at: new Date() },
    });
    return reply.send({ status: 'success' });
  });

  // Dashboard de métricas CSAT (protegido)
  fastify.get('/csat/metricas', { preHandler: [requireGestor] }, async (request, reply) => {
    const q = z.object({
      tipo:     z.string().optional(),
      de:       z.string().optional(),
      ate:      z.string().optional(),
    }).parse(request.query);

    const where: any = {};
    if (q.tipo) where.tipo = q.tipo;
    if (q.de || q.ate) {
      where.created_at = {};
      if (q.de)  where.created_at.gte = new Date(q.de);
      if (q.ate) where.created_at.lte = new Date(q.ate);
    }

    const [total, respondidos, surveys] = await Promise.all([
      prisma.csatSurvey.count({ where }),
      prisma.csatSurvey.count({ where: { ...where, status: 'RESPONDIDO' } }),
      prisma.csatSurvey.findMany({
        where: { ...where, status: 'RESPONDIDO', nota: { not: null } },
        select: { nota: true, created_at: true, tipo: true, cliente_nome: true, comentario: true, respondido_at: true },
        orderBy: { respondido_at: 'desc' },
        take: 100,
      }),
    ]);

    const notas = surveys.map(s => s.nota!);
    const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
    const distribuicao = [1, 2, 3, 4, 5].map(n => ({ nota: n, qtd: notas.filter(x => x === n).length }));
    const taxa_resposta = total > 0 ? Math.round((respondidos / total) * 100) : 0;

    return reply.send({
      status: 'success',
      data: { total, respondidos, taxa_resposta, media, distribuicao, respostas: surveys },
    });
  });

  // Lista de surveys (protegido)
  fastify.get('/csat/surveys', { preHandler: [requireGestor] }, async (request, reply) => {
    const q = z.object({
      status: z.string().optional(),
      tipo:   z.string().optional(),
      page:   z.coerce.number().default(0),
      limit:  z.coerce.number().default(50),
    }).parse(request.query);

    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.tipo)   where.tipo   = q.tipo;

    const [surveys, total] = await Promise.all([
      prisma.csatSurvey.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: q.page * q.limit,
        take: q.limit,
      }),
      prisma.csatSurvey.count({ where }),
    ]);

    return reply.send({ status: 'success', data: { surveys, total } });
  });
}
