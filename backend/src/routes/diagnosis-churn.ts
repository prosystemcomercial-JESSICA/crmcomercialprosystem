import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '@/middleware/auth';
import { DiagnosisChurnService } from '@/services/diagnosis-churn.service';
import { CreateDiagnosisSchema, UpdateDiagnosisSchema } from '@/types/dto';

export async function diagnosisChurnRoutes(
  fastify: FastifyInstance,
  options: { prisma: PrismaClient }
) {
  const { prisma } = options;
  const diagnosisService = new DiagnosisChurnService(prisma);

  // Create diagnosis with auto-scoring
  fastify.post<{ Params: { casoId: string } }>(
    '/casos/:casoId/diagnostico',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO', 'TECNICO'])] },
    async (request, reply) => {
      try {
        const { casoId } = request.params;
        const data = CreateDiagnosisSchema.parse(request.body);

        const diagnosis = await diagnosisService.create(casoId, data);

        return reply.status(201).send({
          status: 'success',
          data: diagnosis
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

  // Get diagnosis for a caso (with risk matrix)
  fastify.get<{ Params: { casoId: string } }>(
    '/casos/:casoId/diagnostico',
    { onRequest: requireAuth },
    async (request, reply) => {
      try {
        const { casoId } = request.params;
        const diagnosis = await diagnosisService.getByCasoId(casoId);

        if (!diagnosis) {
          return reply.status(404).send({
            status: 'error',
            message: `Diagnóstico não encontrado para caso ${casoId}`
          });
        }

        const riskMatrix = await diagnosisService.getRiskMatrix(casoId);

        return reply.status(200).send({
          status: 'success',
          data: {
            diagnosis,
            riskMatrix
          }
        });
      } catch (error) {
        throw error;
      }
    }
  );

  // Update diagnosis
  fastify.patch<{ Params: { diagnosisId: string } }>(
    '/diagnosticos/:diagnosisId',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO', 'TECNICO'])] },
    async (request, reply) => {
      try {
        const { diagnosisId } = request.params;
        const data = UpdateDiagnosisSchema.parse(request.body);

        const diagnosis = await diagnosisService.update(diagnosisId, data);

        return reply.status(200).send({
          status: 'success',
          data: diagnosis
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
}
