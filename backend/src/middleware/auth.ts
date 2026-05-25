import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '@/services/auth.service';

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  role: string;
}

declare global {
  namespace FastifyInstance {
    interface FastifyInstance {
      user?: AuthUser;
    }
  }
}

const authService = new AuthService();

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.status(401).send({
      status: 'error',
      message: 'Authorization header missing'
    });
  }

  // Extract token from "Bearer <token>"
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return reply.status(401).send({
      status: 'error',
      message: 'Invalid authorization format'
    });
  }

  try {
    // Verify JWT token
    const decoded = authService.verifyAccessToken(token);

    // Attach user to request
    (request as any).user = {
      id: decoded.userId,
      nome: decoded.nome,
      email: decoded.email,
      role: decoded.role
    } as AuthUser;
  } catch (error: any) {
    return reply.status(401).send({
      status: 'error',
      message: error.message || 'Invalid token'
    });
  }
}

export function requireRole(allowedRoles: AuthUser['role'][]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUser | undefined;

    if (!user) {
      return reply.status(401).send({
        status: 'error',
        message: 'Unauthorized'
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return reply.status(403).send({
        status: 'error',
        message: `Only ${allowedRoles.join(', ')} can access this`
      });
    }
  };
}
