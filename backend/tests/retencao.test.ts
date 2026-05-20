import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { casosChurnRoutes } from '@/routes/casos-churn';
import { diagnosisChurnRoutes } from '@/routes/diagnosis-churn';
import { retencaoRoutes } from '@/routes/retencao';
import { dashboardRetencaoRoutes } from '@/routes/dashboard-retencao';

describe('Retention Module Routes', () => {
  let fastify: FastifyInstance;
  let prisma: PrismaClient;
  let testClienteId: string;
  let testCasoId: string;
  let testDiagnosisId: string;
  let testPlanoId: string;
  let testAcaoId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    fastify = Fastify();

    fastify.register(cors);
    fastify.register(helmet, { contentSecurityPolicy: false });
    fastify.register(async (fastify) => {
      fastify.register(casosChurnRoutes, { prisma });
      fastify.register(diagnosisChurnRoutes, { prisma });
      fastify.register(retencaoRoutes, { prisma });
      fastify.register(dashboardRetencaoRoutes, { prisma });
    });

    fastify.get('/health', async () => ({ status: 'ok' }));

    // Create test client
    const cliente = await prisma.cliente.create({
      data: {
        nome: 'Cliente Teste Retenção',
        email: 'retencao@example.com'
      }
    });
    testClienteId = cliente.id;

    // Create test caso
    const caso = await prisma.casoChurn.create({
      data: {
        clienteId: testClienteId,
        created_by: 'test-user'
      }
    });
    testCasoId = caso.id;

    await fastify.listen({ port: 0 });
  });

  afterAll(async () => {
    await prisma.cliente.deleteMany();
    await prisma.$disconnect();
    await fastify.close();
  });

  // ===== DIAGNOSIS TESTS =====

  describe('Diagnosis Routes', () => {
    it('should create diagnosis with risk scoring', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: `/casos/${testCasoId}/diagnostico`,
        headers: {
          authorization: 'Bearer test-token'
        },
        payload: {
          dias_sem_interacao: 45,
          valor_mensal: 2500,
          frequencia_suporte: 8,
          tempo_cliente: 4,
          motivo_reportado: 'Preço elevado'
        }
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data.risco_score).toBeGreaterThan(0);
      expect(data.data.fatores).toBeInstanceOf(Array);
      testDiagnosisId = data.data.id;
    });

    it('should get diagnosis by caso ID', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/casos/${testCasoId}/diagnostico`,
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data.diagnosis).toBeDefined();
      expect(data.data.riskMatrix).toBeDefined();
    });

    it('should update diagnosis and recalculate score', async () => {
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/diagnosticos/${testDiagnosisId}`,
        headers: {
          authorization: 'Bearer test-token'
        },
        payload: {
          dias_sem_interacao: 65,
          frequencia_suporte: 12
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data.risco_score).toBeGreaterThanOrEqual(0);
    });

    it('should return 404 for non-existent diagnosis', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/casos/non-existent/diagnostico',
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ===== RETENTION PLAN TESTS =====

  describe('Retention Plan Routes', () => {
    it('should create retention plan', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: `/casos/${testCasoId}/planos`,
        headers: {
          authorization: 'Bearer test-token'
        },
        payload: {
          titulo: 'Plano de Retenção Premium',
          descricao: 'Abordagem personalizada com desconto'
        }
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data.status).toBe('RASCUNHO');
      testPlanoId = data.data.id;
    });

    it('should list retention plans for caso', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/casos/${testCasoId}/planos`,
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data).toBeInstanceOf(Array);
      expect(data.data.length).toBeGreaterThan(0);
    });

    it('should get plan by ID', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/planos/${testPlanoId}`,
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data.id).toBe(testPlanoId);
    });

    it('should update retention plan', async () => {
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/planos/${testPlanoId}`,
        headers: {
          authorization: 'Bearer test-token'
        },
        payload: {
          titulo: 'Plano Atualizado'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.data.titulo).toBe('Plano Atualizado');
    });

    it('should activate retention plan', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: `/planos/${testPlanoId}/ativar`,
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.data.status).toBe('ATIVO');
    });

    it('should conclude retention plan', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: `/planos/${testPlanoId}/concluir`,
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.data.status).toBe('CONCLUIDO');
    });
  });

  // ===== RETENTION ACTION TESTS =====

  describe('Retention Action Routes', () => {
    it('should create retention action', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: `/casos/${testCasoId}/acoes`,
        headers: {
          authorization: 'Bearer test-token'
        },
        payload: {
          titulo: 'Contato com cliente',
          tipo: 'CONTATO',
          descricao: 'Ligar para cliente explicar benefícios',
          data_vencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data.status).toBe('NOVA');
      expect(data.data.tipo).toBe('CONTATO');
      testAcaoId = data.data.id;
    });

    it('should list actions for caso', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/casos/${testCasoId}/acoes`,
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data).toBeInstanceOf(Array);
    });

    it('should filter actions by status', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/casos/${testCasoId}/acoes?status=NOVA`,
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.data.every((a: any) => a.status === 'NOVA')).toBe(true);
    });

    it('should get action by ID', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/acoes/${testAcaoId}`,
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.data.id).toBe(testAcaoId);
    });

    it('should mark action as in progress', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: `/acoes/${testAcaoId}/progresso`,
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.data.status).toBe('EM_PROGRESSO');
    });

    it('should conclude action', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: `/acoes/${testAcaoId}/concluir`,
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.data.status).toBe('CONCLUIDA');
    });

    it('should get action timeline for caso', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/casos/${testCasoId}/timeline`,
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data.total).toBeGreaterThan(0);
      expect(data.data.timeline).toBeInstanceOf(Array);
    });

    it('should reject invalid action type', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: `/casos/${testCasoId}/acoes`,
        headers: {
          authorization: 'Bearer test-token'
        },
        payload: {
          titulo: 'Invalid action',
          tipo: 'INVALID_TYPE'
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ===== DASHBOARD TESTS =====

  describe('Dashboard Routes', () => {
    it('should get dashboard KPIs', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/dashboard/retencao?periodo=30dias',
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data.total_casos).toBeDefined();
      expect(data.data.casos_por_status).toBeDefined();
      expect(data.data.risco_distribution).toBeDefined();
      expect(data.data.taxa_diagnosticados).toBeDefined();
    });

    it('should get status chart data', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/dashboard/retencao/chart/status?dias=30',
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data).toBeInstanceOf(Array);
    });

    it('should get risk distribution chart', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/dashboard/retencao/chart/risco',
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data.BAIXO).toBeDefined();
      expect(data.data.MÉDIO).toBeDefined();
      expect(data.data.ALTO).toBeDefined();
    });

    it('should get top clients at risk', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/dashboard/retencao/top-risco?limit=5',
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data).toBeInstanceOf(Array);
    });

    it('should get plan status summary', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/dashboard/retencao/planos-status',
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('success');
    });

    it('should get actions by type', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/dashboard/retencao/acoes-tipo',
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data).toBeInstanceOf(Array);
    });

    it('should get recovery rate by motive', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/dashboard/retencao/recuperacao-motivo',
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data).toBeInstanceOf(Array);
    });
  });
});
