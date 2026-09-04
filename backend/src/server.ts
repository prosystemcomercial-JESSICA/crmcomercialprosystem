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
console.log('[BOOT] build rev: dashboard-bigint-fix-2026-05-29');

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
  // Importação de clientes envia o lote em JSON; o padrão de 1MB estourava (413)
  // em planilhas grandes (1400+ linhas × 40 colunas). 25MB cobre com folga.
  bodyLimit: 25 * 1024 * 1024,
  logger: isProd
    ? { level: process.env.LOG_LEVEL || 'info' }
    : {
        level: process.env.LOG_LEVEL || 'info',
        transport: { target: 'pino-pretty', options: { colorize: true } }
      }
});

// 4) Health check ANTES de tudo — se chegamos aqui, o app está vivo
// `versao` = commit do deploy (Railway injeta RAILWAY_GIT_COMMIT_SHA); o front
// usa isso para detectar nova versão e recarregar sozinho (mata o cache antigo).
const VERSAO_DEPLOY = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERSAO || 'dev';
fastify.get('/health', async () => ({
  status: 'ok',
  rev: 'bigint-fix-v2',
  versao: VERSAO_DEPLOY,
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
      // Libera: sem origin (curl/health), os domínios da FRONTEND_URL, qualquer
      // subdomínio *.up.railway.app (Railway) e *.vercel.app — assim trocar o link
      // do CRM no Railway NUNCA derruba o login por CORS.
      const ok = !origin
        || allowedOrigins.some(o => origin.startsWith(o))
        || /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/i.test(origin)
        || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
      if (ok) cb(null, true);
      else cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true
  });
  await fastify.register(helmet, { contentSecurityPolicy: false });
  console.log('[BOOT] CORS + Helmet registrados — origins:', allowedOrigins);
} catch (err: any) {
  console.error('[BOOT] Falha ao registrar CORS/Helmet:', err?.message || err);
}

// 5b) Hook global de auth opcional — popula request.user se houver Bearer token
// Não bloqueia se não tiver. Permite rotas públicas + identificação automática
// em rotas autenticadas que não usam requireAuth explicitamente.
try {
  const { AuthService } = await import('./services/auth.service.js');
  const _authService = new AuthService();
  fastify.addHook('onRequest', async (request) => {
    const auth = request.headers.authorization;
    // EventSource nativo do navegador não manda headers customizados — a
    // rota de SSE (/whatsapp/eventos) recebe o token via query string em vez
    // de Authorization. Só essa rota aceita esse fallback (menor superfície).
    const tokenQuery = request.url.startsWith('/whatsapp/eventos') ? (request.query as any)?.token : undefined;
    if (!auth && !tokenQuery) return;
    const token = auth ? auth.replace(/^Bearer\s+/i, '').trim() : tokenQuery;
    if (!token) return;
    try {
      const decoded: any = _authService.verifyAccessToken(token);
      (request as any).user = {
        id: decoded.userId,
        nome: decoded.nome,
        email: decoded.email,
        role: decoded.role
      };
    } catch { /* token inválido — segue sem user */ }
  });
  console.log('[BOOT] Hook global de auth opcional registrado');
} catch (err: any) {
  console.error('[BOOT] Falha ao registrar hook global de auth:', err?.message || err);
}

// 6) Error handler global do Fastify
fastify.setErrorHandler((error: any, request, reply) => {
  // Detecta erros conhecidos para retornar status + mensagem amigável
  const msg = error?.message || 'Unknown error';
  let statusCode = 500;
  let userMsg = 'Erro interno. Sua ação foi salva se chegou no banco — tente recarregar.';

  if (error?.code === 'P2002') { statusCode = 409; userMsg = 'Já existe um registro com esses dados.'; }
  else if (error?.code === 'P2025') { statusCode = 404; userMsg = 'Registro não encontrado.'; }
  else if (error?.code === 'P2003') { statusCode = 400; userMsg = 'Referência inválida (registro relacionado não existe).'; }
  else if (msg.includes('BigInt')) { userMsg = 'Erro de conversão numérica — comunicado aos desenvolvedores.'; }
  else if (msg.includes('timeout')) { statusCode = 504; userMsg = 'Tempo de resposta excedido. Tente novamente.'; }
  else if (error?.statusCode) { statusCode = error.statusCode; userMsg = msg; }

  // Log detalhado para diagnóstico (aparece nos logs do Railway)
  console.error('[ERROR HANDLER]', JSON.stringify({ code: error?.code, msg, meta: error?.meta, url: request.url }));

  fastify.log.error({
    err: error,
    url: request.url,
    method: request.method,
    user: (request as any).user?.id
  }, 'ERROR HANDLER');

  reply.status(statusCode).send({
    status: 'error',
    message: userMsg,
    error: msg,
    code: error?.code || null
  });
});

// Catch all unhandled rejections/exceptions — NUNCA matar o processo
process.on('unhandledRejection', (reason: any) => {
  fastify.log.error({ err: reason }, 'UNHANDLED REJECTION (capturado, processo continua)');
});
process.on('uncaughtException', (err: any) => {
  fastify.log.error({ err }, 'UNCAUGHT EXCEPTION (capturado, processo continua)');
});

// 7) Graceful shutdown
process.on('SIGTERM', async () => {
  fastify.log.warn('SIGTERM recebido, fechando...');
  try { await fastify.close(); } catch {}
  try { if (prismaClient) await prismaClient.$disconnect(); } catch {}
  process.exit(0);
});

// 8a) Scheduler: envia lembrete 2h antes das reuniões
async function iniciarSchedulerLembretes() {
  if (!prismaClient) return;
  const { enviarEmailLembreteAgendamento } = await import('./services/email.service.js');

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

// 8b) Scheduler: digest 2x ao dia (manhã/tarde) — pendências do funil por usuário.
//     Vendedor recebe só o próprio; gestão (CEO/ADMIN/SUPERVISAO_COMERCIAL) o consolidado.
//     Não mexe no schema: anti-duplicação por janela via flag em memória.
async function iniciarSchedulerDigest() {
  if (!prismaClient) return;
  const ROLES_GESTAO = ['CEO', 'DIRETOR', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO'];
  // Janelas em horário de Brasília (UTC-3). Ex.: 8h e 17h locais → 11 e 20 UTC.
  const HORA_MANHA_UTC = 11;
  const HORA_TARDE_UTC = 20;

  // Guarda "YYYY-MM-DD:janela:userId" já enviados, para não duplicar no mesmo ciclo.
  const enviados = new Set<string>();

  const janelaAtual = (d: Date): 'manha' | 'tarde' | null => {
    const h = d.getUTCHours();
    if (h === HORA_MANHA_UTC) return 'manha';
    if (h === HORA_TARDE_UTC) return 'tarde';
    return null;
  };

  const rodar = async () => {
    try {
      const agora = new Date();
      const janela = janelaAtual(agora);
      if (!janela) return; // fora das janelas → nada a fazer

      const dia = agora.toISOString().slice(0, 10);
      // Limpa marcações de dias anteriores (mantém o Set pequeno).
      for (const k of enviados) if (!k.startsWith(dia)) enviados.delete(k);

      const {
        coletarPendenciasDoUsuario, enviarEmailDigestVendedor, enviarEmailDigestGestao,
      } = await import('./services/notification.service.js');

      const usuarios = await prismaClient!.usuarioCRM.findMany({
        where: { status: 'ATIVO', email: { not: '' } },
        select: { id: true, nome: true, email: true, cargo: true },
      });

      const saudacao = janela === 'manha' ? 'Bom dia' : 'Boa tarde';

      for (const u of usuarios) {
        const chave = `${dia}:${janela}:${u.id}`;
        if (enviados.has(chave)) continue;

        const verTudo = ROLES_GESTAO.includes((u.cargo || '').toUpperCase());
        try {
          const pendencias = await coletarPendenciasDoUsuario(prismaClient!, u.id, verTudo);
          if (pendencias.total === 0) { enviados.add(chave); continue; } // marca p/ não reprocessar

          const payload = { email: u.email, nome: u.nome.split(' ')[0], saudacao, pendencias };
          if (verTudo) await enviarEmailDigestGestao(payload);
          else await enviarEmailDigestVendedor(payload);
          enviados.add(chave);
        } catch (err: any) {
          console.error(`[DIGEST] Falha para ${u.email}:`, err?.message);
        }
      }
    } catch (err: any) {
      console.error('[DIGEST] Erro no scheduler:', err?.message);
    }
  };

  // Verifica a cada 15 min; só age dentro das janelas horárias.
  setInterval(rodar, 15 * 60 * 1000);
  setTimeout(rodar, 90 * 1000); // primeira verificação ~1,5 min após boot
  console.log('[BOOT] Scheduler de digest iniciado (2x/dia: manhã e tarde)');
}

// 8c) Scheduler: motor de regras (EVO-3) — roda 1x/dia (~7h BRT = 10h UTC).
//     Cria tarefas automáticas (lead parado, renovação próxima). Idempotente.
async function iniciarSchedulerAutomacao() {
  if (!prismaClient) return;
  const HORA_UTC = 10;
  let ultimoDia = '';

  const rodar = async () => {
    try {
      const agora = new Date();
      if (agora.getUTCHours() !== HORA_UTC) return;
      const dia = agora.toISOString().slice(0, 10);
      if (dia === ultimoDia) return; // já rodou hoje
      ultimoDia = dia;

      const { rodarMotorDeRegras } = await import('./services/automation.service.js');
      await rodarMotorDeRegras(prismaClient!);
    } catch (err: any) {
      console.error('[AUTO] Erro no scheduler:', err?.message);
    }
  };

  setInterval(rodar, 15 * 60 * 1000); // verifica a cada 15 min; age 1x/dia na janela
  setTimeout(rodar, 120 * 1000);
  console.log('[BOOT] Scheduler de automação iniciado (motor de regras 1x/dia)');
}

// 8d) Scheduler: sequência de e-mail das padarias — roda 1x/dia (~10h BRT = 13h UTC).
//     Processa LeadSequenciaEmail pendentes e dispara o próximo e-mail de cada um.
async function iniciarSchedulerSequenciaEmail() {
  if (!prismaClient) return;
  const HORA_UTC_SEQUENCIA = 13; // ~10h no horário de Brasília
  let ultimoDiaSequenciaEmail = '';

  const rodarSequenciaEmail = async () => {
    try {
      const agora = new Date();
      if (agora.getUTCHours() !== HORA_UTC_SEQUENCIA) return;
      const dia = agora.toISOString().slice(0, 10);
      if (dia === ultimoDiaSequenciaEmail) return; // já rodou hoje
      ultimoDiaSequenciaEmail = dia;

      const { rodarSchedulerSequenciaEmail } = await import('./services/sequencia-email.service.js');
      const resultado = await rodarSchedulerSequenciaEmail(prismaClient!);
      console.log(`[SEQUENCIA-EMAIL] ${resultado.processados} processados, ${resultado.enviados} enviados, ${resultado.erros} erros`);
    } catch (err: any) {
      console.error('[SEQUENCIA-EMAIL] Erro no scheduler:', err?.message);
    }
  };

  setInterval(rodarSequenciaEmail, 15 * 60 * 1000); // verifica a cada 15 min; age 1x/dia na janela
  setTimeout(rodarSequenciaEmail, 150 * 1000);
  console.log('[BOOT] Scheduler da sequência de e-mail (padarias) iniciado');
}

// 8e) Scheduler: cadência automática de WhatsApp (farmácia/manipulação em
//     AGUARDANDO_RETORNO) — verifica a cada 15 min e dispara o que venceu.
async function iniciarSchedulerCadenciaWhatsapp() {
  if (!prismaClient) return;

  const rodar = async () => {
    try {
      const { rodarSchedulerCadenciaWhatsapp } = await import('./services/whatsapp-cadencia.service.js');
      const resultado = await rodarSchedulerCadenciaWhatsapp(prismaClient!);
      if (resultado.processados > 0) {
        console.log(`[CADENCIA-WPP] ${resultado.processados} processados, ${resultado.enviados} enviados, ${resultado.erros} erros`);
      }
    } catch (err: any) {
      console.error('[CADENCIA-WPP] Erro no scheduler:', err?.message);
    }
  };

  setInterval(rodar, 15 * 60 * 1000);
  setTimeout(rodar, 180 * 1000);
  console.log('[BOOT] Scheduler da cadência de WhatsApp (farmácia/manipulação) iniciado');
}

// 8f) Scheduler: expiração de propostas comerciais — marca EXPIRADA toda
//     proposta sem decisão do cliente após a data de validade.
async function iniciarSchedulerExpiracaoPropostas() {
  if (!prismaClient) return;

  const rodar = async () => {
    try {
      const { rodarSchedulerExpiracaoPropostas } = await import('./services/proposta-expiracao.service.js');
      const resultado = await rodarSchedulerExpiracaoPropostas(prismaClient!);
      if (resultado.expiradas > 0) {
        console.log(`[PROPOSTA-EXPIRACAO] ${resultado.expiradas} proposta(s) marcada(s) como EXPIRADA`);
      }
    } catch (err: any) {
      console.error('[PROPOSTA-EXPIRACAO] Erro no scheduler:', err?.message);
    }
  };

  setInterval(rodar, 60 * 60 * 1000); // 1x/hora — expiração não precisa de granularidade fina
  setTimeout(rodar, 210 * 1000);
  console.log('[BOOT] Scheduler de expiração de propostas iniciado');
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
    ['sequencia-email',       () => import('./routes/sequencia-email'),       'sequenciaEmailRoutes'],
    ['cliente-documentos',    () => import('./routes/cliente-documentos'),    'clienteDocumentosRoutes'],
    ['leads',                 () => import('./routes/leads'),                 'leadsRoutes'],
    ['atividades',            () => import('./routes/atividades'),            'atividadesRoutes'],
    ['propostas',             () => import('./routes/propostas'),             'propostasRoutes'],
    ['contratos',             () => import('./routes/contratos'),             'contratosRoutes'],
    ['metas',                 () => import('./routes/metas'),                 'metasRoutes'],
    ['complementos',          () => import('./routes/complementos'),          'complementosRoutes'],
    ['servicos',              () => import('./routes/servicos'),              'servicosRoutes'],
    ['comissoes',             () => import('./routes/comissoes'),             'comissoesRoutes'],
    ['implantacoes',          () => import('./routes/implantacoes'),          'implantacoesRoutes'],
    ['health-score',          () => import('./routes/health-score'),          'healthScoreRoutes'],
    ['dashboard-power',       () => import('./routes/dashboard-power'),       'dashboardPowerRoutes'],
    ['relatorios-comerciais', () => import('./routes/relatorios-comerciais'), 'relatoriosComerciais'],
    ['usuarios',              () => import('./routes/usuarios'),              'usuariosRoutes'],
    ['funil',                 () => import('./routes/funil'),                 'funilRoutes'],
    ['vendas-adicionais',     () => import('./routes/vendas-adicionais'),     'vendasAdicionaisRoutes'],
    ['propostas-comerciais',  () => import('./routes/propostas-comerciais'),  'propostasComerciais'],
    ['kanban-colunas',        () => import('./routes/kanban-colunas'),        'kanbanColunasRoutes'],
    ['quadros',               () => import('./routes/quadros'),               'quadrosRoutes'],
    ['etiquetas',             () => import('./routes/etiquetas'),             'etiquetasRoutes'],
    ['dashboard-comercial',   () => import('./routes/dashboard-comercial'),   'dashboardComercialRoutes'],
    ['contratos-comerciais',  () => import('./routes/contratos-comerciais'),  'contratosComerciais'],
    ['auditoria',             () => import('./routes/auditoria'),             'auditoriaRoutes'],
    ['whatsapp',              () => import('./routes/whatsapp'),              'whatsappRoutes'],
    ['forecast',              () => import('./routes/forecast'),              'forecastRoutes'],
    ['analise-comercial',     () => import('./routes/analise-comercial'),     'analiseComercialRoutes'],
    ['pipeline-comercial',    () => import('./routes/pipeline-comercial'),    'pipelineComercialRoutes'],
    ['financeiro',            () => import('./routes/financeiro'),            'financeiroRoutes'],
    ['pesquisa',              () => import('./routes/pesquisa'),              'pesquisaRoutes'],
    ['relatorio-comercial',   () => import('./routes/relatorio-comercial'),   'relatorioComercialRoutes'],
    ['lancamentos-retroativos', () => import('./routes/lancamentos-retroativos'), 'lancamentosRetroativosRoutes'],
    ['ativos',                () => import('./routes/ativos'),                'ativosRoutes'],
    ['ceo',                   () => import('./routes/ceo'),                   'ceoRoutes'],
    ['kb',                    () => import('./routes/kb'),                    'kbRoutes'],
    ['csat',                  () => import('./routes/csat'),                  'csatRoutes'],
    ['candidatos-representante', () => import('./routes/candidatos-representante'), 'candidatosRepresentanteRoutes'],
    ['sdr',                   () => import('./routes/sdr'),                   'sdrRoutes'],
    ['backups',               () => import('./routes/backups'),               'backupsRoutes'],
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
    iniciarSchedulerDigest();
    iniciarSchedulerAutomacao();
    iniciarSchedulerSequenciaEmail();
    iniciarSchedulerCadenciaWhatsapp();
    iniciarSchedulerExpiracaoPropostas();

    import('./services/whatsapp-eventos.service.js')
      .then(({ iniciarHeartbeatSSE }) => { iniciarHeartbeatSSE(); console.log('[BOOT] Heartbeat SSE do WhatsApp iniciado'); })
      .catch((e) => console.error('[BOOT] Falha ao iniciar heartbeat SSE:', e?.message));

    // Keepalive: MySQL do Railway fecha conexões idle após ~8 min.
    // Um SELECT 1 a cada 4 min mantém a conexão viva sem custo.
    if (prismaClient) {
      setInterval(async () => {
        try { await prismaClient.$queryRaw`SELECT 1`; }
        catch { /* silencioso — reconecta sozinho na próxima query */ }
      }, 4 * 60 * 1000);
      console.log('[BOOT] Keepalive do banco iniciado (4 min)');
    }
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
