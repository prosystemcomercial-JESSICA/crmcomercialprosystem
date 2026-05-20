import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '@/middleware/auth';
import { PlanoRetencaoService, AcaoRetencaoService } from '@/services/retencao.service';
import {
  CreatePlanoRetencaoSchema,
  UpdatePlanoRetencaoSchema,
  CreateAcaoRetencaoSchema,
  UpdateAcaoRetencaoSchema
} from '@/types/dto';

export async function retencaoRoutes(
  fastify: FastifyInstance,
  options: { prisma: PrismaClient }
) {
  const { prisma } = options;
  const planoService = new PlanoRetencaoService(prisma);
  const acaoService = new AcaoRetencaoService(prisma);

  // ===== PLANOS DE RETENÇÃO =====

  // Create retention plan
  fastify.post<{ Params: { casoId: string } }>(
    '/casos/:casoId/planos',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])] },
    async (request, reply) => {
      try {
        const { casoId } = request.params;
        const data = CreatePlanoRetencaoSchema.parse(request.body);
        const userId = request.user.id;

        const plano = await planoService.create(casoId, data, userId);

        return reply.status(201).send({
          status: 'success',
          data: plano
        });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            status: 'error',
            message: 'Validation error',
            errors: error.errors
          });
        }

        if (error.message.includes('não encontrado')) {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        throw error;
      }
    }
  );

  // List retention plans for a caso
  fastify.get<{ Params: { casoId: string } }>(
    '/casos/:casoId/planos',
    { onRequest: requireAuth },
    async (request, reply) => {
      try {
        const { casoId } = request.params;
        const planos = await planoService.list(casoId);

        return reply.status(200).send({
          status: 'success',
          data: planos
        });
      } catch (error) {
        throw error;
      }
    }
  );

  // Get retention plan by ID
  fastify.get<{ Params: { planoId: string } }>(
    '/planos/:planoId',
    { onRequest: requireAuth },
    async (request, reply) => {
      try {
        const { planoId } = request.params;
        const plano = await planoService.getById(planoId);

        return reply.status(200).send({
          status: 'success',
          data: plano
        });
      } catch (error: any) {
        if (error.message.includes('não encontrado')) {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        throw error;
      }
    }
  );

  // Update retention plan
  fastify.patch<{ Params: { planoId: string } }>(
    '/planos/:planoId',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])] },
    async (request, reply) => {
      try {
        const { planoId } = request.params;
        const data = UpdatePlanoRetencaoSchema.parse(request.body);

        const plano = await planoService.update(planoId, data);

        return reply.status(200).send({
          status: 'success',
          data: plano
        });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            status: 'error',
            message: 'Validation error',
            errors: error.errors
          });
        }

        if (error.message.includes('não encontrado')) {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        throw error;
      }
    }
  );

  // Activate retention plan
  fastify.post<{ Params: { planoId: string } }>(
    '/planos/:planoId/ativar',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])] },
    async (request, reply) => {
      try {
        const { planoId } = request.params;
        const plano = await planoService.ativar(planoId);

        return reply.status(200).send({
          status: 'success',
          data: plano
        });
      } catch (error: any) {
        if (error.message.includes('não encontrado')) {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        throw error;
      }
    }
  );

  // Conclude retention plan
  fastify.post<{ Params: { planoId: string } }>(
    '/planos/:planoId/concluir',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])] },
    async (request, reply) => {
      try {
        const { planoId } = request.params;
        const plano = await planoService.concluir(planoId);

        return reply.status(200).send({
          status: 'success',
          data: plano
        });
      } catch (error: any) {
        if (error.message.includes('não encontrado')) {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        throw error;
      }
    }
  );

  // Delete retention plan
  fastify.delete<{ Params: { planoId: string } }>(
    '/planos/:planoId',
    { onRequest: [requireAuth, requireRole(['CEO'])] },
    async (request, reply) => {
      try {
        const { planoId } = request.params;
        await planoService.delete(planoId);

        return reply.status(204).send();
      } catch (error: any) {
        if (error.message.includes('não encontrado')) {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        throw error;
      }
    }
  );

  // ===== AÇÕES DE RETENÇÃO =====

  // Create retention action
  fastify.post<{ Params: { casoId: string } }>(
    '/casos/:casoId/acoes',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO', 'TECNICO'])] },
    async (request, reply) => {
      try {
        const { casoId } = request.params;
        const data = CreateAcaoRetencaoSchema.parse(request.body);
        const userId = request.user.id;

        const acao = await acaoService.create(casoId, {
          ...data,
          data_vencimento: data.data_vencimento ? new Date(data.data_vencimento) : undefined
        }, userId);

        return reply.status(201).send({
          status: 'success',
          data: acao
        });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            status: 'error',
            message: 'Validation error',
            errors: error.errors
          });
        }

        if (error.message.includes('não encontrado')) {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        if (error.message.includes('inválido')) {
          return reply.status(400).send({
            status: 'error',
            message: error.message
          });
        }

        throw error;
      }
    }
  );

  // List retention actions for a caso
  fastify.get<{ Params: { casoId: string }; Querystring: { status?: string } }>(
    '/casos/:casoId/acoes',
    { onRequest: requireAuth },
    async (request, reply) => {
      try {
        const { casoId } = request.params;
        const { status } = request.query;
        const acoes = await acaoService.list(casoId, status);

        return reply.status(200).send({
          status: 'success',
          data: acoes
        });
      } catch (error) {
        throw error;
      }
    }
  );

  // Get retention action by ID
  fastify.get<{ Params: { acaoId: string } }>(
    '/acoes/:acaoId',
    { onRequest: requireAuth },
    async (request, reply) => {
      try {
        const { acaoId } = request.params;
        const acao = await acaoService.getById(acaoId);

        return reply.status(200).send({
          status: 'success',
          data: acao
        });
      } catch (error: any) {
        if (error.message.includes('não encontrada')) {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        throw error;
      }
    }
  );

  // Update retention action
  fastify.patch<{ Params: { acaoId: string } }>(
    '/acoes/:acaoId',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO', 'TECNICO'])] },
    async (request, reply) => {
      try {
        const { acaoId } = request.params;
        const data = UpdateAcaoRetencaoSchema.parse(request.body);

        const acao = await acaoService.update(acaoId, {
          ...data,
          data_vencimento: data.data_vencimento ? new Date(data.data_vencimento) : undefined
        });

        return reply.status(200).send({
          status: 'success',
          data: acao
        });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            status: 'error',
            message: 'Validation error',
            errors: error.errors
          });
        }

        if (error.message.includes('não encontrada')) {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        if (error.message.includes('inválido')) {
          return reply.status(400).send({
            status: 'error',
            message: error.message
          });
        }

        throw error;
      }
    }
  );

  // Mark action as in progress
  fastify.post<{ Params: { acaoId: string } }>(
    '/acoes/:acaoId/progresso',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO', 'TECNICO'])] },
    async (request, reply) => {
      try {
        const { acaoId } = request.params;
        const acao = await acaoService.marcarEmProgresso(acaoId);

        return reply.status(200).send({
          status: 'success',
          data: acao
        });
      } catch (error: any) {
        if (error.message.includes('não encontrada')) {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        throw error;
      }
    }
  );

  // Conclude retention action
  fastify.post<{ Params: { acaoId: string } }>(
    '/acoes/:acaoId/concluir',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO', 'TECNICO'])] },
    async (request, reply) => {
      try {
        const { acaoId } = request.params;
        const acao = await acaoService.concluir(acaoId);

        return reply.status(200).send({
          status: 'success',
          data: acao
        });
      } catch (error: any) {
        if (error.message.includes('não encontrada')) {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        throw error;
      }
    }
  );

  // Cancel retention action
  fastify.post<{ Params: { acaoId: string } }>(
    '/acoes/:acaoId/cancelar',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])] },
    async (request, reply) => {
      try {
        const { acaoId } = request.params;
        const acao = await acaoService.cancelar(acaoId);

        return reply.status(200).send({
          status: 'success',
          data: acao
        });
      } catch (error: any) {
        if (error.message.includes('não encontrada')) {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        throw error;
      }
    }
  );

  // Get action timeline for a caso
  fastify.get<{ Params: { casoId: string } }>(
    '/casos/:casoId/timeline',
    { onRequest: requireAuth },
    async (request, reply) => {
      try {
        const { casoId } = request.params;
        const timeline = await acaoService.getTimeline(casoId);

        return reply.status(200).send({
          status: 'success',
          data: timeline
        });
      } catch (error) {
        throw error;
      }
    }
  );

  // Delete retention action
  fastify.delete<{ Params: { acaoId: string } }>(
    '/acoes/:acaoId',
    { onRequest: [requireAuth, requireRole(['CEO'])] },
    async (request, reply) => {
      try {
        const { acaoId } = request.params;
        await acaoService.delete(acaoId);

        return reply.status(204).send();
      } catch (error: any) {
        if (error.message.includes('não encontrada')) {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        throw error;
      }
    }
  );
}
