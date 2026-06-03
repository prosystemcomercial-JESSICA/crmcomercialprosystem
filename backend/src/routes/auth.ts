import { FastifyInstance } from 'fastify';
import { AuthService } from '@/services/auth.service';
import { LoginSchema, RefreshTokenSchema, TokenResponseDTO } from '@/types/dto';
import { enviarEmailBoasVindas, enviarEmailRedefinicaoSenha } from '@/services/email.service';
import { hashSenha, conferirSenha, precisaRehash, loginBloqueado, registrarFalha, limparTentativas } from '@/lib/seguranca';

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

        // Bloqueio por força bruta (muitas tentativas erradas no mesmo e-mail)
        const minutos = loginBloqueado(data.email);
        if (minutos > 0) {
          return reply.status(429).send({ status: 'error', message: `Muitas tentativas. Tente novamente em ${minutos} min.` });
        }

        // 1) Admin — resposta imediata, sem tocar no banco
        const systemAccount = mockUsers.find(u => u.email.toLowerCase() === data.email && u.password === data.password);
        if (systemAccount) {
          const tokens = authService.generateTokens({
            userId: systemAccount.id,
            email: systemAccount.email,
            nome: systemAccount.nome,
            role: systemAccount.role
          });
          return reply.status(200).send({
            status: 'success',
            data: {
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              expiresIn: tokens.expiresIn,
              user: { id: systemAccount.id, email: systemAccount.email, nome: systemAccount.nome, role: systemAccount.role }
            }
          });
        }

        // 2) Usuários do banco — busca por e-mail e confere a senha com bcrypt
        //    (aceita texto puro legado e re-hasheia no primeiro login bem-sucedido)
        let user: { id: string; email: string; nome: string; role: string } | null = null;
        let precisaTrocar = false;
        try {
          const rows: any[] = await Promise.race([
            prisma.$queryRawUnsafe(
              `SELECT id, email, nome, cargo as role, status, senha, precisa_trocar_senha FROM UsuarioCRM WHERE LOWER(email) = ? LIMIT 1`,
              data.email
            ),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
          ]) as any[];
          const row = rows[0];
          if (row && row.status !== 'INATIVO' && row.status !== 'SUSPENSO') {
            const ok = await conferirSenha(data.password, row.senha);
            if (ok) {
              user = { id: row.id, email: row.email, nome: row.nome, role: row.role };
              precisaTrocar = !!row.precisa_trocar_senha;
              // Migração transparente: se a senha estava em texto puro, salva o hash agora
              if (precisaRehash(row.senha)) {
                const novoHash = await hashSenha(data.password);
                prisma.$executeRawUnsafe(`UPDATE UsuarioCRM SET senha = ? WHERE id = ?`, novoHash, row.id).catch(() => {});
              }
            }
          }
        } catch {
          // banco indisponível ou timeout — nega acesso
        }

        if (!user) {
          registrarFalha(data.email);   // conta a tentativa errada (bloqueio progressivo)
          return reply.status(401).send({ status: 'error', message: 'Email ou senha inválidos' });
        }
        limparTentativas(data.email);   // sucesso: zera o contador de tentativas

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
          user: { id: user.id, email: user.email, nome: user.nome, role: user.role, precisa_trocar_senha: precisaTrocar } as any
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
              `SELECT id, email, nome, cargo as role FROM UsuarioCRM WHERE id = ? LIMIT 1`,
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
        `SELECT id, nome, email, cargo FROM UsuarioCRM WHERE LOWER(email) = ? AND status = 'ATIVO' LIMIT 1`,
        emailNorm
      );

      if (rows.length > 0) {
        const usuario = rows[0];
        // Gera nova senha segura
        const gerarSenhaSegura = (): string => {
          const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
          const lower = 'abcdefghjkmnpqrstuvwxyz';
          const digits = '23456789';
          const special = '@#$!';
          const all = upper + lower + digits + special;
          let s = [
            upper[Math.floor(Math.random() * upper.length)],
            lower[Math.floor(Math.random() * lower.length)],
            digits[Math.floor(Math.random() * digits.length)],
            special[Math.floor(Math.random() * special.length)],
            ...Array.from({ length: 6 }, () => all[Math.floor(Math.random() * all.length)])
          ];
          for (let i = s.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [s[i], s[j]] = [s[j], s[i]];
          }
          return s.join('');
        };
        const novaSenha = gerarSenhaSegura();

        // Salva no banco (HASH) e força troca no próximo login
        const hash = await hashSenha(novaSenha);
        await prisma.$executeRawUnsafe(
          `UPDATE UsuarioCRM SET senha = ?, precisa_trocar_senha = 1, updated_at = NOW() WHERE id = ?`,
          hash, usuario.id
        );

        // Envia email de redefinição com template dedicado ProSystem
        enviarEmailRedefinicaoSenha({
          nome: usuario.nome,
          email: usuario.email,
          senha: novaSenha,
          cargo: usuario.cargo,
          solicitadoPor: 'usuario'
        }).catch(e => console.error('[AUTH] Erro ao enviar email recuperação:', e));
      }
    } catch (e) {
      console.error('[AUTH] Erro recuperação senha:', e);
    }

    // Sempre retorna sucesso (não revela se o email existe)
    return reply.status(200).send({ status: 'success' });
  });

  // POST /auth/alterar-senha — usuário logado troca própria senha
  fastify.post<{ Body: { senha_atual: string; nova_senha: string } }>(
    '/auth/alterar-senha',
    async (request, reply) => {
      const user = (request as any).user;
      if (!user?.userId && !user?.id) {
        return reply.status(401).send({ status: 'error', message: 'Não autenticado' });
      }

      const { senha_atual, nova_senha } = request.body || {};
      if (!senha_atual || !nova_senha) {
        return reply.status(400).send({ status: 'error', message: 'Senha atual e nova senha são obrigatórias' });
      }
      if (nova_senha.length < 6) {
        return reply.status(400).send({ status: 'error', message: 'A nova senha deve ter no mínimo 6 caracteres' });
      }
      if (nova_senha === senha_atual) {
        return reply.status(400).send({ status: 'error', message: 'A nova senha não pode ser igual à senha atual' });
      }

      const userId = user?.id || user?.userId;

      // Conta de administradora do sistema não pode alterar senha por aqui
      const isAdmin = mockUsers.some(u => u.id === userId);
      if (isAdmin) {
        return reply.status(403).send({ status: 'error', message: 'Conta de sistema — altere a senha pela configuração do servidor' });
      }

      try {
        // Busca o usuário e confere a senha atual (hash ou texto puro legado)
        const rows: any[] = await prisma.$queryRawUnsafe(
          `SELECT id, senha FROM UsuarioCRM WHERE id = ? AND status = 'ATIVO' LIMIT 1`,
          userId
        );
        if (!rows.length || !(await conferirSenha(senha_atual, rows[0].senha))) {
          return reply.status(401).send({ status: 'error', message: 'Senha atual incorreta' });
        }

        // Atualiza para a nova senha (HASH) e limpa a flag de troca obrigatória
        const hash = await hashSenha(nova_senha);
        await prisma.$executeRawUnsafe(
          `UPDATE UsuarioCRM SET senha = ?, precisa_trocar_senha = 0, updated_at = NOW() WHERE id = ?`,
          hash, userId
        );

        return reply.send({ status: 'success', message: 'Senha alterada com sucesso' });
      } catch (e) {
        console.error('[AUTH] Erro ao alterar senha:', e);
        throw e;
      }
    }
  );
}
