import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { CasoChurnService } from '@/services/caso-churn.service';
import { requireAuth, requireRole } from '@/middleware/auth';
import { CreateCasoChurnSchema, UpdateCasoChurnSchema, ListCasoChurnSchema } from '@/types/dto';

export async function casosChurnRoutes(
  fastify: FastifyInstance,
  options: { prisma: PrismaClient }
) {
  const { prisma } = options;
  const service = new CasoChurnService(prisma);

  // POST /casos-churn — Criar novo caso
  fastify.post(
    '/casos-churn',
    {
      onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])]
    },
    async (request, reply) => {
      try {
        const body = CreateCasoChurnSchema.parse(request.body);
        const user = (request as any).user;

        const caso = await service.create(body, user.id);

        return reply.status(201).send({
          status: 'success',
          data: caso,
          message: 'Caso de churn criado com sucesso'
        });
      } catch (error: any) {
        console.error('[POST /casos-churn]', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            status: 'error',
            message: 'Validação falhou',
            errors: error.errors
          });
        }

        if (error.name === 'NotFoundError') {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        return reply.status(500).send({
          status: 'error',
          message: 'Erro ao criar caso'
        });
      }
    }
  );

  // GET /casos-churn — Listar casos com filtros
  fastify.get(
    '/casos-churn',
    { onRequest: requireAuth },
    async (request, reply) => {
      try {
        const query = ListCasoChurnSchema.parse(request.query);
        const result = await service.list(query, query.page, query.limit);

        return reply.status(200).send({
          status: 'success',
          data: result.data,
          pagination: result.pagination
        });
      } catch (error: any) {
        console.error('[GET /casos-churn]', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            status: 'error',
            message: 'Parâmetros inválidos'
          });
        }

        return reply.status(500).send({
          status: 'error',
          message: 'Erro ao listar casos'
        });
      }
    }
  );

  // GET /casos-churn/:id — Obter caso por ID
  fastify.get('/casos-churn/:id', { onRequest: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const caso = await service.getById(id);

      return reply.status(200).send({
        status: 'success',
        data: caso
      });
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        return reply.status(404).send({
          status: 'error',
          message: error.message
        });
      }

      return reply.status(500).send({
        status: 'error',
        message: 'Erro ao obter caso'
      });
    }
  });

  // PATCH /casos-churn/:id — Atualizar caso
  fastify.patch(
    '/casos-churn/:id',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = UpdateCasoChurnSchema.parse(request.body);
        const user = (request as any).user;

        const caso = await service.update(id, body, user.id);

        return reply.status(200).send({
          status: 'success',
          data: caso,
          message: 'Caso atualizado com sucesso'
        });
      } catch (error: any) {
        console.error('[PATCH /casos-churn]', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            status: 'error',
            message: 'Validação falhou',
            errors: error.errors
          });
        }

        if (error.name === 'NotFoundError') {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        if (error.name === 'BadRequestError') {
          return reply.status(400).send({
            status: 'error',
            message: error.message
          });
        }

        return reply.status(500).send({
          status: 'error',
          message: 'Erro ao atualizar caso'
        });
      }
    }
  );

  // DELETE /casos-churn/:id — Deletar (soft delete) caso
  fastify.delete(
    '/casos-churn/:id',
    { onRequest: [requireAuth, requireRole(['CEO'])] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const caso = await service.delete(id);

        return reply.status(200).send({
          status: 'success',
          data: caso,
          message: 'Caso deletado com sucesso'
        });
      } catch (error: any) {
        if (error.name === 'NotFoundError') {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }

        return reply.status(500).send({
          status: 'error',
          message: 'Erro ao deletar caso'
        });
      }
    }
  );
}
