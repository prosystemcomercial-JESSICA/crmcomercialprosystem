import { FastifyInstance } from 'fastify';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { getUser, podeVerTudo, requireGestor } from '@/lib/scope';
import * as evo from '@/services/evolution.service';
import { calcularSlaPrazo } from '@/services/whatsapp-sla.service';
import { entrarNaCadencia, pausarCadencia } from '@/services/whatsapp-cadencia.service';
import { registrarClienteSSE, emitirEventoConversa } from '@/services/whatsapp-eventos.service';
import { obterConfigTriagem, salvarConfigTriagem } from '@/services/triagem-config.service';
import { executarTriagem, emTriagem, detectarCnpjNaConversa, aplicarReceitaNoLead } from '@/services/triagem-executor.service';
import {
  INSTANCIA_EMPRESA, APELIDO_EMPRESA, obterInstanciaEmpresa, tokenWebhookConfere,
  whereListaConversas, whereAcaoConversa, whereLeituraConversa,
} from '@/lib/whatsapp-empresa';
import { TIPOS_CONTATO, decidirIdentificacao } from '@/lib/whatsapp-identificar';
import { dadosSairDoFunil as dadosSairDoFunilSvc, vincularContatoCliente as vincularContatoClienteSvc } from '@/services/whatsapp-vinculo.service';
import { responderConfirmacaoCliente, limparConfirmacaoPendente, chaveConversa } from '@/services/whatsapp-confirmacao-cliente.service';
import { serializarPorChave } from '@/lib/serializar';
import { agendarAnaliseIa, textoParaIa } from '@/services/laya.service';
import { validarRotulos, medirAcerto } from '@/lib/laya';
import { ehPayloadUazapi, parseUazapiEvento, EventoMensagemUazapi } from '@/lib/uazapi-webhook-parser';

// Etapas do funil comercial de WhatsApp (Kanban) — ordem de exibição.
export const ESTAGIOS_FUNIL = ['NOVO_CONTATO', 'EM_NEGOCIACAO', 'PROPOSTA_ENVIADA', 'AGUARDANDO_RETORNO', 'FECHADO'] as const;
export const PRIORIDADES = ['BAIXA', 'NORMAL', 'CRITICA'] as const;

// WhatsApp Inbox multi-instância (via UazAPI).
//   - Cada usuário conecta a SUA instância (instancia_nome = `crm-<userId>`,
//     um identificador só do CRM — quem autentica na UazAPI é o
//     instance_token retornado na criação, ver evolution.service.ts).
//   - Escopo: vendedor vê só as conversas das próprias instâncias (dono_id);
//     gestão (podeVerTudo) vê todas.
//   - O webhook de recebimento é público (a UazAPI chama sem auth do CRM),
//     então ele resolve a instância pelo nome e nunca confia em quem chamou.
//   - WhatsApp da empresa (instancia_nome = 'empresa', ver lib/whatsapp-empresa):
//     uma instância para o CRM todo. Conversa de número novo nasce sem dono
//     (pool, dono_id = null) e o vendedor assume. O webhook dela vem no formato
//     nativo da UAZAPI e é autenticado pelo token da instância no payload.

export async function whatsappRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;
  const comandosVistos = new Set<string>(); // ids de mensagens-comando da gestão já respondidas

  const instanciaNomeDe = (userId: string) => `crm-${userId}`;

  // O hook global de auth (server.ts) só popula request.user, nunca bloqueia.
  // Aqui (escopo deste plugin) toda rota exige usuário, exceto o webhook, que é
  // chamado pela UAZAPI e se autentica pelo token no próprio payload.
  fastify.addHook('onRequest', async (request, reply) => {
    const rota = (request as any).routeOptions?.url ?? (request as any).routerPath;
    if (rota === '/whatsapp/webhook') return;
    if (!getUser(request)?.id) {
      return reply.status(401).send({ status: 'error', message: 'Não autenticado' });
    }
  });

  // Ações numa conversa: dono ou conversa do pool (sem dono).
  function escopoDono(request: any): Record<string, any> {
    return whereAcaoConversa(getUser(request));
  }

  const MSG_USA_EMPRESA = 'Este CRM usa o WhatsApp da empresa';

  // Conversa do pool respondida/usada por alguém → essa pessoa vira dona
  // (atômico: só assume se ainda estiver sem dono). Lead sem responsável
  // passa a ser da pessoa também.
  async function assumirSeSemDono(conversa: { id: string; dono_id: string | null; lead_id: string | null }, user: any): Promise<boolean> {
    if (conversa.dono_id || !user?.id) return false;
    const r = await prisma.whatsappConversa.updateMany({ where: { id: conversa.id, dono_id: null }, data: { dono_id: user.id } });
    if (r.count === 0) return false;
    if (conversa.lead_id) {
      await prisma.lead.updateMany({
        where: { id: conversa.lead_id, responsavel_id: null },
        data: { responsavel_id: user.id, vendedor_nome: user.nome || undefined, atribuido_em: new Date() },
      }).catch(() => {});
    }
    // Some do pool de todo mundo → avisa todos os conectados.
    emitirEventoConversa(null, 'conversa_atualizada', { conversaId: conversa.id });
    return true;
  }

  // Vendedor falou na conversa: o robô para ali mesmo.
  async function pararRobo(conversaId: string) {
    await prisma.whatsappConversa.updateMany({ where: { id: conversaId, bot_ativo: true }, data: { bot_ativo: false } }).catch(() => {});
  }

  // Status ao vivo da instância da empresa (sincroniza status/número no banco).
  // Nunca inclui o token.
  async function resumoEmpresa(inst: { id: string; instance_token: string | null; status: string; numero: string | null; conectado_em: Date | null }) {
    const r = await evo.obterStatus(inst.instance_token || '');
    const numero = r.numero || inst.numero || null;
    if (r.status !== inst.status || numero !== inst.numero) {
      await prisma.whatsappInstancia.update({
        where: { id: inst.id },
        data: { status: r.status, numero, conectado_em: r.status === 'CONECTADO' ? (inst.conectado_em ?? new Date()) : inst.conectado_em },
      }).catch(() => {});
    }
    return {
      configurado: true,
      conectado: r.status === 'CONECTADO',
      status: r.status,
      numero,
      instanciaId: inst.id,
      webhook_url: process.env.EVOLUTION_WEBHOOK_URL || null,
    };
  }

  // ===== WHATSAPP DA EMPRESA (configuração — só gestão) =====
  fastify.get('/whatsapp/empresa', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const inst = await obterInstanciaEmpresa(prisma);
    if (!inst) {
      return reply.send({ status: 'success', data: { configurado: false, conectado: false, numero: null, status: 'DESCONECTADO', webhook_url: process.env.EVOLUTION_WEBHOOK_URL || null } });
    }
    return reply.send({ status: 'success', data: await resumoEmpresa(inst) });
  });

  // Salva o token da instância da empresa: valida na UAZAPI antes de gravar,
  // registra o webhook e devolve o status (sem o token).
  fastify.put('/whatsapp/empresa', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const user = getUser(request)!;
    const body = z.object({ instance_token: z.string().trim().min(8) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe o token da instância.' });
    if (!process.env.EVOLUTION_API_URL) {
      return reply.status(400).send({ status: 'error', message: 'EVOLUTION_API_URL não configurada no servidor.' });
    }
    const token = body.data.instance_token;

    // obterStatus devolve DESCONECTADO tanto para token inválido quanto para
    // instância sem celular pareado — nos dois casos não dá para usar.
    const st = await evo.obterStatus(token);
    if (st.status === 'DESCONECTADO') {
      return reply.status(400).send({
        status: 'error',
        message: 'Não foi possível validar o token: a UAZAPI não reconheceu a instância ou ela está desconectada. Confira o token e se o número está pareado.',
      });
    }

    const agora = new Date();
    const inst = await prisma.whatsappInstancia.upsert({
      where: { instancia_nome: INSTANCIA_EMPRESA },
      create: {
        instancia_nome: INSTANCIA_EMPRESA, apelido: APELIDO_EMPRESA, dono_id: user.id, dono_nome: user.nome,
        instance_token: token, status: st.status, numero: st.numero || null,
        conectado_em: st.status === 'CONECTADO' ? agora : null,
      },
      update: {
        apelido: APELIDO_EMPRESA, instance_token: token, status: st.status, numero: st.numero || undefined, qr_code: null,
        ...(st.status === 'CONECTADO' ? { conectado_em: agora } : {}),
      },
    });
    const webhookOk = await evo.configurarWebhook(token);
    console.log(`[WPP] WhatsApp da empresa configurado por ${user.id} (status ${st.status}, webhook ${webhookOk ? 'OK' : 'FALHOU'})`);
    return reply.send({ status: 'success', data: { ...(await resumoEmpresa(inst)), webhook_configurado: webhookOk } });
  });

  // ===== TRIAGEM AUTOMÁTICA (configuração — só gestão) =====
  // ~16 MB decodificados ≈ 22 milhões de caracteres em base64.
  const LIMITE_DATA_URL = 22_000_000;
  const materialSchema = z.object({
    texto: z.string().max(4000),
    imagem: z.string().startsWith('data:image/').max(LIMITE_DATA_URL, 'Imagem maior que 16 MB').nullable(),
    pdf: z.string().startsWith('data:application/pdf').max(LIMITE_DATA_URL, 'PDF maior que 16 MB').nullable(),
    pdf_nome: z.string().max(200).nullable(),
  });

  fastify.get('/whatsapp/triagem', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    return reply.send({ status: 'success', data: await obterConfigTriagem(prisma) });
  });

  fastify.put('/whatsapp/triagem', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const body = z.object({ ativa: z.boolean(), material: z.object({ farmacia: materialSchema, padaria: materialSchema }) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: body.error.errors[0]?.message || 'Dados inválidos' });
    await salvarConfigTriagem(prisma, body.data, getUser(request)?.id);
    return reply.send({ status: 'success' });
  });

  // ===== TEMPO REAL (SSE) =====
  // Substitui o polling do frontend: o navegador abre esta conexão e recebe
  // "data: {...}" a cada mensagem nova/mudança de conversa, sem precisar
  // perguntar "tem novidade?" a cada poucos segundos.
  fastify.get('/whatsapp/eventos', async (request, reply) => {
    const user = getUser(request);
    if (!user?.id) return reply.status(401).send({ status: 'error', message: 'Não autenticado' });

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // desliga buffering de proxy (nginx), essencial p/ SSE
    });
    reply.raw.write(': conectado\n\n');

    const remover = registrarClienteSSE(reply, user.id, podeVerTudo(user));
    request.raw.on('close', remover);
  });

  // ===== STATUS / CONEXÃO =====

  // Status da instância do usuário logado (cria registro local na 1ª vez).
  fastify.get('/whatsapp/instancia', async (request, reply) => {
    const user = getUser(request);
    if (!user?.id) return reply.status(401).send({ status: 'error', message: 'Não autenticado' });
    if (!evo.evolutionConfigurada()) {
      return reply.send({ status: 'success', data: { configurado: false, status: 'DESCONECTADO' } });
    }

    const nome = instanciaNomeDe(user.id);
    let inst = await prisma.whatsappInstancia.findUnique({ where: { instancia_nome: nome } });

    // Sincroniza status real com a UazAPI (precisa do token DESSA instância).
    let statusReal: 'CONECTADO' | 'CONECTANDO' | 'DESCONECTADO' = 'DESCONECTADO';
    if (inst?.instance_token) {
      const r = await evo.obterStatus(inst.instance_token);
      statusReal = r.status;
      if (statusReal === 'CONECTADO' && inst.status !== 'CONECTADO') {
        await evo.configurarWebhook(inst.instance_token).catch(() => {});
      }
      inst = await prisma.whatsappInstancia.update({
        where: { id: inst.id },
        data: {
          status: statusReal,
          numero: r.numero || inst.numero,
          conectado_em: statusReal === 'CONECTADO' ? (inst.conectado_em ?? new Date()) : inst.conectado_em,
        },
      });
    }

    return reply.send({
      status: 'success',
      data: { configurado: true, status: statusReal, instancia: inst },
    });
  });

  // Inicia conexão: cria a instância na UazAPI e devolve o QR Code.
  fastify.post('/whatsapp/conectar', async (request, reply) => {
    const user = getUser(request);
    if (!user?.id) return reply.status(401).send({ status: 'error', message: 'Não autenticado' });
    if (await obterInstanciaEmpresa(prisma)) return reply.status(409).send({ status: 'error', message: MSG_USA_EMPRESA });
    if (!evo.evolutionConfigurada()) {
      return reply.status(400).send({ status: 'error', message: 'Evolution API não configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY)' });
    }

    const nome = instanciaNomeDe(user.id);
    const existente = await prisma.whatsappInstancia.findUnique({ where: { instancia_nome: nome } });
    let qr: string | undefined;
    let instanceToken: string | undefined = existente?.instance_token || undefined;
    if (!instanceToken) {
      // Instância nova → cria e guarda o token retornado.
      const r = await evo.criarInstancia(nome);
      qr = r.qr;
      instanceToken = r.instanceToken;
    } else {
      // Já existe: só reobtém o QR com o token salvo.
      const r = await evo.obterQrCode(instanceToken);
      qr = r.qr;
    }

    await prisma.whatsappInstancia.upsert({
      where: { instancia_nome: nome },
      create: { instancia_nome: nome, dono_id: user.id, dono_nome: user.nome, status: 'CONECTANDO', qr_code: qr, instance_token: instanceToken },
      update: { status: 'CONECTANDO', qr_code: qr, ...(instanceToken ? { instance_token: instanceToken } : {}) },
    });

    return reply.send({ status: 'success', data: { qr, status: 'CONECTANDO' } });
  });

  // Desconecta a instância do usuário.
  fastify.post('/whatsapp/desconectar', async (request, reply) => {
    const user = getUser(request);
    if (!user?.id) return reply.status(401).send({ status: 'error', message: 'Não autenticado' });
    const nome = instanciaNomeDe(user.id);
    const inst = await prisma.whatsappInstancia.findUnique({ where: { instancia_nome: nome } });
    if (inst?.instance_token) await evo.desconectarInstancia(inst.instance_token);
    await prisma.whatsappInstancia.updateMany({
      where: { instancia_nome: nome },
      data: { status: 'DESCONECTADO', qr_code: null },
    });
    return reply.send({ status: 'success' });
  });

  // ===== MULTI-INSTÂNCIA =====
  // Lista todas as instâncias do usuário (sincroniza status com a UazAPI).
  fastify.get('/whatsapp/instancias', async (request, reply) => {
    const user = getUser(request);
    if (!user?.id) return reply.status(401).send({ status: 'error', message: 'Não autenticado' });

    // WhatsApp da empresa configurado: a tela não mostra instâncias por
    // vendedor, só o status da instância única (o token nunca sai daqui).
    const empresa = await obterInstanciaEmpresa(prisma);
    if (empresa) {
      const resumo = await resumoEmpresa(empresa);
      return reply.send({ status: 'success', data: { configurado: true, empresa: resumo, instancias: [] } });
    }

    if (!evo.evolutionConfigurada()) return reply.send({ status: 'success', data: { configurado: false, instancias: [] } });

    const lista = await prisma.whatsappInstancia.findMany({ where: { dono_id: user.id, instancia_nome: { not: INSTANCIA_EMPRESA } }, orderBy: { created_at: 'asc' } });
    // Atualiza status real de cada uma (precisa do token DA instância).
    for (const i of lista) {
      if (!i.instance_token) continue; // instância antiga sem token salvo — precisa reconectar
      const r = await evo.obterStatus(i.instance_token).catch(() => ({ status: i.status as any }));
      // Acabou de ficar conectada: garante que o webhook está configurado
      // nessa instância (sem isso, mensagens recebidas nunca chegam ao CRM).
      if (r.status === 'CONECTADO' && i.status !== 'CONECTADO') {
        await evo.configurarWebhook(i.instance_token).catch(() => {});
      }
      if (r.status !== i.status || (r.numero && r.numero !== i.numero)) {
        await prisma.whatsappInstancia.update({
          where: { id: i.id },
          data: { status: r.status, numero: r.numero || i.numero, conectado_em: r.status === 'CONECTADO' ? (i.conectado_em ?? new Date()) : i.conectado_em },
        }).catch(() => {});
      }
      (i as any).status = r.status;
      if (r.numero) (i as any).numero = r.numero;
    }
    return reply.send({ status: 'success', data: { configurado: true, instancias: lista } });
  });

  // Cria uma nova instância nomeada e devolve o QR.
  fastify.post('/whatsapp/instancias', async (request, reply) => {
    const user = getUser(request);
    if (!user?.id) return reply.status(401).send({ status: 'error', message: 'Não autenticado' });
    if (await obterInstanciaEmpresa(prisma)) return reply.status(409).send({ status: 'error', message: MSG_USA_EMPRESA });
    if (!evo.evolutionConfigurada()) return reply.status(400).send({ status: 'error', message: 'Evolution API não configurada' });
    const body = z.object({ apelido: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe um nome para a instância' });

    // Nome técnico único: crm-<userId>-<slug>-<rand>.
    const slug = body.data.apelido.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20);
    const nome = `crm-${user.id}-${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const r = await evo.criarInstancia(nome);
    const inst = await prisma.whatsappInstancia.create({
      data: { instancia_nome: nome, apelido: body.data.apelido, dono_id: user.id, dono_nome: user.nome, status: 'CONECTANDO', qr_code: r.qr, instance_token: r.instanceToken },
    });
    return reply.send({ status: 'success', data: { instancia: inst, qr: r.qr } });
  });

  // Reobtém QR de uma instância (reconectar).
  fastify.post('/whatsapp/instancias/:id/conectar', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    if (await obterInstanciaEmpresa(prisma)) return reply.status(409).send({ status: 'error', message: MSG_USA_EMPRESA });
    const inst = await prisma.whatsappInstancia.findFirst({ where: { id, dono_id: user?.id, instancia_nome: { not: INSTANCIA_EMPRESA } } });
    if (!inst) return reply.status(404).send({ status: 'error', message: 'Instância não encontrada' });
    let qr: string | undefined;
    let instanceToken = inst.instance_token || undefined;
    if (!instanceToken) {
      // Instância antiga (criada antes do token ser salvo) — recria do zero.
      const r = await evo.criarInstancia(inst.instancia_nome);
      qr = r.qr;
      instanceToken = r.instanceToken;
    } else {
      const r = await evo.obterQrCode(instanceToken);
      qr = r.qr;
    }
    await prisma.whatsappInstancia.update({ where: { id }, data: { status: 'CONECTANDO', qr_code: qr, ...(instanceToken ? { instance_token: instanceToken } : {}) } });
    return reply.send({ status: 'success', data: { qr } });
  });

  // Desconecta uma instância específica.
  fastify.post('/whatsapp/instancias/:id/desconectar', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const inst = await prisma.whatsappInstancia.findFirst({ where: { id, dono_id: user?.id, instancia_nome: { not: INSTANCIA_EMPRESA } } });
    if (!inst) return reply.status(404).send({ status: 'error', message: 'Instância não encontrada' });
    if (inst.instance_token) await evo.desconectarInstancia(inst.instance_token);
    await prisma.whatsappInstancia.update({ where: { id }, data: { status: 'DESCONECTADO', qr_code: null } });
    return reply.send({ status: 'success' });
  });

  // Apaga a instância de vez (logout + delete na UazAPI + remove do banco).
  // Usar quando "desconectar" não basta (instância travada/órfã).
  fastify.delete('/whatsapp/instancias/:id', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const inst = await prisma.whatsappInstancia.findFirst({ where: { id, dono_id: user?.id, instancia_nome: { not: INSTANCIA_EMPRESA } } });
    if (!inst) return reply.status(404).send({ status: 'error', message: 'Instância não encontrada' });
    if (inst.instance_token) await evo.deletarInstancia(inst.instance_token).catch(() => {});
    await prisma.whatsappInstancia.delete({ where: { id } }).catch(() => {});
    return reply.send({ status: 'success' });
  });

  // Excluir uma conversa (e suas mensagens).
  fastify.delete('/whatsapp/conversas/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const conversa = await prisma.whatsappConversa.findFirst({ where: { id, ...escopoDono(request) } });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });
    await prisma.whatsappConversa.delete({ where: { id } }).catch(() => {}); // cascade apaga mensagens
    return reply.send({ status: 'success' });
  });

  // Renomear (apelido) uma instância.
  fastify.patch('/whatsapp/instancias/:id', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = z.object({ apelido: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Nome inválido' });
    const inst = await prisma.whatsappInstancia.findFirst({ where: { id, dono_id: user?.id, instancia_nome: { not: INSTANCIA_EMPRESA } } });
    if (!inst) return reply.status(404).send({ status: 'error', message: 'Instância não encontrada' });
    const upd = await prisma.whatsappInstancia.update({ where: { id }, data: { apelido: body.data.apelido } });
    return reply.send({ status: 'success', data: upd });
  });

  // ===== CONVERSAS =====

  // Lista conversas (escopadas ao dono; gestão vê todas), ordenadas por atividade.
  // Filtra por instância quando ?instanciaId= é informado (seletor multi-instância).
  fastify.get('/whatsapp/conversas', async (request, reply) => {
    const { instanciaId, escopo, tipo_contato } = request.query as { instanciaId?: string; escopo?: string; tipo_contato?: string };
    // Visão de supervisão: gestão pode pedir escopo=todos p/ ver as conversas de
    // TODOS os vendedores num só lugar (sem assumir). escopo=pool = conversas do
    // WhatsApp da empresa sem dono (qualquer usuário). Padrão = só as próprias.
    const filtroEscopo = whereListaConversas(escopo, getUser(request));
    const conversas = await prisma.whatsappConversa.findMany({
      where: {
        ...filtroEscopo, ...(instanciaId ? { instanciaId } : {}),
        ...(tipo_contato && (TIPOS_CONTATO as readonly string[]).includes(tipo_contato) ? { tipo_contato } : {}),
      },
      orderBy: { ultima_em: 'desc' },
      take: 150,
      include: { instancia: { select: { apelido: true, dono_nome: true, numero: true } } },
    });

    // Anexa código + razão social dos clientes vinculados (etiqueta verde na conversa).
    const clienteIds = Array.from(new Set(conversas.map(c => c.cliente_id).filter(Boolean))) as string[];
    if (clienteIds.length) {
      const clientes = await prisma.cliente.findMany({
        where: { id: { in: clienteIds } },
        select: { id: true, codigo: true, razao_social: true, nome_fantasia: true, nome: true },
      }).catch(() => [] as any[]);
      const mapa = new Map(clientes.map(c => [c.id, c]));
      for (const conv of conversas as any[]) {
        const cli: any = conv.cliente_id ? mapa.get(conv.cliente_id) : null;
        if (cli) {
          conv.cliente_codigo = cli.codigo || null;
          conv.cliente_razao = cli.razao_social || cli.nome_fantasia || cli.nome || null;
        }
      }
    }

    // Nome do dono da conversa (a instância da empresa é de todos, então o
    // dono_nome da instância não diz quem atende).
    const donoIds = Array.from(new Set(conversas.map(c => c.dono_id).filter(Boolean))) as string[];
    if (donoIds.length) {
      try {
        const { resolverNomesUsuarios } = await import('@/lib/usuarios');
        const nomes = await resolverNomesUsuarios(prisma, donoIds);
        for (const conv of conversas as any[]) conv.dono_nome = conv.dono_id ? (nomes[conv.dono_id] || null) : null;
      } catch { /* sem nomes — segue */ }
    }
    for (const conv of conversas as any[]) if (conv.dono_nome === undefined) conv.dono_nome = null;
    return reply.send({ status: 'success', data: conversas });
  });

  // Assume uma conversa do pool (sem dono). Atômico: se dois vendedores
  // clicarem juntos, só um ganha; o outro recebe 409.
  fastify.post('/whatsapp/conversas/:id/assumir', async (request, reply) => {
    const user = getUser(request)!;
    const { id } = request.params as { id: string };
    const antes = await prisma.whatsappConversa.findUnique({ where: { id } });
    if (!antes) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });
    if (!antes.dono_id) await assumirSeSemDono(antes, user);
    const conversa = await prisma.whatsappConversa.findUnique({ where: { id } });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });
    if (conversa.dono_id !== user.id) {
      return reply.status(409).send({ status: 'error', message: 'Esta conversa já foi assumida por outra pessoa.' });
    }
    return reply.send({ status: 'success', data: conversa });
  });

  // Desvincula a conversa do funil: tira o lead_id e, se o lead foi criado
  // automaticamente via WhatsApp, faz soft-delete dele (sai do dashboard).
  // Também desativa o bot (não é um lead comercial — ex.: suporte/fornecedor).
  fastify.post('/whatsapp/conversas/:id/desvincular', async (request, reply) => {
    const { id } = request.params as { id: string };
    const conversa = await prisma.whatsappConversa.findFirst({ where: { id, ...escopoDono(request) } });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });

    await prisma.whatsappConversa.update({ where: { id }, data: await dadosSairDoFunil(conversa) });
    return reply.send({ status: 'success' });
  });

  // Tira a conversa do funil / vincula ao cliente: ver whatsapp-vinculo.service.
  const dadosSairDoFunil = (conversa: { lead_id: string | null }) => dadosSairDoFunilSvc(prisma, conversa);
  const vincularContatoCliente = (
    conversa: { id: string; contato_nome: string | null; contato_numero: string },
    clienteId: string, nome: string | undefined, cargo: string | undefined, user: any,
  ) => vincularContatoClienteSvc(prisma, conversa, clienteId, nome, cargo, user);

  // Vincula a conversa a um CLIENTE da base e registra o contato (nome, telefone,
  // cargo) na ficha do cliente. Assim contatos de WhatsApp que já são clientes
  // ficam salvos e atualizados. Idempotente: se já existe contato com o mesmo
  // telefone, atualiza em vez de duplicar.
  fastify.post('/whatsapp/conversas/:id/vincular-cliente', async (request, reply) => {
    const { id: idFila } = request.params as { id: string };
    // Mesma fila da confirmação automática por CNPJ: não intercala com o robô.
    return serializarPorChave(chaveConversa(idFila), async () => {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = z.object({
        cliente_id: z.string().min(1, 'Selecione o cliente'),
        nome: z.string().optional(),
        cargo: z.string().optional(),
      }).safeParse(request.body);
      if (!body.success) return reply.status(400).send({ status: 'error', message: 'Selecione o cliente para vincular.' });

      const conversa = await prisma.whatsappConversa.findFirst({ where: { id, ...escopoDono(request) } });
      if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });

      const cliente = await prisma.cliente.findUnique({ where: { id: body.data.cliente_id }, select: { id: true } });
      if (!cliente) return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });

      await limparConfirmacaoPendente(prisma, conversa.id);
      const contato = await vincularContatoCliente(conversa, body.data.cliente_id, body.data.nome, body.data.cargo, user);
      return reply.send({ status: 'success', data: { contato }, message: 'Conversa vinculada ao cliente.' });
    });
  });

  // Identifica o contato por tipo. Só LEAD fica no funil; os demais tiram o lead
  // captado automaticamente do funil (Central de Leads limpa). A conversa continua no Inbox.
  fastify.post('/whatsapp/conversas/:id/identificar', async (request, reply) => {
    const { id: idFila } = request.params as { id: string };
    // Mesma fila da confirmação automática por CNPJ: não intercala com o robô.
    return serializarPorChave(chaveConversa(idFila), async () => {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = z.object({
        tipo: z.enum(TIPOS_CONTATO),
        nome: z.string().trim().max(120).optional(),
        cargo: z.string().trim().max(120).optional(),
        empresa: z.string().trim().max(160).optional(),
        cliente_id: z.string().optional(),
      }).safeParse(request.body);
      if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos.' });
      const { tipo, nome, cargo, empresa, cliente_id } = body.data;

      const decisao = decidirIdentificacao(tipo, { cliente_id });
      if ('erro' in decisao) return reply.status(400).send({ status: 'error', message: decisao.erro });

      const conversa = await prisma.whatsappConversa.findFirst({ where: { id, ...escopoDono(request) } });
      if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });

      if (decisao.vincularCliente) {
        const cliente = await prisma.cliente.findUnique({ where: { id: cliente_id! }, select: { id: true } });
        if (!cliente) return reply.status(404).send({ status: 'error', message: 'Cliente não encontrado' });
        await vincularContatoCliente(conversa, cliente_id!, nome || undefined, cargo || undefined, user);
      }

      // Humano identificou: descarta a pergunta automática pendente.
      await limparConfirmacaoPendente(prisma, conversa.id);
      const data: any = {
        tipo_contato: tipo,
        contato_cargo: cargo || null,
        contato_empresa: decisao.salvarEmpresa ? (empresa || null) : null,
        etiqueta: decisao.etiqueta, etiqueta_cor: decisao.etiqueta_cor,
        ...(nome ? { contato_nome: nome } : {}),
      };
      if (decisao.sairDoFunil) Object.assign(data, await dadosSairDoFunil(conversa));

      if (decisao.garantirLead) {
        let leadId = conversa.lead_id;
        if (leadId) {
          const existe = await prisma.lead.findFirst({ where: { id: leadId, deleted_at: null }, select: { id: true } }).catch(() => null);
          if (!existe) leadId = null;
        }
        if (!leadId) {
          // Mesmo formato da captação automática.
          const lead = await prisma.lead.create({
            data: {
              nome: nome || conversa.contato_nome || `WhatsApp ${conversa.contato_numero}`,
              telefone: conversa.contato_numero,
              responsavel_telefone: conversa.contato_numero,
              origem: 'WHATSAPP',
              created_by: user?.id || 'whatsapp_empresa',
              ...(conversa.dono_id ? { responsavel_id: conversa.dono_id, atribuido_em: new Date() } : {}),
              observacoes_comerciais: 'Lead identificado manualmente no Inbox do WhatsApp.',
            },
            select: { id: true },
          });
          leadId = lead.id;
          data.lead_id = leadId;
        }
        const dadosBot = (conversa.bot_dados || {}) as any;
        if (dadosBot.receita) await aplicarReceitaNoLead(prisma, leadId, dadosBot);
      }

      const upd = await prisma.whatsappConversa.update({ where: { id }, data });
      emitirEventoConversa(upd.dono_id, 'conversa_atualizada', { conversaId: id });
      return reply.send({ status: 'success', data: upd });
    });
  });

  // Agenda uma reunião a partir da conversa: cria Atividade REUNIAO (vinculada
  // ao lead, se houver) e ENVIA a mensagem com data/hora + link pelo WhatsApp.
  fastify.post('/whatsapp/conversas/:id/reuniao', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = z.object({
      data: z.string().min(1),          // ISO datetime
      duracao_minutos: z.coerce.number().int().optional(),
      link: z.string().optional(),
      titulo: z.string().optional(),
      mensagem: z.string().optional(),  // texto customizado (senão monta padrão)
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe a data/hora da reunião.' });

    const conversa = await prisma.whatsappConversa.findFirst({ where: { id, ...escopoDono(request) }, include: { instancia: true } });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });

    const dt = new Date(body.data.data);
    const titulo = body.data.titulo || 'Reunião ProSystem';

    // Cria a Atividade REUNIAO (entra na agenda + scheduler de lembrete 2h antes).
    // Precisa de um lead vinculado (Atividade.lead_id é obrigatório).
    let atividadeId: string | undefined;
    if (conversa.lead_id) {
      const at = await prisma.atividade.create({
        data: {
          lead_id: conversa.lead_id, tipo: 'REUNIAO', titulo,
          descricao: `Agendada via WhatsApp com ${conversa.contato_nome || conversa.contato_numero}`,
          status: 'PENDENTE', data_prevista: dt, duracao_minutos: body.data.duracao_minutos || 60,
          google_meet_link: body.data.link || null, responsavel_id: conversa.dono_id ?? user?.id ?? null, created_by: user?.id || 'system',
        },
      }).catch(() => null);
      atividadeId = at?.id;
    }

    // Monta a mensagem (ou usa a customizada) e envia pelo WhatsApp do contato.
    const dataFmt = dt.toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
    const msg = body.data.mensagem || (
      `Olá! 📅 Sua reunião com a *ProSystem* está agendada:\n\n` +
      `*${titulo}*\n🗓️ ${dataFmt}\n` +
      (body.data.link ? `\n🔗 Link da reunião:\n${body.data.link}\n` : '') +
      `\nQualquer dúvida, estou à disposição!`
    );

    let externo_id: string | undefined;
    try {
      const r = await evo.enviarTexto(conversa.instancia.instance_token || '', conversa.contato_numero, msg);
      externo_id = r.externo_id;
    } catch (e: any) {
      return reply.status(502).send({ status: 'error', message: `Reunião criada, mas falha ao enviar no WhatsApp: ${e.message}` });
    }

    // Registra a mensagem enviada no Inbox.
    await prisma.whatsappMensagem.create({
      data: { conversaId: id, externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo: msg, status: 'ENVIADA', enviada_por: user?.id },
    }).catch(() => {});
    await prisma.whatsappConversa.update({ where: { id }, data: { ultima_mensagem: '📅 Reunião agendada', ultima_em: new Date() } }).catch(() => {});
    await pararRobo(id);
    await assumirSeSemDono(conversa, user);

    return reply.send({ status: 'success', data: { atividadeId } });
  });

  // Abre (ou cria) uma conversa pelo número — usado pelos botões de WhatsApp
  // espalhados no CRM (leads, clientes, etc.) que agora levam ao Inbox interno.
  fastify.post('/whatsapp/abrir', async (request, reply) => {
    const user = getUser(request);
    if (!user?.id) return reply.status(401).send({ status: 'error', message: 'Não autenticado' });
    const body = z.object({ numero: z.string().min(8), nome: z.string().optional(), lead_id: z.string().optional() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Número inválido' });

    const numero = evo.normalizarNumero(body.data.numero);
    // WhatsApp da empresa tem prioridade; senão, a instância do próprio usuário.
    const empresa = await obterInstanciaEmpresa(prisma);
    const inst = empresa || await prisma.whatsappInstancia.findUnique({ where: { instancia_nome: instanciaNomeDe(user.id) } });
    if (!inst) return reply.status(400).send({ status: 'error', message: 'Conecte seu WhatsApp primeiro' });

    const conversa = await prisma.whatsappConversa.upsert({
      where: { uq_conversa: { instanciaId: inst.id, contato_numero: numero } },
      create: {
        // Na instância da empresa quem abre a conversa é o dono dela.
        instanciaId: inst.id, dono_id: empresa ? user.id : inst.dono_id, contato_numero: numero,
        contato_nome: body.data.nome, lead_id: body.data.lead_id, ultima_em: new Date(),
      },
      update: { contato_nome: body.data.nome || undefined, lead_id: body.data.lead_id || undefined },
    });
    return reply.send({ status: 'success', data: conversa });
  });

  // Define/limpa a etiqueta de organização da conversa (Padaria, Farmácia, etc.).
  // Tipos de atendimento que NÃO são lead comercial → desvinculam do funil ao marcar.
  const TIPOS_NAO_COMERCIAIS = ['Financeiro', 'Renegociação', 'Serviço', 'Parceiro', 'Pessoal', 'Suporte'];

  // ===== ASSISTENTE: campanhas pelo WhatsApp (só gestão) =====
  const FiltroCampanhaZ = z.object({
    publico: z.enum(['CLIENTES', 'LEADS_PARADOS']), segmento: z.string().max(60).optional().nullable(),
    dias_parado: z.number().int().min(7).max(365).optional().nullable(),
  });
  fastify.get('/assistente/campanhas', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { listarCampanhas } = await import('@/services/assistente-campanhas.service');
    return reply.send({ status: 'success', data: await listarCampanhas(prisma) });
  });
  fastify.post('/assistente/campanhas/previa', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const f = FiltroCampanhaZ.safeParse(request.body);
    if (!f.success) return reply.status(400).send({ status: 'error', message: 'Filtro inválido.' });
    const { previaCampanha } = await import('@/services/assistente-campanhas.service');
    return reply.send({ status: 'success', data: await previaCampanha(prisma, f.data) });
  });
  fastify.post('/assistente/campanhas', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const f = FiltroCampanhaZ.extend({ nome: z.string().min(3).max(120), texto: z.string().min(10).max(1500) }).safeParse(request.body);
    if (!f.success) return reply.status(400).send({ status: 'error', message: 'Preencha nome e texto (mínimo 10 letras).' });
    try {
      const { criarCampanha } = await import('@/services/assistente-campanhas.service');
      const c = await criarCampanha(prisma, f.data, getUser(request)!.id);
      return reply.send({ status: 'success', data: c, message: `Campanha criada: ${c.total} contatos. Envio de ~24 por hora em horário comercial.` });
    } catch (e: any) { return reply.status(400).send({ status: 'error', message: e?.message || 'Não foi possível criar.' }); }
  });
  fastify.post('/assistente/campanhas/:id/cancelar', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    await prisma.campanhaWhatsapp.updateMany({ where: { id, status: 'ENVIANDO' }, data: { status: 'CANCELADA' } });
    return reply.send({ status: 'success', message: 'Campanha cancelada. O que já saiu não volta.' });
  });

  // ===== ASSISTENTE: IA de texto sob demanda (resumo, sugestão, transcrição) =====
  fastify.post('/whatsapp/conversas/:id/ia/resumo', async (request, reply) => {
    const { id } = request.params as { id: string };
    const c = await prisma.whatsappConversa.findFirst({ where: { id, ...whereLeituraConversa(getUser(request)) }, select: { id: true } });
    if (!c) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });
    try {
      const { resumirConversa } = await import('@/services/assistente-ia.service');
      return reply.send({ status: 'success', data: await resumirConversa(prisma, id) });
    } catch (e: any) { return reply.status(400).send({ status: 'error', message: e?.message || 'Falha na IA' }); }
  });

  fastify.post('/whatsapp/conversas/:id/ia/sugestao', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUser(request);
    const c = await prisma.whatsappConversa.findFirst({ where: { id, ...whereLeituraConversa(user) }, select: { id: true } });
    if (!c) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });
    try {
      const { sugerirResposta } = await import('@/services/assistente-ia.service');
      return reply.send({ status: 'success', data: { texto: await sugerirResposta(prisma, id, ((user as any)?.nome || 'a vendedora').split(' ')[0]) } });
    } catch (e: any) { return reply.status(400).send({ status: 'error', message: e?.message || 'Falha na IA' }); }
  });

  fastify.post('/whatsapp/mensagens/:id/transcrever', async (request, reply) => {
    const { id } = request.params as { id: string };
    const m = await prisma.whatsappMensagem.findUnique({ where: { id }, select: { conversaId: true } });
    const c = m && await prisma.whatsappConversa.findFirst({ where: { id: m.conversaId, ...whereLeituraConversa(getUser(request)) }, select: { id: true } });
    if (!c) return reply.status(404).send({ status: 'error', message: 'Mensagem não encontrada' });
    try {
      const { transcreverAudio } = await import('@/services/assistente-ia.service');
      return reply.send({ status: 'success', data: { transcricao: await transcreverAudio(prisma, id) } });
    } catch (e: any) { return reply.status(400).send({ status: 'error', message: e?.message || 'Falha na IA' }); }
  });

  // ===== ASSISTENTE: próxima melhor ação (lista "o que fazer agora"; só sugere) =====
  fastify.get('/assistente/proxima-acao', async (request, reply) => {
    const user = getUser(request);
    const agora = new Date();
    const escopo = whereLeituraConversa(user);
    const desde = new Date(agora.getTime() - 3 * 86400000);
    const conversas = await prisma.whatsappConversa.findMany({
      where: { ...escopo, ultima_em: { gte: desde }, bot_ativo: false, OR: [{ tipo_contato: null }, { tipo_contato: { in: ['LEAD', 'CLIENTE', 'TERCEIRO_CLIENTE'] } }] },
      select: {
        id: true, contato_nome: true, contato_numero: true, ultima_mensagem: true, ultima_em: true, prioridade: true, sla_prazo_em: true, dono_id: true,
        mensagens: { orderBy: { created_at: 'desc' }, take: 1, select: { direcao: true } },
      },
      orderBy: { ultima_em: 'desc' }, take: 80,
    });
    const idsVisiveis = new Set(conversas.map(c => c.id));
    const vistas = await prisma.propostaHistorico.findMany({
      where: { tipo: 'STATUS', valor_novo: 'VISUALIZADA', created_at: { gte: new Date(agora.getTime() - 48 * 3600000) } },
      select: { created_at: true, proposta: { select: { status: true, nome_fantasia: true, razao_social: true, valor_final: true, valor_implantacao: true, wpp_conversa_id: true, vendedor_id: true } } },
    });
    const podeTudo = podeVerTudo(user);
    const propostasVistas = vistas
      .filter(v => v.proposta.status === 'VISUALIZADA' && (podeTudo || v.proposta.vendedor_id === user?.id || (v.proposta.wpp_conversa_id && idsVisiveis.has(v.proposta.wpp_conversa_id))))
      .map(v => ({ conversaId: v.proposta.wpp_conversa_id, nome: (v.proposta.nome_fantasia || v.proposta.razao_social || 'Cliente').trim(), vista_em: v.created_at, valor: v.proposta.valor_final ?? v.proposta.valor_implantacao ?? null }));
    const { limitesPeriodo } = await import('@/lib/painel-tv');
    const { inicioHoje, fimHoje } = limitesPeriodo(agora);
    const demos = await prisma.atividade.findMany({
      where: { tipo: 'REUNIAO', status: { in: ['PENDENTE', 'CONFIRMADA'] }, whatsapp_conversa_id: { not: null }, data_prevista: { gte: inicioHoje, lt: fimHoje }, ...(podeTudo ? {} : { responsavel_id: user?.id }) },
      select: { titulo: true, data_prevista: true, whatsapp_conversa_id: true },
    });
    const { montarProximasAcoes } = await import('@/lib/assistente/proxima-acao');
    const acoes = montarProximasAcoes({
      agora,
      conversas: conversas.map(c => ({
        id: c.id, nome: c.contato_nome || c.contato_numero, ultima: c.ultima_mensagem, ultima_em: c.ultima_em, prioridade: c.prioridade,
        sla_prazo_em: c.sla_prazo_em, dono_id: c.dono_id, ultima_direcao: c.mensagens[0]?.direcao || null,
      })),
      propostasVistas,
      demosHoje: demos.map(d => ({ conversaId: d.whatsapp_conversa_id, nome: d.titulo.replace(/^Demonstração Prosystem · /, ''), quando: d.data_prevista! })),
    });
    return reply.send({ status: 'success', data: acoes });
  });

  // ===== ASSISTENTE: proposta pelo WhatsApp =====
  fastify.get('/whatsapp/conversas/:id/propostas', async (request, reply) => {
    const { id } = request.params as { id: string };
    const conversa = await prisma.whatsappConversa.findFirst({ where: { id, ...escopoDono(request) }, select: { id: true } });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });
    const { propostasDaConversa } = await import('@/services/assistente-proposta.service');
    const ps = await propostasDaConversa(prisma, id);
    const { situacaoDesconto } = await import('@/services/assistente-desconto.service');
    const desc = await Promise.all(ps.map(p => situacaoDesconto(prisma, p.id)));
    return reply.send({ status: 'success', data: ps.map((p, i) => ({
      desconto_pct: desc[i]?.pct ?? 0, desconto_precisa: !!desc[i]?.precisa, desconto_status: desc[i]?.status || null, desconto_limite: desc[i]?.limite ?? null,
      id: p.id, nome: (p.nome_fantasia || p.razao_social || 'Sem nome').trim(), status: p.status, plano: p.plano_selecionado,
      valor: p.valor_final ?? p.valor_implantacao, tem_link: !!p.public_token, enviada_wpp_em: p.wpp_enviada_em, criada_em: p.created_at,
    })) });
  });

  fastify.post('/whatsapp/conversas/:id/enviar-proposta', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ proposta_id: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Escolha a proposta.' });
    const conversa = await prisma.whatsappConversa.findFirst({ where: { id, ...escopoDono(request) } });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });
    const user = getUser(request)!;
    try {
      await assumirSeSemDono(conversa, user);
      const { enviarPropostaWhatsapp } = await import('@/services/assistente-proposta.service');
      await enviarPropostaWhatsapp(prisma, id, body.data.proposta_id, { id: user.id, nome: (user as any).nome });
      return reply.send({ status: 'success', message: 'Proposta enviada pelo WhatsApp.' });
    } catch (e: any) {
      return reply.status(e?.codigo ? 409 : 400).send({ status: 'error', message: e?.message || 'Não foi possível enviar.', codigo: e?.codigo || null });
    }
  });

  // Aprovação de desconto pelo celular (ideia 23): pede à gestão pelo WhatsApp.
  fastify.post('/assistente/propostas/:id/pedir-aprovacao-desconto', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUser(request)!;
    try {
      const { pedirAprovacaoDesconto } = await import('@/services/assistente-desconto.service');
      const r = await pedirAprovacaoDesconto(prisma, id, { id: user.id, nome: (user as any).nome });
      return reply.send({ status: 'success', data: r, message: `Pedido enviado para ${r.enviado_para.join(' e ')} no WhatsApp.` });
    } catch (e: any) { return reply.status(400).send({ status: 'error', message: e?.message || 'Não foi possível pedir.' }); }
  });

  // ===== ASSISTENTE: avisos no celular da gestão + chave PIX =====
  fastify.get('/assistente/config', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { lerPrefsAvisos, listarGestao } = await import('@/services/assistente-gestao.service');
    const { TIPOS_AVISO, NOME_AVISO, acharGestor } = await import('@/lib/assistente/gestao');
    const u = getUser(request)!;
    const eu = await prisma.usuarioCRM.findUnique({ where: { id: u.id }, select: { telefone: true } }).catch(() => null);
    const recebe = !!(eu?.telefone && acharGestor(eu.telefone, await listarGestao(prisma)));
    const pix = await prisma.configuracaoIntegracao.findUnique({ where: { chave: 'assistente.pix_chave' } }).catch(() => null);
    const { obterConfigIa } = await import('@/services/assistente-config.service');
    const { obterConfigIaTexto } = await import('@/services/assistente-ia.service');
    return reply.send({ status: 'success', data: {
      avisos: await lerPrefsAvisos(prisma, u.id), tipos: TIPOS_AVISO.map(t => ({ id: t, nome: NOME_AVISO[t] })),
      telefone: eu?.telefone || null, recebe, pix_chave: pix?.valor || '', ia: await obterConfigIa(prisma),
      ia_texto: await obterConfigIaTexto(prisma), // a chave em si nunca volta para a tela
      posvenda: (await (await import('@/services/assistente-posvenda.service')).obterConfigPosVenda(prisma)).ativo,
      desconto_limite: await (await import('@/services/assistente-desconto.service')).obterLimiteDesconto(prisma),
    } });
  });

  fastify.put('/assistente/config', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { TIPOS_AVISO } = await import('@/lib/assistente/gestao');
    const body = z.object({
      avisos: z.array(z.enum(TIPOS_AVISO)).optional(), pix_chave: z.string().max(140).optional(),
      ia: z.object({
        laya_triagem: z.boolean().optional(), laya_confianca: z.number().min(0.3).max(0.99).optional(),
        risco_limite: z.number().min(0.3).max(0.99).optional(), risco_so_clientes: z.boolean().optional(),
      }).optional(),
      ia_texto: z.object({
        tira_duvidas: z.enum(['desligado', 'fora_do_horario', 'sempre']).optional(), transcrever_auto: z.boolean().optional(),
        gemini_chave: z.string().max(200).optional(),
      }).optional(),
      posvenda: z.boolean().optional(),
      desconto_limite: z.number().min(0).max(100).optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos.' });
    const u = getUser(request)!;
    if (body.data.avisos) {
      const { salvarPrefsAvisos } = await import('@/services/assistente-gestao.service');
      await salvarPrefsAvisos(prisma, u.id, body.data.avisos);
    }
    if (body.data.ia) {
      const { salvarConfigIa } = await import('@/services/assistente-config.service');
      await salvarConfigIa(prisma, body.data.ia, u.id);
    }
    if (body.data.desconto_limite !== undefined) {
      const { salvarLimiteDesconto } = await import('@/services/assistente-desconto.service');
      await salvarLimiteDesconto(prisma, body.data.desconto_limite, u.id);
    }
    if (body.data.posvenda !== undefined) {
      const { salvarPosVenda } = await import('@/services/assistente-posvenda.service');
      await salvarPosVenda(prisma, body.data.posvenda, u.id);
    }
    if (body.data.ia_texto) {
      const { salvarConfigIaTexto } = await import('@/services/assistente-ia.service');
      // Chave vazia = não mexer (a tela nunca recebe a chave salva de volta).
      const { gemini_chave, ...resto } = body.data.ia_texto;
      await salvarConfigIaTexto(prisma, { ...resto, ...(gemini_chave && gemini_chave.trim() ? { gemini_chave } : {}) }, u.id);
    }
    if (body.data.pix_chave !== undefined) {
      const valor = body.data.pix_chave.trim();
      await prisma.configuracaoIntegracao.upsert({ where: { chave: 'assistente.pix_chave' }, create: { chave: 'assistente.pix_chave', valor, updated_by: u.id }, update: { valor, updated_by: u.id } });
    }
    return reply.send({ status: 'success', message: 'Salvo.' });
  });

  // ===== IA LAYA: coleta de treino =====
  // A equipe confirma/corrige as etiquetas sugeridas; cada confirmação guarda a
  // foto do texto da conversa naquele momento (amostra de treino).
  fastify.post('/whatsapp/conversas/:id/ia-rotulos', async (request, reply) => {
    const { id } = request.params as { id: string };
    const rotulos = validarRotulos(request.body);
    if (!rotulos) return reply.status(400).send({ status: 'error', message: 'Etiquetas inválidas.' });
    const conversa = await prisma.whatsappConversa.findFirst({ where: { id, ...escopoDono(request) }, select: { id: true, ia_sugestao: true } });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });
    const texto = await textoParaIa(prisma, id);
    if (!texto) return reply.status(400).send({ status: 'error', message: 'A conversa ainda não tem texto para aprender.' });
    await prisma.iaAmostra.create({
      data: { conversaId: id, texto, rotulos, sugestao: conversa.ia_sugestao ?? Prisma.JsonNull, criado_por: getUser(request)?.id || null },
    });
    const total = await prisma.iaAmostra.count();
    return reply.send({ status: 'success', data: { total }, message: 'Obrigado! O Laya aprendeu com esta conversa.' });
  });

  // Placar do treino: quantas amostras e quanto o Laya acertou nas confirmadas.
  fastify.get('/ia/laya/resumo', async (_request, reply) => {
    const amostras = await prisma.iaAmostra.findMany({ select: { rotulos: true, sugestao: true } });
    return reply.send({ status: 'success', data: { total: amostras.length, acerto: medirAcerto(amostras) } });
  });

  // Exporta as amostras (JSONL) para o treino. Só gestão.
  fastify.get('/ia/laya/amostras', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const amostras = await prisma.iaAmostra.findMany({ orderBy: { created_at: 'asc' } });
    reply.header('Content-Type', 'application/x-ndjson; charset=utf-8');
    return reply.send(amostras.map(a => JSON.stringify({ id: a.id, conversa: a.conversaId, texto: a.texto, rotulos: a.rotulos, sugestao: a.sugestao, em: a.created_at })).join('\n'));
  });

  fastify.patch('/whatsapp/conversas/:id/etiqueta', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ etiqueta: z.string().optional(), etiqueta_cor: z.string().optional() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const conversa = await prisma.whatsappConversa.findFirst({ where: { id, ...escopoDono(request) } });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });

    const etiqueta = body.data.etiqueta || null;
    const data: any = { etiqueta, etiqueta_cor: body.data.etiqueta_cor || '#6b7280' };

    // Tipo não-comercial → desvincula do funil (não conta como lead) e desliga o bot.
    if (etiqueta && TIPOS_NAO_COMERCIAIS.includes(etiqueta)) {
      Object.assign(data, await dadosSairDoFunil(conversa));
    }

    const upd = await prisma.whatsappConversa.update({ where: { id }, data });
    return reply.send({ status: 'success', data: upd });
  });

  // Move a conversa entre as colunas do Kanban comercial (drag-and-drop).
  fastify.patch('/whatsapp/conversas/:id/estagio', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ estagio_funil: z.enum(ESTAGIOS_FUNIL) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Etapa inválida' });
    const conversa = await prisma.whatsappConversa.findFirst({ where: { id, ...escopoDono(request) } });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });
    const upd = await prisma.whatsappConversa.update({ where: { id }, data: { estagio_funil: body.data.estagio_funil } });

    // Entra/sai da cadência automática de WhatsApp (só farmácia/manipulação).
    if (body.data.estagio_funil === 'AGUARDANDO_RETORNO' && conversa.estagio_funil !== 'AGUARDANDO_RETORNO') {
      await entrarNaCadencia(prisma, id).catch(() => {});
    } else if (body.data.estagio_funil !== 'AGUARDANDO_RETORNO' && conversa.cadencia_proxima_etapa) {
      await pausarCadencia(prisma, id).catch(() => {});
    }

    return reply.send({ status: 'success', data: upd });
  });

  // Define a prioridade manual da conversa (recalcula o prazo de SLA).
  fastify.patch('/whatsapp/conversas/:id/prioridade', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ prioridade: z.enum(PRIORIDADES) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Prioridade inválida' });
    const conversa = await prisma.whatsappConversa.findFirst({ where: { id, ...escopoDono(request) } });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });
    // Só recalcula o prazo se o SLA já estava contando (última msg era de entrada).
    const novoPrazo = conversa.sla_prazo_em ? calcularSlaPrazo(body.data.prioridade) : null;
    const upd = await prisma.whatsappConversa.update({
      where: { id },
      data: { prioridade: body.data.prioridade, sla_prazo_em: novoPrazo },
    });
    return reply.send({ status: 'success', data: upd });
  });

  // Transferir a conversa (e o lead) para outro vendedor — SÓ GESTÃO.
  fastify.post('/whatsapp/conversas/:id/transferir', async (request, reply) => {
    if (!requireGestor(request, reply)) return; // só gestora/diretora transfere
    const { id } = request.params as { id: string };
    const body = z.object({ vendedor_id: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe o vendedor' });

    const conversa = await prisma.whatsappConversa.findUnique({ where: { id } });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });

    // Transfere o dono da conversa; se houver lead vinculado, reatribui também.
    await prisma.whatsappConversa.update({ where: { id }, data: { dono_id: body.data.vendedor_id } });
    if (conversa.lead_id) {
      await prisma.lead.update({ where: { id: conversa.lead_id }, data: { responsavel_id: body.data.vendedor_id } }).catch(() => {});
    }
    return reply.send({ status: 'success' });
  });

  // Lista de vendedores p/ o seletor de transferência (só gestão).
  fastify.get('/whatsapp/vendedores', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    // Lista TODOS que podem receber a conversa: usuários do CRM (status ATIVO
    // ou em branco/null — tolerante). Raw query p/ não depender do match exato de status.
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome, cargo FROM UsuarioCRM WHERE status IS NULL OR status = '' OR UPPER(status) = 'ATIVO' ORDER BY nome ASC`
    ).catch(() => []);
    return reply.send({ status: 'success', data: rows });
  });

  // Painel lateral da conversa: resumo comercial (cliente vinculado, proposta em
  // aberto, tempo de casa) para a tela de atendimento — não pesa a listagem.
  fastify.get('/whatsapp/conversas/:id/painel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const filtro = whereLeituraConversa(getUser(request));
    const conversa = await prisma.whatsappConversa.findFirst({ where: { id, ...filtro } });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });

    let cliente: any = null;
    if (conversa.cliente_id) {
      cliente = await prisma.cliente.findUnique({
        where: { id: conversa.cliente_id },
        select: {
          id: true, codigo: true, razao_social: true, nome_fantasia: true, nome: true,
          plano: true, segmento: true, situacao: true, mensalidade_base: true,
          data_entrada: true, cnpj: true,
        },
      }).catch(() => null);
    }

    // Proposta em aberto: casa por CNPJ do cliente vinculado ou pelo telefone do
    // contato (sem FK estruturada entre Proposta e Cliente, é o que dá pra usar).
    const sufTel = conversa.contato_numero.slice(-8);
    const proposta = await prisma.propostaComercial.findFirst({
      where: {
        deleted_at: null,
        status: { in: ['RASCUNHO', 'ENVIADA', 'EM_NEGOCIACAO'] },
        OR: [
          ...(cliente?.cnpj ? [{ cnpj: cliente.cnpj }] : []),
          { responsavel_telefone: { contains: sufTel } },
        ],
      },
      orderBy: { created_at: 'desc' },
      select: { id: true, status: true, valor_final: true, titulo_proposta: true, validade: true, created_at: true },
    }).catch(() => null);

    const responsavel = conversa.dono_id
      ? await prisma.usuarioCRM.findUnique({ where: { id: conversa.dono_id }, select: { nome: true, cargo: true } }).catch(() => null)
      : null;

    return reply.send({
      status: 'success',
      data: {
        cliente,
        proposta,
        responsavel: responsavel ? { nome: responsavel.nome, cargo: responsavel.cargo } : null,
        prioridade: conversa.prioridade,
        estagio_funil: conversa.estagio_funil,
        sla_prazo_em: conversa.sla_prazo_em,
      },
    });
  });

  // Mensagens de uma conversa (valida escopo) + marca como lidas.
  // Gestão (podeVerTudo) pode ler qualquer conversa (visão de supervisão); demais
  // só as próprias.
  fastify.get('/whatsapp/conversas/:id/mensagens', async (request, reply) => {
    const { id } = request.params as { id: string };
    const filtro = whereLeituraConversa(getUser(request));
    const conversa = await prisma.whatsappConversa.findFirst({
      where: { id, ...filtro },
    });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });

    const mensagens = await prisma.whatsappMensagem.findMany({
      where: { conversaId: id },
      orderBy: { created_at: 'asc' },
      take: 200,
    });
    if (conversa.nao_lidas > 0) {
      await prisma.whatsappConversa.update({ where: { id }, data: { nao_lidas: 0 } });
    }
    return reply.send({ status: 'success', data: { conversa, mensagens } });
  });

  // Envia mensagem numa conversa (pela instância do dono).
  fastify.post('/whatsapp/conversas/:id/enviar', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = z.object({ texto: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Texto obrigatório' });

    const conversa = await prisma.whatsappConversa.findFirst({
      where: { id, ...escopoDono(request) },
      include: { instancia: true },
    });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });

    let externo_id: string | undefined;
    try {
      const r = await evo.enviarTexto(conversa.instancia.instance_token || '', conversa.contato_numero, body.data.texto);
      externo_id = r.externo_id;
    } catch (err: any) {
      return reply.status(502).send({ status: 'error', message: `Falha ao enviar: ${err.message}` });
    }

    const msg = await prisma.whatsappMensagem.create({
      data: {
        conversaId: id,
        externo_id,
        direcao: 'SAIDA',
        tipo: 'TEXTO',
        conteudo: body.data.texto,
        status: 'ENVIADA',
        enviada_por: user?.id,
      },
    });
    await prisma.whatsappConversa.update({
      where: { id },
      data: { ultima_mensagem: body.data.texto.slice(0, 200), ultima_em: new Date(), sla_prazo_em: null },
    });
    if (conversa.cadencia_proxima_etapa) await pausarCadencia(prisma, id).catch(() => {});
    await pararRobo(id);
    await assumirSeSemDono(conversa, user);

    return reply.send({ status: 'success', data: msg });
  });

  // Envia um áudio gravado no Inbox (mensagem de voz). Recebe base64 do áudio.
  fastify.post('/whatsapp/conversas/:id/audio', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = z.object({ audio_base64: z.string().min(20) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Áudio obrigatório' });

    const conversa = await prisma.whatsappConversa.findFirst({
      where: { id, ...escopoDono(request) },
      include: { instancia: true },
    });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });

    // O front manda um data URL (data:<mime>;base64,<...>). A Evolution aceita o
    // data URL inteiro no campo `audio` — passamos como veio (com o mime real do
    // navegador, normalmente webm/opus ou ogg/opus). Guardamos o data URL para
    // tocar no próprio Inbox.
    const raw = body.data.audio_base64.trim();
    const dataUrl = raw.startsWith('data:') ? raw : `data:audio/ogg;base64,${raw}`;

    let externo_id: string | undefined;
    try {
      const r = await evo.enviarAudio(conversa.instancia.instance_token || '', conversa.contato_numero, dataUrl);
      externo_id = r.externo_id;
    } catch (err: any) {
      return reply.status(502).send({ status: 'error', message: `Falha ao enviar áudio: ${err.message}` });
    }

    const msg = await prisma.whatsappMensagem.create({
      data: {
        conversaId: id,
        externo_id,
        direcao: 'SAIDA',
        tipo: 'AUDIO',
        conteudo: '[áudio]',
        midia_url: dataUrl, // p/ tocar no próprio Inbox
        status: 'ENVIADA',
        enviada_por: user?.id,
      },
    });
    await prisma.whatsappConversa.update({
      where: { id },
      data: { ultima_mensagem: '🎤 Áudio', ultima_em: new Date(), sla_prazo_em: null },
    });
    await pararRobo(id);
    await assumirSeSemDono(conversa, user);

    return reply.send({ status: 'success', data: msg });
  });

  // Envia um arquivo escolhido no Inbox (imagem, vídeo ou documento).
  // Recebe data URL; guarda o próprio data URL para exibir no Inbox.
  const LIMITE_ARQUIVO_BYTES = 16 * 1024 * 1024;
  fastify.post('/whatsapp/conversas/:id/arquivo', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = z.object({
      arquivo_base64: z.string().min(20),
      nome: z.string().min(1).max(200),
      legenda: z.string().max(1000).optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Arquivo obrigatório' });

    const dataUrl = body.data.arquivo_base64.trim();
    const base64 = dataUrl.split(',')[1] || '';
    if (Math.floor(base64.length * 3 / 4) > LIMITE_ARQUIVO_BYTES) {
      return reply.status(413).send({ status: 'error', message: 'Arquivo maior que 16 MB' });
    }

    const conversa = await prisma.whatsappConversa.findFirst({
      where: { id, ...escopoDono(request) },
      include: { instancia: true },
    });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });

    const legenda = body.data.legenda?.trim() || undefined;
    let r: { externo_id?: string; tipo: 'IMAGEM' | 'VIDEO' | 'DOCUMENTO' };
    try {
      r = await evo.enviarArquivo(conversa.instancia.instance_token || '', conversa.contato_numero, dataUrl, body.data.nome, legenda);
    } catch (err: any) {
      return reply.status(502).send({ status: 'error', message: `Falha ao enviar arquivo: ${err.message}` });
    }

    const rotulo = r.tipo === 'IMAGEM' ? '🖼️ Imagem' : r.tipo === 'VIDEO' ? '🎬 Vídeo' : `📎 ${body.data.nome}`;
    const msg = await prisma.whatsappMensagem.create({
      data: {
        conversaId: id,
        externo_id: r.externo_id,
        direcao: 'SAIDA',
        tipo: r.tipo,
        conteudo: legenda || (r.tipo === 'DOCUMENTO' ? body.data.nome : rotulo),
        midia_url: dataUrl,
        status: 'ENVIADA',
        enviada_por: user?.id,
      },
    });
    await prisma.whatsappConversa.update({
      where: { id },
      data: { ultima_mensagem: legenda ? `${rotulo}: ${legenda}`.slice(0, 200) : rotulo, ultima_em: new Date(), sla_prazo_em: null },
    });
    if (conversa.cadencia_proxima_etapa) await pausarCadencia(prisma, id).catch(() => {});
    await pararRobo(id);
    await assumirSeSemDono(conversa, user);

    return reply.send({ status: 'success', data: msg });
  });

  // ===== WEBHOOK (público — chamado pela UAZAPI/Evolution) =====
  // Dois formatos:
  //   - UAZAPI nativo (EventType/token/message): só da instância da EMPRESA,
  //     autenticado pelo token da instância no payload.
  //   - Evolution (event/instance/data): instâncias antigas por vendedor,
  //     resolvidas pelo nome — comportamento de sempre.
  // Idempotente por externo_id.
  fastify.post('/whatsapp/webhook', async (request, reply) => {
    // Responde rápido — processa em try/catch para nunca falhar p/ o provedor.
    reply.send({ status: 'success' });

    try {
      const payload = request.body as any;

      if (ehPayloadUazapi(payload)) {
        await processarWebhookUazapi(payload);
        return;
      }

      const evento = payload?.event || payload?.type;
      const instanciaNome = payload?.instance || payload?.instanceName;
      if (!instanciaNome) return;

      const inst = await prisma.whatsappInstancia.findUnique({ where: { instancia_nome: instanciaNome } });
      // A instância da empresa só é aceita pelo caminho autenticado por token.
      if (!inst || inst.instancia_nome === INSTANCIA_EMPRESA) return;

      // Atualização de conexão → reflete status/numero.
      if (evento === 'CONNECTION_UPDATE' || evento === 'connection.update') {
        const state = payload?.data?.state || payload?.data?.connection;
        const numero = payload?.data?.wuid?.split?.('@')?.[0] || payload?.data?.number;
        await prisma.whatsappInstancia.update({
          where: { id: inst.id },
          data: {
            status: state === 'open' ? 'CONECTADO' : state === 'connecting' ? 'CONECTANDO' : 'DESCONECTADO',
            numero: numero || inst.numero,
            conectado_em: state === 'open' ? (inst.conectado_em ?? new Date()) : inst.conectado_em,
            qr_code: state === 'open' ? null : inst.qr_code,
          },
        });
        emitirEventoConversa(inst.dono_id, 'conversa_atualizada', { instanciaId: inst.id });
        return;
      }

      // Mensagem recebida.
      if (evento === 'MESSAGES_UPSERT' || evento === 'messages.upsert') {
        const data = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
        if (!data) return;
        const fromMe = data?.key?.fromMe;

        // fromMe = mensagem ENVIADA pela própria conta. Pode ser eco do que o
        // CRM mandou (já gravado, ignora por externo_id) OU algo digitado no
        // WhatsApp Web/celular (precisa aparecer no CRM como SAIDA). Registra,
        // mas NÃO cria lead/conversa nem dispara bot.
        if (fromMe) {
          await registrarMensagemPropria(prisma, data).catch((e) => console.error('[WPP fromMe]', e?.message));
          return;
        }

        const remoteJid: string = data?.key?.remoteJid || '';

        // IGNORAR GRUPOS, listas de transmissão e status: não cria lead, não
        // cria conversa e o bot NÃO responde. Grupo termina em @g.us; broadcast
        // em @broadcast; status em status@broadcast. Também checa flags da Evolution.
        const ehGrupo = remoteJid.endsWith('@g.us')
          || remoteJid.endsWith('@broadcast')
          || remoteJid === 'status@broadcast'
          || !!data?.key?.participant     // mensagem dentro de grupo traz participant
          || data?.isGroup === true;
        if (ehGrupo) {
          console.log(`[WPP] Mensagem de grupo/broadcast ignorada (${remoteJid}).`);
          return;
        }

        const contato_numero = remoteJid.split('@')[0];
        if (!contato_numero) return;
        const externo_id = data?.key?.id;
        const contato_nome = data?.pushName || null;
        // Detecta o tipo de mensagem (texto, imagem, áudio, documento).
        const msg = data?.message || {};
        let tipoMsg: 'TEXTO' | 'IMAGEM' | 'AUDIO' | 'DOCUMENTO' | 'OUTRO' = 'TEXTO';
        let texto = msg.conversation || msg.extendedTextMessage?.text || '';

        const ehMidia = !!(msg.imageMessage || msg.audioMessage || msg.pttMessage || msg.documentMessage);
        if (msg.imageMessage) { tipoMsg = 'IMAGEM'; texto = msg.imageMessage.caption || '[imagem]'; }
        else if (msg.audioMessage || msg.pttMessage) { tipoMsg = 'AUDIO'; texto = '[áudio]'; }
        else if (msg.documentMessage) { tipoMsg = 'DOCUMENTO'; texto = msg.documentMessage.fileName || '[documento]'; }
        else if (!texto) { tipoMsg = 'OUTRO'; texto = '[mensagem]'; }

        // Conteúdo da mídia: usa o base64 do webhook se vier; senão baixa via
        // Evolution (a url crua do WhatsApp é criptografada e não abre no browser).
        const obterMidia = async (): Promise<string | undefined> => {
          if (!ehMidia) return undefined;
          let b64: string | undefined = data?.message?.base64;
          let mime: string | undefined =
            msg.imageMessage?.mimetype || (msg.audioMessage || msg.pttMessage)?.mimetype || msg.documentMessage?.mimetype;
          if (!b64) {
            const baixada = await evo.baixarMidiaBase64(inst.instance_token || '', data.key).catch(() => ({} as any));
            b64 = baixada.base64; mime = baixada.mimetype || mime;
          }
          if (!b64) return undefined;
          const tipoMime = mime || (tipoMsg === 'IMAGEM' ? 'image/jpeg' : tipoMsg === 'AUDIO' ? 'audio/ogg' : 'application/octet-stream');
          return `data:${tipoMime};base64,${b64}`;
        };

        await processarMensagemRecebida(inst, { contato_numero, contato_nome, externo_id, tipo_msg: tipoMsg, texto }, obterMidia, false);
      }
    } catch (err: any) {
      console.error('[WPP] Erro no webhook:', err?.message);
    }
  });

  // Webhook no formato nativo da UAZAPI — só para a instância da empresa.
  async function processarWebhookUazapi(payload: any) {
    const empresa = await obterInstanciaEmpresa(prisma);
    if (!empresa || !tokenWebhookConfere(payload?.token, empresa.instance_token)) {
      console.warn(`[WPP] Webhook UAZAPI ignorado: token ${payload?.token ? 'não confere' : 'ausente'} (evento ${payload?.EventType || payload?.event || '?'}).`);
      return;
    }
    const token = empresa.instance_token || '';
    const ev = parseUazapiEvento(payload);

    if (ev.tipo === 'ignorar') return;

    if (ev.tipo === 'conexao') {
      // O formato do evento de conexão varia; o status real vem da própria API.
      const r = await evo.obterStatus(token);
      await prisma.whatsappInstancia.update({
        where: { id: empresa.id },
        data: {
          status: r.status,
          numero: r.numero || empresa.numero,
          conectado_em: r.status === 'CONECTADO' ? (empresa.conectado_em ?? new Date()) : empresa.conectado_em,
        },
      }).catch(() => {});
      emitirEventoConversa(null, 'conversa_atualizada', { instanciaId: empresa.id });
      return;
    }

    if (ev.tipo === 'status') {
      // Só avança (ENVIADA → ENTREGUE → LIDA), nunca volta.
      const permitidos = ev.status === 'LIDA' ? ['ENVIADA', 'ENTREGUE'] : ['ENVIADA'];
      const msg = await prisma.whatsappMensagem.findFirst({ where: { externo_id: ev.externo_id }, include: { conversa: { select: { dono_id: true } } } }).catch(() => null);
      if (!msg || !permitidos.includes(msg.status)) return;
      await prisma.whatsappMensagem.update({ where: { id: msg.id }, data: { status: ev.status } }).catch(() => {});
      emitirEventoConversa(msg.conversa.dono_id, 'conversa_atualizada', { conversaId: msg.conversaId });
      return;
    }

    const obterMidia = async (): Promise<string | undefined> => {
      if (!['IMAGEM', 'VIDEO', 'AUDIO', 'DOCUMENTO'].includes(ev.tipo_msg)) return undefined;
      if (!ev.externo_id) return undefined;
      try {
        const m = await evo.baixarMidia(token, ev.externo_id);
        if (!m) { console.warn(`[WPP] Mídia ${ev.externo_id} sem conteúdo no /message/download.`); return undefined; }
        const padrao = ev.tipo_msg === 'IMAGEM' ? 'image/jpeg' : ev.tipo_msg === 'VIDEO' ? 'video/mp4' : ev.tipo_msg === 'AUDIO' ? 'audio/mpeg' : 'application/octet-stream';
        return `data:${m.mimetype || padrao};base64,${m.base64}`;
      } catch (e: any) {
        console.error(`[WPP] Falha ao baixar mídia ${ev.externo_id}:`, e?.message);
        return undefined;
      }
    };

    if (ev.tipo === 'mensagem_propria') {
      await registrarMensagemPropriaNormalizada(prisma, {
        instanciaId: empresa.id, contato_numero: ev.contato_numero, externo_id: ev.externo_id,
        tipo: ev.tipo_msg, texto: ev.texto, obterMidia, enviada_pela_api: ev.enviada_pela_api,
      }).catch((e) => console.error('[WPP fromMe]', e?.message));
      return;
    }

    await processarMensagemRecebida(empresa, ev, obterMidia, true);
  }

  // Mensagem de contato recebida (comum aos dois formatos): idempotência,
  // vínculo/captação de lead, conversa, SLA, cadência, SSE e bot.
  // Na instância da empresa, conversa nova nasce com o responsável do lead (ou
  // sem dono → pool) e o lead captado nasce sem responsável.
  async function processarMensagemRecebida(
    inst: { id: string; instancia_nome: string; dono_id: string; dono_nome: string | null; instance_token: string | null },
    dados: Pick<EventoMensagemUazapi, 'contato_numero' | 'contato_nome' | 'externo_id' | 'tipo_msg' | 'texto'> & Partial<Pick<EventoMensagemUazapi, 'botao_id'>>,
    obterMidia: () => Promise<string | undefined>,
    ehEmpresa: boolean,
  ) {
    const { contato_nome, externo_id, tipo_msg: tipoMsg, texto } = dados;
    let contato_numero = dados.contato_numero;

    // Gestão (Jessica/Thiago) falando com o número da empresa = comando do assistente.
    // Responde e sai: não vira lead nem conversa no Inbox.
    if (ehEmpresa && (tipoMsg === 'TEXTO' || dados.botao_id)) {
      // Comando não é gravado no banco: o reenvio do mesmo webhook é barrado aqui.
      if (externo_id && comandosVistos.has(externo_id)) return;
      try {
        const { responderComandoGestao } = await import('@/services/assistente-gestao.service');
        if (await responderComandoGestao(prisma, inst.instance_token || '', contato_numero, texto, dados.botao_id)) {
          if (externo_id) { comandosVistos.add(externo_id); if (comandosVistos.size > 2000) comandosVistos.clear(); }
          return;
        }
      } catch (e: any) { console.error('[ASSISTENTE] erro:', e?.message); }
    }

    // Idempotência: se já gravamos essa mensagem, sai.
    if (externo_id) {
      const existe = await prisma.whatsappMensagem.findFirst({ where: { externo_id } }).catch(() => null);
      if (existe) return;
    }

    const midiaUrl = await obterMidia();

    // O WhatsApp às vezes manda o número sem o 9 (ou com): se não há conversa com o
    // número exato mas há UMA desta instância com os mesmos 8 últimos dígitos (ex.:
    // aberta pelo CRM, campanha, pós-venda), usa ela em vez de abrir conversa nova.
    const exata = await prisma.whatsappConversa.findUnique({ where: { uq_conversa: { instanciaId: inst.id, contato_numero } }, select: { id: true } }).catch(() => null);
    if (!exata) {
      const fim8 = contato_numero.replace(/\D/g, '').slice(-8);
      const parecidas = fim8.length === 8
        ? (await prisma.whatsappConversa.findMany({ where: { instanciaId: inst.id, contato_numero: { endsWith: fim8 } }, select: { contato_numero: true } }).catch(() => []))
        : [];
      if (parecidas.length === 1) contato_numero = parecidas[0].contato_numero;
    }

    // Tenta vincular a um Lead existente pelo telefone — IGNORANDO máscara.
    // O telefone do lead pode estar salvo como "(27) 99999-8888"; comparar só
    // os dígitos evita não casar com o número cru do WhatsApp (5527999998888).
    let lead: { id: string; nome: string; responsavel_id?: string | null } | null = await acharLeadPorTelefone(prisma, contato_numero);

    // EVO-4 — Captação automática: número desconhecido + conversa nova
    // vira um Lead novo no funil, atribuído ao dono da instância (o vendedor).
    // Na instância da empresa o lead nasce sem responsável (quem assumir a conversa vira o responsável).
    const conversaExistente = await prisma.whatsappConversa.findUnique({
      where: { uq_conversa: { instanciaId: inst.id, contato_numero } },
      // ultima_em/bot_* lidos ANTES do upsert (que atualiza ultima_em) — usados p/ detectar triagem abandonada.
      select: { id: true, ultima_em: true, bot_ativo: true, bot_estado: true },
    }).catch(() => null);

    if (!lead && !conversaExistente) {
      // Nome do vendedor dono da instância p/ a etiqueta do card (cor + nome).
      // Usa dono_nome da instância; se faltar, resolve do cadastro/contas de sistema.
      let vendedorNome: string | undefined = ehEmpresa ? undefined : (inst.dono_nome || undefined);
      if (!ehEmpresa && !vendedorNome && inst.dono_id) {
        try {
          const { resolverNomesUsuarios } = await import('@/lib/usuarios');
          const nomes = await resolverNomesUsuarios(prisma, [inst.dono_id]);
          vendedorNome = nomes[inst.dono_id];
        } catch { /* ignora */ }
      }
      lead = await prisma.lead.create({
        data: {
          nome: contato_nome || `WhatsApp ${contato_numero}`,
          telefone: contato_numero,
          responsavel_telefone: contato_numero,
          origem: 'WHATSAPP',
          ...(ehEmpresa
            ? { created_by: 'whatsapp_empresa' }
            : {
              responsavel_id: inst.dono_id,
              vendedor_nome: vendedorNome,           // → etiqueta do responsável no card
              atribuido_em: new Date(),
              created_by: inst.dono_id,
            }),
          observacoes_comerciais: `Lead captado automaticamente via WhatsApp. Primeira mensagem: "${texto.slice(0, 180)}"`,
        },
        select: { id: true, nome: true, responsavel_id: true },
      }).then(l => {
        console.log(`[WPP] Lead captado automaticamente: ${l.id} (${contato_numero})`);
        return l;
      }).catch(() => null);
    }

    // Conversa nova? (antes do upsert) — define se o bot deve iniciar.
    const ehNova = !conversaExistente;
    const donoNovaConversa = ehEmpresa ? (lead?.responsavel_id ?? null) : inst.dono_id;

    // Upsert da conversa (1 por instância+contato). Mensagem de entrada
    // (re)inicia a contagem do SLA de resposta na prioridade vigente.
    const prioridadeAtual = conversaExistente
      ? ((await prisma.whatsappConversa.findUnique({ where: { id: conversaExistente.id }, select: { prioridade: true } }))?.prioridade || 'NORMAL')
      : 'NORMAL';
    const conversa = await prisma.whatsappConversa.upsert({
      where: { uq_conversa: { instanciaId: inst.id, contato_numero } },
      create: {
        instanciaId: inst.id,
        dono_id: donoNovaConversa,
        contato_numero,
        contato_nome,
        lead_id: lead?.id,
        ultima_mensagem: texto.slice(0, 200),
        ultima_em: new Date(),
        nao_lidas: 1,
        bot_ativo: false,          // quem liga o robô é a triagem (se ativa)
        bot_estado: null,
        sla_prazo_em: calcularSlaPrazo('NORMAL'),
      },
      update: {
        contato_nome: contato_nome || undefined,
        lead_id: lead?.id,
        ultima_mensagem: texto.slice(0, 200),
        ultima_em: new Date(),
        nao_lidas: { increment: 1 },
        sla_prazo_em: calcularSlaPrazo(prioridadeAtual),
      },
    });

    const mensagemCriada = await prisma.whatsappMensagem.create({
      data: {
        conversaId: conversa.id,
        externo_id,
        direcao: 'ENTRADA',
        tipo: tipoMsg,
        conteudo: texto,
        midia_url: midiaUrl,
        status: 'ENTREGUE',
      },
    });
    console.log(`[WPP] Msg recebida de ${contato_numero} (instância ${inst.instancia_nome})`);
    emitirEventoConversa(conversa.dono_id, 'mensagem', { conversaId: conversa.id, mensagem: mensagemCriada });
    // IA Laya: sugere segmento/intenção/risco em segundo plano (não atrasa o webhook).
    if (tipoMsg === 'TEXTO') agendarAnaliseIa(prisma, conversa.id);

    // Lead respondeu: para a cadência automática (não incomodar mais).
    // Não cria atividade: atividades são só lançadas à mão (pedido da gestão, 24/09/2026).
    if (conversa.cadencia_proxima_etapa) {
      await pausarCadencia(prisma, conversa.id).catch(() => {});
    }

    // ===== TRIAGEM AUTOMÁTICA (só WhatsApp da empresa) =====
    if (ehEmpresa) {
      // "SAIR" de quem recebeu campanha, e botões da pesquisa de satisfação (pós-venda).
      try {
        const { responderSaida } = await import('@/services/assistente-campanhas.service');
        if (tipoMsg === 'TEXTO' && await responderSaida(prisma, inst.instance_token || '', conversa.id, contato_numero, texto)) return;
        if (dados.botao_id) {
          const { responderPesquisa } = await import('@/services/assistente-posvenda.service');
          if (await responderPesquisa(prisma, inst.instance_token || '', conversa.id, contato_numero, dados.botao_id)) return;
        }
      } catch (e: any) { console.error('[POSVENDA/CAMPANHA] resposta:', e?.message); }
      // Botões da proposta enviada pelo WhatsApp (Aceitar / Tenho dúvidas).
      if (dados.botao_id) {
        try {
          const { responderBotaoProposta } = await import('@/services/assistente-proposta.service');
          const aceitar = async (publicToken: string) => {
            const r = await fastify.inject({ method: 'POST', url: `/p/${encodeURIComponent(publicToken)}/aceitar`, payload: {} });
            return r.statusCode < 300;
          };
          if (await responderBotaoProposta(prisma, inst.instance_token || '', conversa.id, dados.botao_id, aceitar)) return;
        } catch (e: any) { console.error('[PROPOSTA-WPP] botão:', e?.message); }
      }
      // Demonstração: escolha de horário na lista ou "remarcar" (só se a demo foi oferecida nesta conversa).
      try {
        const { responderDemo } = await import('@/services/assistente-demo.service');
        if (await responderDemo(prisma, inst.instance_token || '', conversa.id, texto, dados.botao_id)) return;
      } catch (e: any) { console.error('[DEMO] resposta:', e?.message); }
      // Resposta ao "É a sua empresa?" (cadastro achado pelo CNPJ): se casar, é consumida aqui.
      try {
        if (await responderConfirmacaoCliente(prisma, inst.instance_token || '', conversa.id, texto, dados.botao_id)) return;
      } catch (e: any) { console.error('[CNPJ-CLIENTE] erro:', e?.message); }
      try {
        // Triagem abandonada: parou no meio há mais de 24h e o cliente voltou ("oi, bom dia").
        // Não trata essa mensagem como resposta (seria salva como nome/cidade): zera o
        // estado e recomeça do início, pelo mesmo caminho de conversa nova.
        const TRIAGEM_EXPIRA_MS = 24 * 60 * 60 * 1000;
        const triagemVencida = !!conversaExistente && emTriagem(conversaExistente)
          && !!conversaExistente.ultima_em && Date.now() - new Date(conversaExistente.ultima_em).getTime() > TRIAGEM_EXPIRA_MS;
        if (triagemVencida) {
          await prisma.whatsappConversa.updateMany({
            where: { id: conversa.id, bot_ativo: true },
            data: { bot_estado: null, bot_dados: Prisma.DbNull },
          });
        }
        if (ehNova || triagemVencida) {
          const sufTel = contato_numero.slice(-8);
          const clienteBase = await prisma.cliente.findFirst({
            where: { telefone: { contains: sufTel } },
            select: { nome: true, razao_social: true, nome_fantasia: true },
          }).catch(() => null);
          const clienteNome = clienteBase ? (clienteBase.nome_fantasia || clienteBase.razao_social || clienteBase.nome) : null;
          await executarTriagem(prisma, inst.instance_token || '', conversa as any, { inicio: true, clienteNome });
        } else if (emTriagem(conversa as any)) {
          await executarTriagem(prisma, inst.instance_token || '', conversa as any, { texto, botaoId: dados.botao_id });
        }
      } catch (e: any) { console.error('[TRIAGEM] erro:', e?.message); }
      // CNPJ em qualquer mensagem (com ou sem triagem): consulta a Receita e mostra
      // a empresa no painel. Depois da triagem, na mesma fila: se a triagem acabou de
      // consultar esse CNPJ, aqui já não é novo e nada acontece.
      try {
        await detectarCnpjNaConversa(prisma, conversa.id, texto, undefined, inst.instance_token || '');
      } catch (e: any) { console.error('[CNPJ] erro:', e?.message); }
      // IA de texto (Fase 3), em segundo plano e depois de todo o fluxo acima:
      // tira-dúvidas (só quando as regras deixam) e transcrição de áudio.
      if (tipoMsg === 'TEXTO') {
        import('@/services/assistente-ia.service').then(m => m.autoResponderDuvida(prisma, inst.instance_token || '', conversa.id, texto)).catch(() => {});
      } else if (tipoMsg === 'AUDIO' && midiaUrl) {
        import('@/services/assistente-ia.service').then(async m => {
          const cfg = await m.obterConfigIaTexto(prisma);
          if (cfg.tem_chave && cfg.transcrever_auto) await m.transcreverAudio(prisma, mensagemCriada.id);
        }).catch((e: any) => console.warn('[IA] transcrição:', e?.message));
      }
    }
  }
}

// Registra no Inbox uma mensagem ENVIADA pela própria conta fora do CRM
// (WhatsApp Web/celular), para a conversa ficar completa. Idempotente por
// externo_id (não duplica o eco das que o próprio CRM enviou). Não cria
// conversa nova nem lead — só anexa se a conversa já existir.
// Formato Evolution (instâncias antigas por vendedor).
async function registrarMensagemPropria(prisma: PrismaClient, data: any) {
  const remoteJid: string = data?.key?.remoteJid || '';
  // Ignora grupos/broadcast/status.
  if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast') || remoteJid === 'status@broadcast' || data?.key?.participant) return;
  const contato_numero = remoteJid.split('@')[0];
  if (!contato_numero) return;
  const externo_id = data?.key?.id;

  const msg = data?.message || {};
  let tipo: 'TEXTO' | 'IMAGEM' | 'AUDIO' | 'DOCUMENTO' | 'OUTRO' = 'TEXTO';
  let texto = msg.conversation || msg.extendedTextMessage?.text || '';
  const ehMidia = !!(msg.imageMessage || msg.audioMessage || msg.pttMessage || msg.documentMessage);
  if (msg.imageMessage) { tipo = 'IMAGEM'; texto = msg.imageMessage.caption || '[imagem]'; }
  else if (msg.audioMessage || msg.pttMessage) { tipo = 'AUDIO'; texto = '[áudio]'; }
  else if (msg.documentMessage) { tipo = 'DOCUMENTO'; texto = msg.documentMessage.fileName || '[documento]'; }
  else if (!texto) { tipo = 'OUTRO'; texto = '[mensagem]'; }

  // Áudio/imagem/doc enviados pelo celular precisam do base64 p/ tocar/abrir no CRM
  // (a url crua do WhatsApp é criptografada). Baixa via Evolution, igual ao webhook normal.
  const obterMidia = async (conversa: any): Promise<string | undefined> => {
    if (!ehMidia || !conversa?.instancia?.instance_token) return undefined;
    let b64: string | undefined = data?.message?.base64;
    let mime: string | undefined =
      msg.imageMessage?.mimetype || (msg.audioMessage || msg.pttMessage)?.mimetype || msg.documentMessage?.mimetype;
    if (!b64) {
      const baixada = await evo.baixarMidiaBase64(conversa.instancia.instance_token || '', data.key).catch(() => ({} as any));
      b64 = baixada.base64; mime = baixada.mimetype || mime;
    }
    if (!b64) return undefined;
    const tipoMime = mime || (tipo === 'IMAGEM' ? 'image/jpeg' : tipo === 'AUDIO' ? 'audio/ogg' : 'application/octet-stream');
    return `data:${tipoMime};base64,${b64}`;
  };

  await registrarMensagemPropriaNormalizada(prisma, { contato_numero, externo_id, tipo, texto, obterMidia });
}

// Núcleo comum (Evolution e UAZAPI). Sem instanciaId, procura a conversa em
// qualquer instância antiga (comportamento de sempre); com instanciaId, só nela.
async function registrarMensagemPropriaNormalizada(
  prisma: PrismaClient,
  p: {
    instanciaId?: string;
    contato_numero: string;
    externo_id?: string;
    tipo: 'TEXTO' | 'IMAGEM' | 'VIDEO' | 'AUDIO' | 'DOCUMENTO' | 'OUTRO';
    texto: string;
    obterMidia: (conversa: any) => Promise<string | undefined>;
    enviada_pela_api?: boolean;
  },
) {
  const { contato_numero, externo_id, tipo, texto } = p;

  // Já gravada? (eco da mensagem enviada pelo CRM) → não duplica.
  if (externo_id) {
    const existe = await prisma.whatsappMensagem.findFirst({ where: { externo_id } }).catch(() => null);
    if (existe) return;
  }

  // Acha a conversa pelo número. Não cria nova.
  const conversa = await prisma.whatsappConversa.findFirst({
    where: p.instanciaId
      ? { contato_numero, instanciaId: p.instanciaId }
      : { contato_numero, instancia: { instancia_nome: { not: INSTANCIA_EMPRESA } } },
    include: { instancia: true },
  }).catch(() => null);
  if (!conversa) return;

  const midiaUrl = await p.obterMidia(conversa);

  // Anti-duplicação extra: se o CRM acabou de enviar essa mídia/texto mas a
  // Evolution não devolveu externo_id no envio, o eco do webhook chegaria como
  // 2ª bolha. Se já há SAIDA do mesmo tipo nos últimos 90s sem externo_id, pula.
  const recente = await prisma.whatsappMensagem.findFirst({
    where: {
      conversaId: conversa.id,
      direcao: 'SAIDA',
      tipo,
      created_at: { gte: new Date(Date.now() - 90_000) },
    },
    orderBy: { created_at: 'desc' },
  }).catch(() => null);
  if (recente && (!recente.externo_id || recente.externo_id === externo_id)) {
    // Se a recente não tinha mídia e agora temos, completa em vez de duplicar.
    if (midiaUrl && !recente.midia_url) {
      await prisma.whatsappMensagem.update({
        where: { id: recente.id },
        data: { midia_url: midiaUrl, externo_id: recente.externo_id || externo_id },
      }).catch(() => {});
    }
    return;
  }

  const mensagemPropria = await prisma.whatsappMensagem.create({
    data: { conversaId: conversa.id, externo_id, direcao: 'SAIDA', tipo, conteudo: texto, midia_url: midiaUrl, status: 'ENVIADA' },
  }).catch(() => null);
  // Alguém digitou no celular da empresa (não é eco da API): o robô para nessa conversa.
  if (!p.enviada_pela_api) {
    await prisma.whatsappConversa.updateMany({ where: { id: conversa.id, bot_ativo: true }, data: { bot_ativo: false } }).catch(() => {});
  }
  await prisma.whatsappConversa.update({
    where: { id: conversa.id },
    data: { ultima_mensagem: texto.slice(0, 200), ultima_em: new Date() },
  }).catch(() => {});
  console.log(`[WPP] Mensagem própria (WhatsApp Web) registrada p/ ${contato_numero}`);
  if (mensagemPropria) emitirEventoConversa(conversa.dono_id, 'mensagem', { conversaId: conversa.id, mensagem: mensagemPropria });
}

// Acha um Lead existente pelo telefone do contato, IGNORANDO máscara/DDI.
// Estratégia barata: busca candidatos pelos últimos 4 dígitos (contains, poucos
// resultados) e confirma comparando os últimos 8 dígitos SOMENTE numéricos —
// assim "(27) 99999-8888" casa com "5527999998888".
async function acharLeadPorTelefone(prisma: any, contato_numero: string) {
  const so = (s?: string | null) => (s || '').replace(/\D/g, '');
  const alvo = so(contato_numero);
  if (alvo.length < 8) return null;
  const alvo8 = alvo.slice(-8);
  const ult4 = alvo.slice(-4);

  const candidatos = await prisma.lead.findMany({
    where: {
      deleted_at: null,
      OR: [
        { telefone: { contains: ult4 } },
        { responsavel_telefone: { contains: ult4 } },
      ],
    },
    select: { id: true, nome: true, telefone: true, responsavel_telefone: true, responsavel_id: true },
    take: 50,
  }).catch(() => []);

  const hit = candidatos.find(
    (l: any) => so(l.telefone).slice(-8) === alvo8 || so(l.responsavel_telefone).slice(-8) === alvo8,
  );
  return hit ? { id: hit.id, nome: hit.nome, responsavel_id: hit.responsavel_id ?? null } : null;
}
