import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { PrismaClient } from '@prisma/client';
import { authRoutes } from '@/routes/auth';
import { casosChurnRoutes } from '@/routes/casos-churn';
import { diagnosisChurnRoutes } from '@/routes/diagnosis-churn';
import { retencaoRoutes } from '@/routes/retencao';
import { dashboardRetencaoRoutes } from '@/routes/dashboard-retencao';
import { clientesRoutes } from '@/routes/clientes';
import { campanhasRoutes } from '@/routes/campanhas';
import { leadsRoutes } from '@/routes/leads';
import { atividadesRoutes } from '@/routes/atividades';
import { propostasRoutes } from '@/routes/propostas';
import { contratosRoutes } from '@/routes/contratos';
import { metasRoutes } from '@/routes/metas';
import { complementosRoutes } from '@/routes/complementos';
import { servicosRoutes } from '@/routes/servicos';
import { comissoesRoutes } from '@/routes/comissoes';
import { healthScoreRoutes } from '@/routes/health-score';
import { dashboardPowerRoutes } from '@/routes/dashboard-power';
import { relatoriosComerciais } from '@/routes/relatorios-comerciais';
import { usuariosRoutes } from '@/routes/usuarios';
import { funilRoutes } from '@/routes/funil';
import { vendasAdicionaisRoutes } from '@/routes/vendas-adicionais';
import { propostasComerciais } from '@/routes/propostas-comerciais';
import { kanbanColunasRoutes } from '@/routes/kanban-colunas';
import { etiquetasRoutes } from '@/routes/etiquetas';
import { dashboardComercialRoutes } from '@/routes/dashboard-comercial';
import { contratosComerciais } from '@/routes/contratos-comerciais';

// Initialize Prisma
export const prisma = new PrismaClient({
  log: ['warn', 'error']
});

// Initialize Fastify
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  }
});

// Register plugins
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

fastify.register(cors, {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true
});

fastify.register(helmet, {
  contentSecurityPolicy: false
});

// Health check route
fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
});

// API Routes
fastify.register(async (fastify) => {
  fastify.register(authRoutes, { prisma });
  fastify.register(casosChurnRoutes, { prisma });
  fastify.register(diagnosisChurnRoutes, { prisma });
  fastify.register(retencaoRoutes, { prisma });
  fastify.register(dashboardRetencaoRoutes, { prisma });
  fastify.register(clientesRoutes, { prisma });
  fastify.register(campanhasRoutes, { prisma });
  fastify.register(leadsRoutes, { prisma });
  fastify.register(atividadesRoutes, { prisma });
  fastify.register(propostasRoutes, { prisma });
  fastify.register(contratosRoutes, { prisma });
  fastify.register(metasRoutes, { prisma });
  fastify.register(complementosRoutes, { prisma });
  fastify.register(servicosRoutes, { prisma });
  fastify.register(comissoesRoutes, { prisma });
  fastify.register(healthScoreRoutes, { prisma });
  fastify.register(dashboardPowerRoutes, { prisma });
  fastify.register(relatoriosComerciais, { prisma });
  fastify.register(usuariosRoutes, { prisma });
  fastify.register(funilRoutes, { prisma });
  fastify.register(vendasAdicionaisRoutes, { prisma });
  fastify.register(propostasComerciais, { prisma });
  fastify.register(kanbanColunasRoutes, { prisma });
  fastify.register(etiquetasRoutes, { prisma });
  fastify.register(dashboardComercialRoutes, { prisma });
  fastify.register(contratosComerciais, { prisma });
});

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error('ERROR HANDLER:', error);

  reply.status(500).send({
    status: 'error',
    message: 'Internal server error',
    error: error?.message || 'Unknown error',
    details: process.env.NODE_ENV === 'development' ? {
      stack: error?.stack,
      name: error?.name,
      code: error?.code
    } : undefined
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  fastify.log.warn('SIGTERM received, shutting down gracefully...');
  await fastify.close();
  if (prisma) await prisma.$disconnect();
  process.exit(0);
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.FASTIFY_PORT || '3001');
    await fastify.listen({ port, host: '0.0.0.0' });

    fastify.log.info(`🚀 Server running on http://localhost:${port}`);
    fastify.log.info(`📊 Health: http://localhost:${port}/health`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
