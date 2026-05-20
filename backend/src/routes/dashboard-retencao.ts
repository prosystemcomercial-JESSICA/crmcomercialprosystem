import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '@/middleware/auth';
import { DashboardRetencaoService } from '@/services/dashboard-retencao.service';
import { DashboardFiltersSchema } from '@/types/dto';

export async function dashboardRetencaoRoutes(
  fastify: FastifyInstance,
  options: { prisma: PrismaClient }
) {
  const { prisma } = options;
  const dashboardService = new DashboardRetencaoService(prisma);

  // Get dashboard KPIs
  fastify.get<{ Querystring: { periodo?: string; status?: string } }>(
    '/dashboard/retencao',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])] },
    async (request, reply) => {
      try {
        const filters = DashboardFiltersSchema.parse(request.query);
        const kpis = await dashboardService.calculateKPIs(filters);

        return reply.status(200).send({
          status: 'success',
          data: kpis
        });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            status: 'error',
            message: 'Validation error',
            errors: error.errors
          });
        }

        throw error;
      }
    }
  );

  // Get status chart data
  fastify.get<{ Querystring: { dias?: string } }>(
    '/dashboard/retencao/chart/status',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])] },
    async (request, reply) => {
      try {
        const dias = request.query.dias ? parseInt(request.query.dias) : 30;
        const chartData = await dashboardService.getStatusChart(dias);

        return reply.status(200).send({
          status: 'success',
          data: chartData
        });
      } catch (error) {
        throw error;
      }
    }
  );

  // Get risk distribution chart
  fastify.get(
    '/dashboard/retencao/chart/risco',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])] },
    async (request, reply) => {
      try {
        const riskData = await dashboardService.getRiscoChart();

        return reply.status(200).send({
          status: 'success',
          data: riskData
        });
      } catch (error) {
        throw error;
      }
    }
  );

  // Get top clients at risk
  fastify.get<{ Querystring: { limit?: string } }>(
    '/dashboard/retencao/top-risco',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])] },
    async (request, reply) => {
      try {
        const limit = request.query.limit ? parseInt(request.query.limit) : 10;
        const topClientes = await dashboardService.getTopRiscoClientes(limit);

        return reply.status(200).send({
          status: 'success',
          data: topClientes
        });
      } catch (error) {
        throw error;
      }
    }
  );

  // Get retention plan status
  fastify.get(
    '/dashboard/retencao/planos-status',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])] },
    async (request, reply) => {
      try {
        const planoStatus = await dashboardService.getPlanoStatus();

        return reply.status(200).send({
          status: 'success',
          data: planoStatus
        });
      } catch (error) {
        throw error;
      }
    }
  );

  // Get actions by type
  fastify.get(
    '/dashboard/retencao/acoes-tipo',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])] },
    async (request, reply) => {
      try {
        const acoesPorTipo = await dashboardService.getAcoesPorTipo();

        return reply.status(200).send({
          status: 'success',
          data: acoesPorTipo
        });
      } catch (error) {
        throw error;
      }
    }
  );

  // Get recovery rate by diagnosis motive
  fastify.get(
    '/dashboard/retencao/recuperacao-motivo',
    { onRequest: [requireAuth, requireRole(['CEO', 'SUPERVISAO'])] },
    async (request, reply) => {
      try {
        const recuperacao = await dashboardService.getRecuperacaoPorMotivo();

        return reply.status(200).send({
          status: 'success',
          data: recuperacao
        });
      } catch (error) {
        throw error;
      }
    }
  );
}
