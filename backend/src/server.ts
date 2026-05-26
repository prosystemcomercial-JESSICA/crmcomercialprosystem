// ─────────────────────────────────────────────────────────────────────────────
// SERVER ENTRY — Resiliente para Railway/containers
// Filosofia: o servidor SEMPRE precisa subir. /health precisa responder
// mesmo se TODAS as rotas falharem. Erros são logados, não derrubam o processo.
// ─────────────────────────────────────────────────────────────────────────────

// 1) Handlers GLOBAIS antes de QUALQUER coisa — captura erros de import/init
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err?.stack || err);
  // não chama process.exit — deixa o Fastify continuar servindo /health
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[FATAL] unhandledRejection:', reason?.stack || reason);
});

// Log imediato para sabermos que o módulo carregou
console.log('[BOOT] server.ts carregado — Node', process.version, '— NODE_ENV=', process.env.NODE_ENV);

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

// 2) Prisma — instanciação protegida (não deve falhar, mas por garantia)
let prismaClient: any = null;
try {
  const { PrismaClient } = await import('@prisma/client');
  prismaClient = new PrismaClient({ log: ['warn', 'error'] });
  console.log('[BOOT] PrismaClient instanciado');
} catch (err: any) {
  console.error('[BOOT] Falha ao instanciar PrismaClient:', err?.message || err);
}
export const prisma = prismaClient;

// 3) Fastify — logger simples em prod
const isProd = process.env.NODE_ENV === 'production';
const fastify = Fastify({
  logger: isProd
    ? { level: process.env.LOG_LEVEL || 'info' }
    : {
        level: process.env.LOG_LEVEL || 'info',
        transport: { target: 'pino-pretty', options: { colorize: true } }
      }
});

// 4) Health check ANTES de tudo — se chegamos aqui, o app está vivo
fastify.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  prisma: !!prismaClient
}));

fastify.get('/', async () => ({
  status: 'ok',
  service: 'crm-comercial-backend',
  version: '1.0.0'
}));

// 5) CORS + Helmet — também protegidos
try {
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true
  });
  await fastify.register(helmet, { contentSecurityPolicy: false });
  console.log('[BOOT] CORS + Helmet registrados — origins:', allowedOrigins);
} catch (err: any) {
  console.error('[BOOT] Falha ao registrar CORS/Helmet:', err?.message || err);
}

// 6) Error handler global do Fastify
fastify.setErrorHandler((error, _request, reply) => {
  fastify.log.error({ err: error }, 'ERROR HANDLER');
  reply.status(500).send({
    status: 'error',
    message: 'Internal server error',
    error: error?.message || 'Unknown error'
  });
});

// 7) Graceful shutdown
process.on('SIGTERM', async () => {
  fastify.log.warn('SIGTERM recebido, fechando...');
  try { await fastify.close(); } catch {}
  try { if (prismaClient) await prismaClient.$disconnect(); } catch {}
  process.exit(0);
});

// 8a) Scheduler: envia lembrete 2h antes das reuniões
function iniciarSchedulerLembretes() {
  if (!prismaClient) return;
  const { enviarEmailLembreteAgendamento } = require('./services/email.service');

  const verificarLembretes = async () => {
    try {
      const agora = new Date();
      const em115min = new Date(agora.getTime() + 115 * 60 * 1000);
      const em135min = new Date(agora.getTime() + 135 * 60 * 1000);

      const pendentes = await prismaClient.atividade.findMany({
        where: {
          tipo: 'REUNIAO',
          status: { in: ['PENDENTE', 'CONFIRMADA'] },
          data_prevista: { gte: em115min, lte: em135min },
          lembrete_enviado_em: null,
          lead: { email: { not: null } }
        },
        include: { lead: { select: { nome: true, empresa: true, email: true } } }
      });

      for (const at of pendentes) {
        if (!at.lead?.email) continue;
        try {
          await enviarEmailLembreteAgendamento({
            cliente_nome: at.lead.nome,
            cliente_email: at.lead.email,
            cliente_empresa: at.lead.empresa || undefined,
            titulo: at.titulo,
            data_prevista: at.data_prevista,
            duracao_minutos: at.duracao_minutos || undefined,
            meet_link: at.google_meet_link || undefined,
            descricao: at.descricao || undefined,
          });
          await prismaClient.atividade.update({
            where: { id: at.id },
            data: { lembrete_enviado_em: new Date() }
          });
          console.log(`[LEMBRETE] E-mail enviado para ${at.lead.email} — reunião: ${at.titulo}`);
        } catch (err: any) {
          console.error(`[LEMBRETE] Falha ao enviar para ${at.lead.email}:`, err?.message);
        }
      }
    } catch (err: any) {
      console.error('[LEMBRETE] Erro no scheduler:', err?.message);
    }
  };

  // Verifica a cada 5 minutos
  setInterval(verificarLembretes, 5 * 60 * 1000);
  // Primeira verificação 1 min após o boot
  setTimeout(verificarLembretes, 60 * 1000);
  console.log('[BOOT] Scheduler de lembretes iniciado (intervalo: 5 min)');
}

// 8) Carrega rotas dinamicamente — cada uma isolada em try/catch.
//    Se UMA rota falhar ao importar/registrar, as outras continuam funcionando
//    e o /health permanece respondendo.
async function loadRoutes() {
  const routeModules: Array<[string, () => Promise<any>, string]> = [
    ['auth',                  () => import('./routes/auth'),                  'authRoutes'],
    ['casos-churn',           () => import('./routes/casos-churn'),           'casosChurnRoutes'],
    ['diagnosis-churn',       () => import('./routes/diagnosis-churn'),       'diagnosisChurnRoutes'],
    ['retencao',              () => import('./routes/retencao'),              'retencaoRoutes'],
    ['dashboard-retencao',    () => import('./routes/dashboard-retencao'),    'dashboardRetencaoRoutes'],
    ['clientes',              () => import('./routes/clientes'),              'clientesRoutes'],
    ['campanhas',             () => import('./routes/campanhas'),             'campanhasRoutes'],
    ['leads',                 () => import('./routes/leads'),                 'leadsRoutes'],
    ['atividades',            () => import('./routes/atividades'),            'atividadesRoutes'],
    ['propostas',             () => import('./routes/propostas'),             'propostasRoutes'],
    ['contratos',             () => import('./routes/contratos'),             'contratosRoutes'],
    ['metas',                 () => import('./routes/metas'),                 'metasRoutes'],
    ['complementos',          () => import('./routes/complementos'),          'complementosRoutes'],
    ['servicos',              () => import('./routes/servicos'),              'servicosRoutes'],
    ['comissoes',             () => import('./routes/comissoes'),             'comissoesRoutes'],
    ['health-score',          () => import('./routes/health-score'),          'healthScoreRoutes'],
    ['dashboard-power',       () => import('./routes/dashboard-power'),       'dashboardPowerRoutes'],
    ['relatorios-comerciais', () => import('./routes/relatorios-comerciais'), 'relatoriosComerciais'],
    ['usuarios',              () => import('./routes/usuarios'),              'usuariosRoutes'],
    ['funil',                 () => import('./routes/funil'),                 'funilRoutes'],
    ['vendas-adicionais',     () => import('./routes/vendas-adicionais'),     'vendasAdicionaisRoutes'],
    ['propostas-comerciais',  () => import('./routes/propostas-comerciais'),  'propostasComerciais'],
    ['kanban-colunas',        () => import('./routes/kanban-colunas'),        'kanbanColunasRoutes'],
    ['etiquetas',             () => import('./routes/etiquetas'),             'etiquetasRoutes'],
    ['dashboard-comercial',   () => import('./routes/dashboard-comercial'),   'dashboardComercialRoutes'],
    ['contratos-comerciais',  () => import('./routes/contratos-comerciais'),  'contratosComerciais'],
  ];

  let ok = 0;
  let fail = 0;
  for (const [name, importer, exportName] of routeModules) {
    try {
      const mod = await importer();
      const handler = mod[exportName];
      if (typeof handler !== 'function') {
        console.error(`[ROUTES] ${name}: export "${exportName}" não é função (got ${typeof handler})`);
        fail++;
        continue;
      }
      await fastify.register(handler, { prisma: prismaClient });
      ok++;
    } catch (err: any) {
      fail++;
      console.error(`[ROUTES] Falha ao carregar "${name}":`, err?.message || err);
      if (err?.stack) console.error(err.stack);
    }
  }
  console.log(`[ROUTES] ${ok} carregadas, ${fail} falharam`);
}

// 9) Start — listen primeiro (pra Railway ver a porta aberta), rotas depois.
//    Não, espera — Fastify exige registrar tudo antes do listen. Fazemos na ordem
//    correta mas envolvido em try/catch máximo.
const start = async () => {
  const port = parseInt(process.env.PORT || process.env.FASTIFY_PORT || '3001', 10);
  console.log(`[BOOT] Iniciando — porta=${port} host=0.0.0.0`);

  try {
    await loadRoutes();
  } catch (err: any) {
    console.error('[BOOT] loadRoutes lançou (não deveria):', err?.message || err);
  }

  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`[BOOT] ✅ Servidor escutando em 0.0.0.0:${port}`);
    console.log(`[BOOT] Health: http://0.0.0.0:${port}/health`);
    iniciarSchedulerLembretes();
  } catch (err: any) {
    console.error('[BOOT] ❌ Falha no fastify.listen:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    // Mesmo se listen falhar, NÃO matamos o processo imediatamente —
    // o Railway vai re-tentar, mas o log fica visível.
    process.exit(1);
  }
};

start().catch((err) => {
  console.error('[BOOT] start() rejeitou:', err?.stack || err);
  process.exit(1);
});
