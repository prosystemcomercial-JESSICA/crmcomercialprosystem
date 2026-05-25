import { FastifyInstance } from 'fastify';
import { AuthService } from '@/services/auth.service';
import { LoginSchema, RefreshTokenSchema, TokenResponseDTO } from '@/types/dto';
import { enviarEmailBoasVindas } from '@/services/email.service';

export async function authRoutes(
  fastify: FastifyInstance,
  options: { prisma: any }
) {
  const { prisma } = options;
  const authService = new AuthService();

  // Conta de administradora do sistema — acesso exclusivo
  const mockUsers = [
    {
      id: 'user-jessica',
      email: 'jessica@prosystemnet.com.br',
      password: process.env.ADMIN_PASSWORD || 'J140215l',
      nome: 'Jessica',
      role: 'CEO'
    }
  ];

  // POST /auth/login - Login with email and password
  fastify.post<{ Body: { email: string; password: string } }>(
    '/auth/login',
    async (request, reply) => {
      try {
        const raw = LoginSchema.parse(request.body);
        // Normalize: trim whitespace and lowercase email
        const data = {
          email: raw.email.trim().toLowerCase(),
          password: raw.password.trim()
        };

        // 1) Contas de sistema (mockUsers) têm prioridade absoluta — role nunca é sobrescrita pelo DB
        let user: { id: string; email: string; nome: string; role: string } | null = null;
        const systemAccount = mockUsers.find(u => u.email.toLowerCase() === data.email && u.password === data.password);
        if (systemAccount) {
          user = { id: systemAccount.id, email: systemAccount.email, nome: systemAccount.nome, role: systemAccount.role };
        }

        // 2) Checar na tabela UsuarioCRM apenas se não for conta de sistema
        if (!user) {
          try {
            const rows: any[] = await prisma.$queryRawUnsafe(
              `SELECT id::text, email, nome, cargo as role, status FROM "UsuarioCRM" WHERE LOWER(email) = $1 AND senha = $2 LIMIT 1`,
              data.email, data.password
            );
            if (rows.length > 0 && rows[0].status !== 'INATIVO' && rows[0].status !== 'SUSPENSO') {
              user = { id: rows[0].id, email: rows[0].email, nome: rows[0].nome, role: rows[0].role };
            }
          } catch {
            // tabela ainda não existe
          }
        }

        if (!user) {
          return reply.status(401).send({ status: 'error', message: 'Email ou senha inválidos' });
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
          user: { id: user.id, email: user.email, nome: user.nome, role: user.role }
        };

        return reply.status(200).send({ status: 'success', data: response });
      } catch (error: any) {
        console.error('[AUTH] Login error:', error);
        if (error.name === 'ZodError') {
          return reply.status(400).send({ status: 'error', message: 'Validation error', errors: error.errors });
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

        // Contas de sistema têm prioridade — role sempre vem do mockUsers
        let user: { id: string; email: string; nome: string; role: string } | null = null;
        const systemAccount = mockUsers.find((u) => u.id === decoded.userId);
        if (systemAccount) {
          user = { id: systemAccount.id, email: systemAccount.email, nome: systemAccount.nome, role: systemAccount.role };
        }

        if (!user) {
          try {
            const rows: any[] = await prisma.$queryRawUnsafe(
              `SELECT id::text, email, nome, cargo as role FROM "UsuarioCRM" WHERE id::text = $1 LIMIT 1`,
              decoded.userId
            );
            if (rows.length > 0) user = { id: rows[0].id, email: rows[0].email, nome: rows[0].nome, role: rows[0].role };
          } catch { }
        }

        if (!user) {
          return reply.status(401).send({ status: 'error', message: 'User not found' });
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
          user: { id: user.id, email: user.email, nome: user.nome, role: user.role }
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
    return reply.status(200).send({ status: 'success', message: 'Logout successful' });
  });

  // POST /auth/forgot-password - Recuperação de senha
  fastify.post<{ Body: { email: string } }>('/auth/forgot-password', async (request, reply) => {
    const { email } = request.body || {};
    if (!email || !email.includes('@')) {
      return reply.status(400).send({ status: 'error', message: 'E-mail inválido' });
    }

    const emailNorm = email.trim().toLowerCase();

    // Conta de administradora — não usa recuperação automática
    const isAdmin = mockUsers.some(u => u.email.toLowerCase() === emailNorm);
    if (isAdmin) {
      // Retorna sucesso genérico por segurança (não revela que é conta de sistema)
      return reply.status(200).send({ status: 'success' });
    }

    try {
      // Busca usuário no banco
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id::text, nome, email, cargo FROM "UsuarioCRM" WHERE LOWER(email) = $1 AND status = 'ATIVO' LIMIT 1`,
        emailNorm
      );

      if (rows.length > 0) {
        const usuario = rows[0];
        // Gera nova senha aleatória
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let novaSenha = '';
        for (let i = 0; i < 8; i++) novaSenha += chars[Math.floor(Math.random() * chars.length)];

        // Salva no banco
        await prisma.$executeRawUnsafe(
          `UPDATE "UsuarioCRM" SET senha = $1, updated_at = NOW() WHERE id::text = $2`,
          novaSenha, usuario.id
        );

        // Envia email com nova senha
        enviarEmailBoasVindas({
          nome: usuario.nome,
          email: usuario.email,
          senha: novaSenha,
          cargo: usuario.cargo
        }).catch(e => console.error('[AUTH] Erro ao enviar email recuperação:', e));
      }
    } catch (e) {
      console.error('[AUTH] Erro recuperação senha:', e);
    }

    // Sempre retorna sucesso (não revela se o email existe)
    return reply.status(200).send({ status: 'success' });
  });
}
