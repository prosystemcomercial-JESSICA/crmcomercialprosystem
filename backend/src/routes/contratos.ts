import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const ListContratoSchema = z.object({
  page: z.coerce.number().default(0),
  limit: z.coerce.number().default(20),
  status: z.string().optional(),
  recorrencia: z.string().optional()
});

const UpdateContratoSchema = z.object({
  status: z.enum(['ATIVO', 'SUSPENSO', 'CANCELADO', 'ENCERRADO']).optional(),
  recorrencia: z.enum(['UNICO', 'MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL']).optional(),
  valor: z.number().optional(),
  data_fim: z.string().datetime().optional(),
  observacoes: z.string().optional()
});

const DeleteContratoSchema = z.object({
  motivo: z.string().optional()
});

// Filtro padrão: nunca retorna excluídos
const NAO_EXCLUIDO = { deleted_at: null };

export async function contratosRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  fastify.get('/contratos', async (request, reply) => {
    const query = ListContratoSchema.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ status: 'error', message: 'Invalid query' });
    const { page, limit, status, recorrencia } = query.data;

    const where: any = { ...NAO_EXCLUIDO };
    if (status) where.status = status;
    if (recorrencia) where.recorrencia = recorrencia;

    const [contratos, total] = await Promise.all([
      prisma.contrato.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          lead: { select: { id: true, nome: true, empresa: true, telefone: true, email: true } },
          proposta: { select: { id: true, titulo: true, valor: true } }
        }
      }),
      prisma.contrato.count({ where })
    ]);

    return reply.send({ status: 'success', data: { contratos, total, page, limit } });
  });

  fastify.get('/contratos/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const contrato = await prisma.contrato.findFirst({
      where: { id, ...NAO_EXCLUIDO },
      include: { lead: true, proposta: true }
    });
    if (!contrato) return reply.status(404).send({ status: 'error', message: 'Contrato não encontrado' });
    return reply.send({ status: 'success', data: contrato });
  });

  fastify.patch('/contratos/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateContratoSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    // Garante que não atualiza contrato excluído
    const existe = await prisma.contrato.findFirst({ where: { id, ...NAO_EXCLUIDO } });
    if (!existe) return reply.status(404).send({ status: 'error', message: 'Contrato não encontrado' });

    try {
      const data: any = { ...body.data };
      if (data.data_fim) data.data_fim = new Date(data.data_fim);
      const contrato = await prisma.contrato.update({ where: { id }, data });
      return reply.send({ status: 'success', data: contrato });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Contrato não encontrado' });
      throw err;
    }
  });

  // Soft-delete — registra exclusão sem remover do banco
  fastify.delete('/contratos/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = DeleteContratoSchema.safeParse(request.body || {});
    const motivo = body.success ? (body.data.motivo || 'Excluído pelo usuário') : 'Excluído pelo usuário';

    const existe = await prisma.contrato.findFirst({ where: { id, ...NAO_EXCLUIDO } });
    if (!existe) return reply.status(404).send({ status: 'error', message: 'Contrato não encontrado' });

    const user = (request as any).user;
    const deletedBy = user?.nome || user?.id || 'sistema';

    await prisma.contrato.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        deleted_by: deletedBy,
        motivo_exclusao: motivo
      } as any
    });

    fastify.log.info(`[AUDITORIA] Contrato ${id} (nº ${existe.numero || '-'}) excluído por "${deletedBy}" — motivo: ${motivo}`);

    return reply.send({
      status: 'success',
      message: 'Contrato excluído e registrado em auditoria',
      data: {
        id,
        numero: existe.numero,
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        motivo
      }
    });
  });

  fastify.get('/contratos/stats/resumo', async (request, reply) => {
    const [total, ativos, suspensos, cancelados, encerrados] = await Promise.all([
      prisma.contrato.count({ where: { ...NAO_EXCLUIDO } }),
      prisma.contrato.count({ where: { status: 'ATIVO', ...NAO_EXCLUIDO } }),
      prisma.contrato.count({ where: { status: 'SUSPENSO', ...NAO_EXCLUIDO } }),
      prisma.contrato.count({ where: { status: 'CANCELADO', ...NAO_EXCLUIDO } }),
      prisma.contrato.count({ where: { status: 'ENCERRADO', ...NAO_EXCLUIDO } })
    ]);

    const mrr = await prisma.contrato.aggregate({
      _sum: { valor: true },
      where: { status: 'ATIVO', recorrencia: 'MENSAL', ...NAO_EXCLUIDO }
    });

    const arr = await prisma.contrato.aggregate({
      _sum: { valor: true },
      where: { status: 'ATIVO', recorrencia: 'ANUAL', ...NAO_EXCLUIDO }
    });

    return reply.send({
      status: 'success',
      data: {
        total, ativos, suspensos, cancelados, encerrados,
        mrr: mrr._sum.valor || 0,
        arr: (arr._sum.valor || 0) + ((mrr._sum.valor || 0) * 12)
      }
    });
  });

  // Auditoria — lista contratos excluídos (acesso restrito)
  fastify.get('/contratos/auditoria/excluidos', async (request, reply) => {
    const excluidos = await prisma.contrato.findMany({
      where: { deleted_at: { not: null } },
      orderBy: { deleted_at: 'desc' },
      select: {
        id: true, numero: true, valor: true, status: true,
        deleted_at: true, deleted_by: true, motivo_exclusao: true, created_at: true,
        lead: { select: { nome: true, empresa: true } }
      }
    });
    return reply.send({ status: 'success', data: excluidos });
  });
}
