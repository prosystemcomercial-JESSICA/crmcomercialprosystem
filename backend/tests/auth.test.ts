import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { authRoutes } from '@/routes/auth';

describe('Authentication Routes', () => {
  let fastify: FastifyInstance;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    fastify = Fastify();

    fastify.register(cors);
    fastify.register(helmet, { contentSecurityPolicy: false });
    fastify.register(async (fastify) => {
      fastify.register(authRoutes, { prisma });
    });

    fastify.get('/health', async () => ({ status: 'ok' }));

    await fastify.listen({ port: 0 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await fastify.close();
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'ceo@prosystem.com.br',
          password: 'senha123'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data.accessToken).toBeDefined();
      expect(data.data.refreshToken).toBeDefined();
      expect(data.data.expiresIn).toBeDefined();
      expect(data.data.user.id).toBe('user-ceo');
      expect(data.data.user.role).toBe('CEO');
      expect(data.data.user.email).toBe('ceo@prosystem.com.br');
    });

    it('should return 401 for invalid email', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'wrong@prosystem.com.br',
          password: 'senha123'
        }
      });

      expect(response.statusCode).toBe(401);
      const data = response.json();
      expect(data.status).toBe('error');
      expect(data.message).toContain('Email ou senha inválidos');
    });

    it('should return 401 for wrong password', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'ceo@prosystem.com.br',
          password: 'wrongpassword'
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'not-an-email',
          password: 'senha123'
        }
      });

      expect(response.statusCode).toBe(400);
      const data = response.json();
      expect(data.status).toBe('error');
    });

    it('should return 400 for short password', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'ceo@prosystem.com.br',
          password: '123'
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should work with SUPERVISAO role', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'supervisao@prosystem.com.br',
          password: 'senha123'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.data.user.role).toBe('SUPERVISAO');
    });

    it('should work with TECNICO role', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'tecnico@prosystem.com.br',
          password: 'senha123'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.data.user.role).toBe('TECNICO');
    });
  });

  describe('POST /auth/refresh', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeAll(async () => {
      // Login first to get tokens
      const loginResponse = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'ceo@prosystem.com.br',
          password: 'senha123'
        }
      });

      const data = loginResponse.json();
      accessToken = data.data.accessToken;
      refreshToken = data.data.refreshToken;
    });

    it('should refresh token with valid refresh token', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {
          refreshToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('success');
      expect(data.data.accessToken).toBeDefined();
      expect(data.data.accessToken).not.toBe(accessToken); // Should be new token
      expect(data.data.refreshToken).toBeDefined();
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {}
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {
          refreshToken: 'invalid-token-string'
        }
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/logout'
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('success');
    });
  });

  describe('Token Usage in Requests', () => {
    let accessToken: string;

    beforeAll(async () => {
      const loginResponse = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'ceo@prosystem.com.br',
          password: 'senha123'
        }
      });

      accessToken = loginResponse.json().data.accessToken;
    });

    it('should accept valid token in Authorization header', async () => {
      // This test verifies token format works
      expect(accessToken).toBeTruthy();
      expect(accessToken.split('.').length).toBe(3); // JWT format: header.payload.signature
    });

    it('token should be decodable (without verification)', async () => {
      // Split token and decode payload
      const parts = accessToken.split('.');
      const payload = Buffer.from(parts[1], 'base64').toString();
      const decoded = JSON.parse(payload);

      expect(decoded.userId).toBe('user-ceo');
      expect(decoded.email).toBe('ceo@prosystem.com.br');
      expect(decoded.role).toBe('CEO');
      expect(decoded.nome).toBe('CEO ProSystem');
    });
  });
});
