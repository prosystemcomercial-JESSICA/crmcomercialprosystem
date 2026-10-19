import type { FastifyInstance } from 'fastify';

// Os testes de rota não sobem o server.ts, que é quem lê o token e preenche request.user
// (hook global de login). Este hook faz o papel dele: com cabeçalho Authorization entra um
// usuário da administração; sem cabeçalho, ninguém (as rotas respondem 401).
export const USUARIO_TESTE = { id: 'test-user', nome: 'Usuário de Teste', email: 'teste@prosystem.test', role: 'ADMIN', admin: true };

export function simularLogin(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async request => {
    if (request.headers.authorization) (request as any).user = { ...USUARIO_TESTE };
  });
}
