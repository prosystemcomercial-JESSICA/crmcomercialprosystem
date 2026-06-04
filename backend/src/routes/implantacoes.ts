import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireGestor } from '@/lib/scope';
import { confirmarImplantacao } from '@/lib/comissao-fluxo';

/**
 * Acompanhamento de implantação. Cada implantação nasce de um contrato ASSINADO.
 * A supervisão informa a data de instalação e o 1º vencimento da mensalidade →
 * o sistema define o mês de pagamento da comissão (1º vencimento + 1 mês) e move
 * as comissões do contrato para CONFIRMADA.
 */
export async function implantacoesRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // LISTA (com filtro por status)
  fastify.get('/implantacoes', async (request, reply) => {
    const q = (request.query as any) || {};
    const where: any = {};
    if (q.status) where.status = q.status;
    const implantacoes = await prisma.implantacao.findMany({
      where, orderBy: [{ status: 'asc' }, { data_assinatura: 'desc' }],
    });
    const resumo = {
      aguardando: implantacoes.filter(i => i.status === 'AGUARDANDO_INSTALACAO').length,
      agendada:   implantacoes.filter(i => i.status === 'AGENDADA').length,
      instalado:  implantacoes.filter(i => i.status === 'INSTALADO').length,
      total:      implantacoes.length,
    };
    return reply.send({ status: 'success', data: { implantacoes, resumo } });
  });

  // INFORMAR datas / status (só supervisão/CEO) → recalcula mês de pagamento da comissão
  fastify.patch('/implantacoes/:id', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = z.object({
      data_instalacao: z.string().optional(),
      data_primeiro_vencimento: z.string().optional(),
      data_agendada: z.string().optional(),
      status: z.enum(['AGUARDANDO_INSTALACAO', 'AGENDADA', 'INSTALADO', 'CANCELADA']).optional(),
      observacoes: z.string().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const d = body.data;
    const atualizada = await confirmarImplantacao(prisma, id, {
      data_instalacao: d.data_instalacao ? new Date(d.data_instalacao) : undefined,
      data_primeiro_vencimento: d.data_primeiro_vencimento ? new Date(d.data_primeiro_vencimento) : undefined,
      data_agendada: d.data_agendada ? new Date(d.data_agendada) : undefined,
      status: d.status,
      observacoes: d.observacoes,
    });
    if (!atualizada) return reply.status(404).send({ status: 'error', message: 'Implantação não encontrada' });
    return reply.send({ status: 'success', data: atualizada });
  });
}
