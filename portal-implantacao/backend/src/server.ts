import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { projetosRoutes } from './routes/projetos.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { ponteRoutes } from './routes/ponte.js';
import { iniciarSchedulerAutomacoes } from './automacoes.js';
import { FUNIS, OPCOES } from './funis.js';

const prisma = new PrismaClient();
const isProd = process.env.NODE_ENV === 'production';

const fastify = Fastify({
  bodyLimit: 10 * 1024 * 1024,
  logger: isProd ? { level: 'info' } : { level: 'info', transport: { target: 'pino-pretty', options: { colorize: true } } },
});

await fastify.register(cors, {
  origin: (process.env.FRONTEND_URL || '*').split(',').map(s => s.trim()),
  credentials: true,
});

// Health
fastify.get('/health', async () => ({ status: 'ok', portal: 'implantacao', rev: 'v1', timestamp: new Date().toISOString() }));

// ── SSO: aceita o JWT do CRM comercial (MESMO segredo JWT_SECRET) ──
// Assim a Jessica e a equipe entram com a conta que já têm. Hook opcional:
// popula request.user se houver Bearer válido; não bloqueia rotas públicas.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-trocar';
fastify.addHook('onRequest', async (request) => {
  const auth = request.headers.authorization;
  if (!auth) return;
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return;
  try {
    const d: any = jwt.verify(token, JWT_SECRET);
    (request as any).user = { id: d.userId || d.id, nome: d.nome, email: d.email, role: d.role || d.cargo };
  } catch { /* token inválido — segue sem user */ }
});

// Catálogo de funis/fases e opções dos campos (consumido pelo frontend).
fastify.get('/config', async () => ({ status: 'success', data: { funis: FUNIS, opcoes: OPCOES } }));

await fastify.register(projetosRoutes, { prisma });
await fastify.register(dashboardRoutes, { prisma });
await fastify.register(ponteRoutes, { prisma });

const port = Number(process.env.PORT || 3002);
fastify.listen({ port, host: '0.0.0.0' })
  .then(() => {
    console.log(`[PORTAL-IMPLANTACAO] backend na porta ${port}`);
    iniciarSchedulerAutomacoes(prisma); // gatilhos por tempo (SLA fiscal 5d, engajamento 15d)
  })
  .catch((err) => { fastify.log.error(err); process.exit(1); });
