import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '@/services/auth.service';
import { ID_CONTA_MOCK_REMOVIDA } from '@/lib/permissoes-conta';

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  role: string;
  vende?: boolean;
  admin?: boolean;
  somente_leitura?: boolean;
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
    const decoded: any = authService.verifyAccessToken(token);
    if (decoded.userId === ID_CONTA_MOCK_REMOVIDA) {
      return reply.status(401).send({ status: 'error', message: 'Sessão expirada — entre novamente' });
    }

    // Attach user to request
    (request as any).user = {
      id: decoded.userId,
      nome: decoded.nome,
      email: decoded.email,
      role: decoded.role,
      vende: !!decoded.vende,
      admin: !!decoded.admin,
      somente_leitura: !!decoded.somente_leitura,
    } as AuthUser;
  } catch (error: any) {
    return reply.status(401).send({
      status: 'error',
      message: error.message || 'Invalid token'
    });
  }
}

// Papéis com ACESSO TOTAL ao sistema — liberados em QUALQUER rota, sem exceção,
// independente da lista que a rota declare. ADMIN/DIRETOR = administração geral.
const ROLES_ACESSO_TOTAL = ['ADMIN', 'DIRETOR'];

export function requireRole(allowedRoles: AuthUser['role'][]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUser | undefined;

    if (!user) {
      return reply.status(401).send({
        status: 'error',
        message: 'Unauthorized'
      });
    }

    const role = String(user.role || '').toUpperCase();
    // Administração (ADMIN/DIRETOR) acessa tudo — não barra nunca.
    if (ROLES_ACESSO_TOTAL.includes(role)) return;
    // Flag admin_sistema (UsuarioCRM) = administração total, qualquer que seja o cargo.
    if (user.admin) return;

    if (!allowedRoles.includes(user.role)) {
      return reply.status(403).send({
        status: 'error',
        message: `Only ${allowedRoles.join(', ')} can access this`
      });
    }
  };
}
