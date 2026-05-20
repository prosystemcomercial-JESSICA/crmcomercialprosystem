import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { casosChurnRoutes } from '@/routes/casos-churn';

describe('Casos Churn Routes', () => {
  let fastify: FastifyInstance;
  let prisma: PrismaClient;
  let testClienteId: string;

  beforeAll(async () => {
    // Setup
    prisma = new PrismaClient();
    fastify = Fastify();

    fastify.register(cors);
    fastify.register(helmet, {contentSecurityPolicy: false});
    fastify.register(async (fastify) => {
      fastify.register(casosChurnRoutes, { prisma });
    });

    // Health check
    fastify.get('/health', async () => ({status: 'ok'}));

    // Create test client
    const cliente = await prisma.cliente.create({
      data: {
        nome: 'Cliente Teste',
        email: 'teste@example.com'
      }
    });
    testClienteId = cliente.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.cliente.deleteMany();
    await prisma.$disconnect();
    await fastify.close();
  });

  describe('POST /casos-churn', () => {
    it('should create a new caso with valid data', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/casos-churn',
        headers: {
          authorization: 'Bearer test-token'
        },
        payload: {
          clienteId: testClienteId,
          motivo_principal: 'Preço'
        }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().status).toBe('success');
      expect(response.json().data.status).toBe('NOVO');
      expect(response.json().data.clienteId).toBe(testClienteId);
    });

    it('should return 400 for missing clienteId', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/casos-churn',
        headers: {
          authorization: 'Bearer test-token'
        },
        payload: {
          motivo_principal: 'Preço'
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().status).toBe('error');
    });

    it('should return 404 for non-existent cliente', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/casos-churn',
        headers: {
          authorization: 'Bearer test-token'
        },
        payload: {
          clienteId: 'non-existent-id'
        }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().status).toBe('error');
    });

    it('should return 401 without authorization', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/casos-churn',
        payload: {
          clienteId: testClienteId
        }
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /casos-churn', () => {
    it('should list casos with pagination', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/casos-churn?page=0&limit=10',
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('success');
      expect(response.json().data).toBeInstanceOf(Array);
      expect(response.json().pagination).toBeDefined();
      expect(response.json().pagination.page).toBe(0);
    });

    it('should filter casos by status', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/casos-churn?status=NOVO',
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const casos = response.json().data;
      casos.forEach((caso: any) => {
        expect(caso.status).toBe('NOVO');
      });
    });
  });

  describe('GET /casos-churn/:id', () => {
    let casoId: string;

    beforeAll(async () => {
      const caso = await prisma.casoChurn.create({
        data: {
          clienteId: testClienteId,
          created_by: 'test-user'
        }
      });
      casoId = caso.id;
    });

    it('should get caso by id', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/casos-churn/${casoId}`,
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('success');
      expect(response.json().data.id).toBe(casoId);
    });

    it('should return 404 for non-existent caso', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/casos-churn/non-existent',
        headers: {
          authorization: 'Bearer test-token'
        }
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /casos-churn/:id', () => {
    let casoId: string;

    beforeAll(async () => {
      const caso = await prisma.casoChurn.create({
        data: {
          clienteId: testClienteId,
          created_by: 'test-user'
        }
      });
      casoId = caso.id;
    });

    it('should update caso status to DIAGNOSTICADO', async () => {
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/casos-churn/${casoId}`,
        headers: {
          authorization: 'Bearer test-token'
        },
        payload: {
          status: 'DIAGNOSTICADO'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.status).toBe('DIAGNOSTICADO');
    });

    it('should reject invalid status transition', async () => {
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/casos-churn/${casoId}`,
        headers: {
          authorization: 'Bearer test-token'
        },
        payload: {
          status: 'NOVO' // Can't go back from DIAGNOSTICADO to NOVO
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().status).toBe('error');
    });
  });
});
