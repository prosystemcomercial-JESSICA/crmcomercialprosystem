import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export async function servicosRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // ===== PLANOS DE SERVIÇO =====
  fastify.get('/catalogo', async (request, reply) => {
    const query = z.object({
      segmento: z.string().optional(),
      ativo: z.coerce.boolean().optional()
    }).safeParse(request.query);

    const where: any = {};
    if (query.data?.segmento) where.segmento = query.data.segmento;
    if (query.data?.ativo !== undefined) where.ativo = query.data.ativo;

    const planos = await prisma.planoServico.findMany({
      where,
      orderBy: { preco: 'asc' },
      include: { _count: { select: { licencas: true } } }
    });

    return reply.send({ status: 'success', data: planos });
  });

  fastify.post('/catalogo', async (request, reply) => {
    const body = z.object({
      nome: z.string().min(1),
      descricao: z.string().optional(),
      segmento: z.enum(['FARMACIA', 'PADARIA', 'VAREJO', 'GERAL']).default('GERAL'),
      preco: z.number().min(0),
      recorrencia: z.enum(['MENSAL', 'ANUAL', 'UNICO']).default('MENSAL'),
      features: z.array(z.string()).default([])
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const plano = await prisma.planoServico.create({ data: body.data });
    return reply.status(201).send({ status: 'success', data: plano });
  });

  fastify.patch('/catalogo/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      nome: z.string().optional(),
      descricao: z.string().optional(),
      preco: z.number().optional(),
      ativo: z.boolean().optional(),
      features: z.array(z.string()).optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    try {
      const plano = await prisma.planoServico.update({ where: { id }, data: body.data });
      return reply.send({ status: 'success', data: plano });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Plano não encontrado' });
      throw err;
    }
  });

  fastify.delete('/catalogo/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.planoServico.delete({ where: { id } });
      return reply.send({ status: 'success' });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Plano não encontrado' });
      throw err;
    }
  });

  // ===== LICENÇAS =====
  fastify.get('/licencas', async (request, reply) => {
    const query = z.object({
      status: z.string().optional(),
      cliente_id: z.string().optional(),
      page: z.coerce.number().default(0),
      limit: z.coerce.number().default(20)
    }).safeParse(request.query);

    const { status, cliente_id, page, limit } = query.data || { page: 0, limit: 20 };
    const where: any = {};
    if (status) where.status = status;
    if (cliente_id) where.cliente_id = cliente_id;

    const [licencas, total] = await Promise.all([
      prisma.licenca.findMany({
        where,
        include: {
          cliente: { select: { id: true, nome: true, empresa: true, email: true } },
          plano: { select: { id: true, nome: true, segmento: true } },
          _count: { select: { tickets: true, renovacoes: true } }
        },
        orderBy: { created_at: 'desc' },
        skip: page * limit,
        take: limit
      }),
      prisma.licenca.count({ where })
    ]);

    // Stats
    const [ativas, expirando, expiradas] = await Promise.all([
      prisma.licenca.count({ where: { status: 'ATIVA' } }),
      prisma.licenca.count({
        where: {
          status: 'ATIVA',
          data_fim: { gt: new Date(), lt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.licenca.count({ where: { status: 'EXPIRADA' } })
    ]);

    return reply.send({ status: 'success', data: { licencas, total, stats: { ativas, expirando, expiradas } } });
  });

  fastify.post('/licencas', async (request, reply) => {
    const body = z.object({
      cliente_id: z.string(),
      plano_id: z.string().optional(),
      valor: z.number().min(0),
      data_inicio: z.string(),
      data_fim: z.string().optional(),
      responsavel_id: z.string().optional(),
      observacoes: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const { data_inicio, data_fim, ...rest } = body.data;
    const licenca = await prisma.licenca.create({
      data: {
        ...rest,
        data_inicio: new Date(data_inicio),
        data_fim: data_fim ? new Date(data_fim) : undefined
      },
      include: {
        cliente: { select: { id: true, nome: true, empresa: true } },
        plano: { select: { id: true, nome: true } }
      }
    });

    return reply.status(201).send({ status: 'success', data: licenca });
  });

  fastify.patch('/licencas/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      status: z.enum(['ATIVA', 'SUSPENSA', 'EXPIRADA', 'CANCELADA']).optional(),
      valor: z.number().optional(),
      data_fim: z.string().optional(),
      observacoes: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const { data_fim, ...rest } = body.data;
    try {
      const licenca = await prisma.licenca.update({
        where: { id },
        data: { ...rest, ...(data_fim ? { data_fim: new Date(data_fim) } : {}) }
      });
      return reply.send({ status: 'success', data: licenca });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Licença não encontrada' });
      throw err;
    }
  });

  // ===== ONBOARDING =====
  fastify.get('/onboardings', async (request, reply) => {
    const query = z.object({ status: z.string().optional() }).safeParse(request.query);
    const where: any = {};
    if (query.data?.status) where.status = query.data.status;

    const onboardings = await prisma.onboarding.findMany({
      where,
      include: {
        licenca: {
          include: {
            cliente: { select: { id: true, nome: true, empresa: true } },
            plano: { select: { nome: true } }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    return reply.send({ status: 'success', data: onboardings });
  });

  fastify.post('/onboardings', async (request, reply) => {
    const body = z.object({
      licenca_id: z.string(),
      cliente_id: z.string(),
      responsavel_id: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const etapas_padrao = [
      { titulo: 'Reunião de kickoff', concluido: false, data_conclusao: null },
      { titulo: 'Levantamento de dados', concluido: false, data_conclusao: null },
      { titulo: 'Configuração do sistema', concluido: false, data_conclusao: null },
      { titulo: 'Migração de dados', concluido: false, data_conclusao: null },
      { titulo: 'Treinamento da equipe', concluido: false, data_conclusao: null },
      { titulo: 'Testes e homologação', concluido: false, data_conclusao: null },
      { titulo: 'Go-live', concluido: false, data_conclusao: null },
      { titulo: 'Acompanhamento pós-implantação', concluido: false, data_conclusao: null }
    ];

    const onboarding = await prisma.onboarding.create({
      data: { ...body.data, etapas: etapas_padrao }
    });

    return reply.status(201).send({ status: 'success', data: onboarding });
  });

  fastify.patch('/onboardings/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      status: z.enum(['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'PAUSADO']).optional(),
      etapas: z.array(z.any()).optional(),
      progresso: z.number().min(0).max(100).optional(),
      responsavel_id: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const data: any = { ...body.data };
    if (body.data.etapas) {
      const total = body.data.etapas.length;
      const concluidas = body.data.etapas.filter((e: any) => e.concluido).length;
      data.progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;
      if (data.progresso === 100) data.status = 'CONCLUIDO';
      else if (data.progresso > 0) data.status = 'EM_ANDAMENTO';
    }

    try {
      const onboarding = await prisma.onboarding.update({ where: { id }, data });
      return reply.send({ status: 'success', data: onboarding });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Onboarding não encontrado' });
      throw err;
    }
  });

  // ===== RENOVAÇÕES =====
  fastify.get('/renovacoes', async (request, reply) => {
    const query = z.object({
      status: z.string().optional(),
      dias: z.coerce.number().default(90)
    }).safeParse(request.query);
    const { status, dias } = query.data || { dias: 90 };

    const where: any = {};
    if (status) where.status = status;

    const renovacoes = await prisma.renovacao.findMany({
      where,
      include: {
        licenca: {
          include: {
            cliente: { select: { id: true, nome: true, empresa: true, email: true } },
            plano: { select: { nome: true, segmento: true } }
          }
        }
      },
      orderBy: { data_vencimento: 'asc' }
    });

    const agora = new Date();
    const resultado = renovacoes.map(r => ({
      ...r,
      dias_para_vencer: Math.floor((new Date(r.data_vencimento).getTime() - agora.getTime()) / 86400000)
    }));

    const stats = {
      total: resultado.length,
      pendentes: resultado.filter(r => r.status === 'PENDENTE').length,
      criticas: resultado.filter(r => r.dias_para_vencer <= 15 && r.status === 'PENDENTE').length,
      renovadas: resultado.filter(r => r.status === 'RENOVADA').length
    };

    return reply.send({ status: 'success', data: { renovacoes: resultado, stats } });
  });

  fastify.post('/renovacoes', async (request, reply) => {
    const body = z.object({
      licenca_id: z.string(),
      data_vencimento: z.string(),
      valor_atual: z.number(),
      valor_novo: z.number().optional(),
      responsavel_id: z.string().optional(),
      observacoes: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const { data_vencimento, ...rest } = body.data;
    const renovacao = await prisma.renovacao.create({
      data: { ...rest, data_vencimento: new Date(data_vencimento) }
    });

    return reply.status(201).send({ status: 'success', data: renovacao });
  });

  fastify.patch('/renovacoes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      status: z.enum(['PENDENTE', 'EM_NEGOCIACAO', 'RENOVADA', 'CANCELADA', 'PERDIDA']).optional(),
      valor_novo: z.number().optional(),
      observacoes: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    try {
      const renovacao = await prisma.renovacao.update({ where: { id }, data: body.data });
      return reply.send({ status: 'success', data: renovacao });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Renovação não encontrada' });
      throw err;
    }
  });

  // ===== TICKETS DE SUPORTE =====
  fastify.get('/tickets', async (request, reply) => {
    const query = z.object({
      status: z.string().optional(),
      prioridade: z.string().optional(),
      cliente_id: z.string().optional(),
      page: z.coerce.number().default(0),
      limit: z.coerce.number().default(20)
    }).safeParse(request.query);

    const { status, prioridade, cliente_id, page, limit } = query.data || { page: 0, limit: 20 };
    const where: any = {};
    if (status) where.status = status;
    if (prioridade) where.prioridade = prioridade;
    if (cliente_id) where.cliente_id = cliente_id;

    const [tickets, total] = await Promise.all([
      prisma.ticketSuporte.findMany({
        where,
        include: {
          cliente: { select: { id: true, nome: true, empresa: true } },
          licenca: { include: { plano: { select: { nome: true } } } }
        },
        orderBy: [{ prioridade: 'desc' }, { created_at: 'desc' }],
        skip: page * limit,
        take: limit
      }),
      prisma.ticketSuporte.count({ where })
    ]);

    const stats = await prisma.ticketSuporte.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    return reply.send({ status: 'success', data: { tickets, total, stats } });
  });

  fastify.post('/tickets', async (request, reply) => {
    const body = z.object({
      cliente_id: z.string(),
      licenca_id: z.string().optional(),
      titulo: z.string().min(1),
      descricao: z.string().optional(),
      categoria: z.enum(['TECNICO', 'FISCAL', 'COMERCIAL', 'FINANCEIRO', 'TREINAMENTO']).default('TECNICO'),
      prioridade: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'CRITICA']).default('MEDIA'),
      responsavel_id: z.string().optional(),
      sla_horas: z.number().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const ticket = await prisma.ticketSuporte.create({
      data: body.data,
      include: {
        cliente: { select: { id: true, nome: true, empresa: true } }
      }
    });

    return reply.status(201).send({ status: 'success', data: ticket });
  });

  fastify.patch('/tickets/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      status: z.enum(['ABERTO', 'EM_ATENDIMENTO', 'AGUARDANDO_CLIENTE', 'RESOLVIDO', 'FECHADO']).optional(),
      prioridade: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'CRITICA']).optional(),
      responsavel_id: z.string().optional(),
      resolucao_at: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const data: any = { ...body.data };
    if (body.data.resolucao_at) data.resolucao_at = new Date(body.data.resolucao_at);
    if (body.data.status === 'RESOLVIDO' && !data.resolucao_at) data.resolucao_at = new Date();

    try {
      const ticket = await prisma.ticketSuporte.update({ where: { id }, data });
      return reply.send({ status: 'success', data: ticket });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Ticket não encontrado' });
      throw err;
    }
  });
}
