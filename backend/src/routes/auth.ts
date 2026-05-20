import { FastifyInstance } from 'fastify';
import { AuthService } from '@/services/auth.service';
import { LoginSchema, RefreshTokenSchema, TokenResponseDTO } from '@/types/dto';

export async function authRoutes(
  fastify: FastifyInstance,
  options: { prisma: any }
) {
  const { prisma } = options;
  const authService = new AuthService();

  // Mock users database (for development)
  const mockUsers = [
    {
      id: 'user-ceo',
      email: 'ceo@prosystem.com.br',
      password: 'senha123', // Only for dev, use proper hashing in production
      nome: 'CEO ProSystem',
      role: 'CEO'
    },
    {
      id: 'user-supervisao',
      email: 'supervisao@prosystem.com.br',
      password: 'senha123',
      nome: 'Supervisor',
      role: 'SUPERVISAO'
    },
    {
      id: 'user-tecnico',
      email: 'tecnico@prosystem.com.br',
      password: 'senha123',
      nome: 'Técnico',
      role: 'TECNICO'
    },
    {
      id: 'user-vendedor',
      email: 'vendedor@prosystem.com.br',
      password: 'senha123',
      nome: 'Vendedor',
      role: 'VENDEDOR'
    }
  ];

  // POST /auth/login - Login with email and password
  fastify.post<{ Body: { email: string; password: string } }>(
    '/auth/login',
    async (request, reply) => {
      try {
        const data = LoginSchema.parse(request.body);

        // Find user in mock database
        const user = mockUsers.find(
          (u) => u.email === data.email && u.password === data.password
        );

        if (!user) {
          return reply.status(401).send({
            status: 'error',
            message: 'Email ou senha inválidos'
          });
        }

        // Generate tokens
        const tokens = authService.generateTokens({
          userId: user.id,
          email: user.email,
          nome: user.nome,
          role: user.role
        });

        const response: TokenResponseDTO = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          user: {
            id: user.id,
            email: user.email,
            nome: user.nome,
            role: user.role
          }
        };

        return reply.status(200).send({
          status: 'success',
          data: response
        });
      } catch (error: any) {
        console.error('[AUTH] Login error:', error);
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

  // POST /auth/refresh - Refresh access token
  fastify.post<{ Body: { refreshToken: string } }>(
    '/auth/refresh',
    async (request, reply) => {
      try {
        const data = RefreshTokenSchema.parse(request.body);

        // Verify and decode refresh token
        const decoded = authService.decodeToken(data.refreshToken);

        if (!decoded || !decoded.userId) {
          return reply.status(401).send({
            status: 'error',
            message: 'Invalid refresh token'
          });
        }

        // Find user
        const user = mockUsers.find((u) => u.id === decoded.userId);

        if (!user) {
          return reply.status(401).send({
            status: 'error',
            message: 'User not found'
          });
        }

        // Generate new tokens
        const tokens = authService.refreshAccessToken(data.refreshToken, {
          userId: user.id,
          email: user.email,
          nome: user.nome,
          role: user.role
        });

        const response: TokenResponseDTO = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          user: {
            id: user.id,
            email: user.email,
            nome: user.nome,
            role: user.role
          }
        };

        return reply.status(200).send({
          status: 'success',
          data: response
        });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            status: 'error',
            message: 'Validation error',
            errors: error.errors
          });
        }

        if (error.message.includes('expired') || error.message.includes('Invalid')) {
          return reply.status(401).send({
            status: 'error',
            message: error.message
          });
        }

        throw error;
      }
    }
  );

  // POST /auth/logout - Logout (client-side token cleanup)
  fastify.post('/auth/logout', async (request, reply) => {
    // Token cleanup happens on client side
    // Server just confirms logout
    return reply.status(200).send({
      status: 'success',
      message: 'Logout successful'
    });
  });
}
