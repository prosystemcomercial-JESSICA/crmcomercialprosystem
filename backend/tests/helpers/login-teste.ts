import { AuthService } from '@/services/auth.service';

// Token de acesso de verdade (assinado com o JWT_SECRET do ambiente de teste) para as rotas
// protegidas por requireAuth: um usuário da administração, que passa em qualquer requireRole.
const tokens = new AuthService().generateTokens({
  userId: 'test-user', email: 'teste@prosystem.test', nome: 'Usuário de Teste', role: 'ADMIN', admin: true,
} as any);

export const BEARER_TESTE = `Bearer ${tokens.accessToken}`;
