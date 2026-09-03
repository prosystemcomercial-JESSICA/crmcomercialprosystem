import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getUser, podeVerTudo } from '@/lib/scope';
import * as evo from '@/services/evolution.service';
import { calcularSlaPrazo } from '@/services/whatsapp-sla.service';
import { entrarNaCadencia, pausarCadencia } from '@/services/whatsapp-cadencia.service';

// Etapas do funil comercial de WhatsApp (Kanban) — ordem de exibição.
export const ESTAGIOS_FUNIL = ['NOVO_CONTATO', 'EM_NEGOCIACAO', 'PROPOSTA_ENVIADA', 'AGUARDANDO_RETORNO', 'FECHADO'] as const;
export const PRIORIDADES = ['BAIXA', 'NORMAL', 'CRITICA'] as const;

// WhatsApp Inbox multi-instância.
//   - Cada usuário conecta a SUA instância (instancia_nome = `crm-<userId>`).
//   - Escopo: vendedor vê só as conversas das próprias instâncias (dono_id);
//     gestão (podeVerTudo) vê todas.
//   - O webhook de recebimento é público (a Evolution chama sem auth do CRM),
//     então ele resolve a instância pelo nome e nunca confia em quem chamou.

export async function whatsappRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  const instanciaNomeDe = (userId: string) => `crm-${userId}`;

  // Filtro de escopo por dono para conversas/instâncias.
  // CADA usuário (inclusive gestão) vê SOMENTE as conversas das próprias
  // instâncias (dono_id). Conversas transferidas para a pessoa passam a ter o
  // dono_id dela, então aparecem aqui naturalmente — atende ao pedido:
  // "só a minha instância, a não ser que alguém transfira para mim".
  function escopoDono(request: any): Record<string, any> {
    const user = getUser(request);
    return { dono_id: user?.id || '__no_user__' };
  }

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

    // Sincroniza status real com a Evolution.
    const statusReal = await evo.obterStatus(nome);
    if (inst) {
      inst = await prisma.whatsappInstancia.update({
        where: { id: inst.id },
        data: { status: statusReal, conectado_em: statusReal === 'CONECTADO' ? (inst.conectado_em ?? new Date()) : inst.conectado_em },
      });
    }

    return reply.send({
      status: 'success',
      data: { configurado: true, status: statusReal, instancia: inst },
    });
  });

  // Inicia conexão: cria a instância na Evolution e devolve o QR Code.
  fastify.post('/whatsapp/conectar', async (request, reply) => {
    const user = getUser(request);
    if (!user?.id) return reply.status(401).send({ status: 'error', message: 'Não autenticado' });
    if (!evo.evolutionConfigurada()) {
      return reply.status(400).send({ status: 'error', message: 'Evolution API não configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY)' });
    }

    const nome = instanciaNomeDe(user.id);
    let qr: string | undefined;
    try {
      const r = await evo.criarInstancia(nome);
      qr = r.qr;
    } catch {
      // Instância provavelmente já existe → só pega o QR atual.
      const r = await evo.obterQrCode(nome);
      qr = r.qr;
    }

    await prisma.whatsappInstancia.upsert({
      where: { instancia_nome: nome },
      create: { instancia_nome: nome, dono_id: user.id, dono_nome: user.nome, status: 'CONECTANDO', qr_code: qr },
      update: { status: 'CONECTANDO', qr_code: qr },
    });

    return reply.send({ status: 'success', data: { qr, status: 'CONECTANDO' } });
  });

  // Desconecta a instância do usuário.
  fastify.post('/whatsapp/desconectar', async (request, reply) => {
    const user = getUser(request);
    if (!user?.id) return reply.status(401).send({ status: 'error', message: 'Não autenticado' });
    const nome = instanciaNomeDe(user.id);
    await evo.desconectarInstancia(nome);
    await prisma.whatsappInstancia.updateMany({
      where: { instancia_nome: nome },
      data: { status: 'DESCONECTADO', qr_code: null },
    });
    return reply.send({ status: 'success' });
  });

  // ===== MULTI-INSTÂNCIA =====
  // Lista todas as instâncias do usuário (sincroniza status com a Evolution).
  fastify.get('/whatsapp/instancias', async (request, reply) => {
    const user = getUser(request);
    if (!user?.id) return reply.status(401).send({ status: 'error', message: 'Não autenticado' });
    if (!evo.evolutionConfigurada()) return reply.send({ status: 'success', data: { configurado: false, instancias: [] } });

    const lista = await prisma.whatsappInstancia.findMany({ where: { dono_id: user.id }, orderBy: { created_at: 'asc' } });
    // Atualiza status real de cada uma.
    for (const i of lista) {
      const st = await evo.obterStatus(i.instancia_nome).catch(() => i.status as any);
      if (st !== i.status) await prisma.whatsappInstancia.update({ where: { id: i.id }, data: { status: st, conectado_em: st === 'CONECTADO' ? (i.conectado_em ?? new Date()) : i.conectado_em } }).catch(() => {});
      (i as any).status = st;
    }
    return reply.send({ status: 'success', data: { configurado: true, instancias: lista } });
  });

  // Cria uma nova instância nomeada e devolve o QR.
  fastify.post('/whatsapp/instancias', async (request, reply) => {
    const user = getUser(request);
    if (!user?.id) return reply.status(401).send({ status: 'error', message: 'Não autenticado' });
    if (!evo.evolutionConfigurada()) return reply.status(400).send({ status: 'error', message: 'Evolution API não configurada' });
    const body = z.object({ apelido: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe um nome para a instância' });

    // Nome técnico único: crm-<userId>-<slug>-<rand>.
    const slug = body.data.apelido.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20);
    const nome = `crm-${user.id}-${slug}-${Math.random().toString(36).slice(2, 6)}`;
    let qr: string | undefined;
    try { qr = (await evo.criarInstancia(nome)).qr; } catch { qr = (await evo.obterQrCode(nome)).qr; }
    const inst = await prisma.whatsappInstancia.create({
      data: { instancia_nome: nome, apelido: body.data.apelido, dono_id: user.id, dono_nome: user.nome, status: 'CONECTANDO', qr_code: qr },
    });
    return reply.send({ status: 'success', data: { instancia: inst, qr } });
  });

  // Reobtém QR de uma instância (reconectar).
  fastify.post('/whatsapp/instancias/:id/conectar', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const inst = await prisma.whatsappInstancia.findFirst({ where: { id, dono_id: user?.id } });
    if (!inst) return reply.status(404).send({ status: 'error', message: 'Instância não encontrada' });
    let qr: string | undefined;
    try { qr = (await evo.criarInstancia(inst.instancia_nome)).qr; } catch { qr = (await evo.obterQrCode(inst.instancia_nome)).qr; }
    await prisma.whatsappInstancia.update({ where: { id }, data: { status: 'CONECTANDO', qr_code: qr } });
    return reply.send({ status: 'success', data: { qr } });
  });

  // Desconecta uma instância específica.
  fastify.post('/whatsapp/instancias/:id/desconectar', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const inst = await prisma.whatsappInstancia.findFirst({ where: { id, dono_id: user?.id } });
    if (!inst) return reply.status(404).send({ status: 'error', message: 'Instância não encontrada' });
    await evo.desconectarInstancia(inst.instancia_nome);
    await prisma.whatsappInstancia.update({ where: { id }, data: { status: 'DESCONECTADO', qr_code: null } });
    return reply.send({ status: 'success' });
  });

  // Apaga a instância de vez (logout + delete na Evolution + remove do banco).
  // Usar quando "desconectar" não basta (instância travada/órfã).
  fastify.delete('/whatsapp/instancias/:id', async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const inst = await prisma.whatsappInstancia.findFirst({ where: { id, dono_id: user?.id } });
    if (!inst) return reply.status(404).send({ status: 'error', message: 'Instância não encontrada' });
    await evo.deletarInstancia(inst.instancia_nome).catch(() => {});
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
    const inst = await prisma.whatsappInstancia.findFirst({ where: { id, dono_id: user?.id } });
    if (!inst) return reply.status(404).send({ status: 'error', message: 'Instância não encontrada' });
    const upd = await prisma.whatsappInstancia.update({ where: { id }, data: { apelido: body.data.apelido } });
    return reply.send({ status: 'success', data: upd });
  });

  // ===== CONVERSAS =====

  // Lista conversas (escopadas ao dono; gestão vê todas), ordenadas por atividade.
  // Filtra por instância quando ?instanciaId= é informado (seletor multi-instância).
  fastify.get('/whatsapp/conversas', async (request, reply) => {
    const { instanciaId, escopo } = request.query as { instanciaId?: string; escopo?: string };
    // Visão de supervisão: gestão pode pedir escopo=todos p/ ver as conversas de
    // TODOS os vendedores num só lugar (sem assumir). Padrão = só as próprias.
    const verTudo = escopo === 'todos' && podeVerTudo(getUser(request));
    const filtroEscopo = verTudo ? {} : escopoDono(request);
    const conversas = await prisma.whatsappConversa.findMany({
      where: { ...filtroEscopo, ...(instanciaId ? { instanciaId } : {}) },
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
    return reply.send({ status: 'success', data: conversas });
  });

  // Desvincula a conversa do funil: tira o lead_id e, se o lead foi criado
  // automaticamente via WhatsApp, faz soft-delete dele (sai do dashboard).
  // Também desativa o bot (não é um lead comercial — ex.: suporte/fornecedor).
  fastify.post('/whatsapp/conversas/:id/desvincular', async (request, reply) => {
    const { id } = request.params as { id: string };
    const conversa = await prisma.whatsappConversa.findFirst({ where: { id, ...escopoDono(request) } });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });

    if (conversa.lead_id) {
      const lead = await prisma.lead.findUnique({ where: { id: conversa.lead_id }, select: { origem: true } }).catch(() => null);
      // Só soft-deleta leads nascidos do WhatsApp (captação automática). Lead
      // vinculado manualmente a um cliente real é preservado, só desvincula.
      if (lead?.origem === 'WHATSAPP') {
        await prisma.lead.update({
          where: { id: conversa.lead_id },
          data: { deleted_at: new Date() as any },
        }).catch(() => {});
      }
    }

    await prisma.whatsappConversa.update({
      where: { id },
      data: { lead_id: null, bot_ativo: false, bot_estado: null },
    });
    return reply.send({ status: 'success' });
  });

  // Vincula a conversa a um CLIENTE da base e registra o contato (nome, telefone,
  // cargo) na ficha do cliente. Assim contatos de WhatsApp que já são clientes
  // ficam salvos e atualizados. Idempotente: se já existe contato com o mesmo
  // telefone, atualiza em vez de duplicar.
  fastify.post('/whatsapp/conversas/:id/vincular-cliente', async (request, reply) => {
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

    const nomeContato = body.data.nome || conversa.contato_nome || conversa.contato_numero;
    const telefone = conversa.contato_numero;

    // Marca o vínculo na conversa.
    await prisma.whatsappConversa.update({ where: { id }, data: { cliente_id: body.data.cliente_id } });

    // Cria/atualiza o contato na ficha do cliente (dedupe por telefone).
    const existente = await (prisma as any).contatoCliente.findFirst({
      where: { cliente_id: body.data.cliente_id, telefone },
    }).catch(() => null);
    let contato;
    if (existente) {
      contato = await (prisma as any).contatoCliente.update({
        where: { id: existente.id },
        data: { nome: nomeContato, cargo: body.data.cargo ?? existente.cargo, origem: 'WHATSAPP' },
      });
    } else {
      contato = await (prisma as any).contatoCliente.create({
        data: { cliente_id: body.data.cliente_id, nome: nomeContato, telefone, cargo: body.data.cargo || null, origem: 'WHATSAPP' },
      });
    }

    // Evento na timeline do cliente.
    await (prisma as any).eventoCliente.create({
      data: {
        cliente_id: body.data.cliente_id, tipo: 'OBSERVACAO',
        titulo: `Contato de WhatsApp vinculado: ${nomeContato}${body.data.cargo ? ' (' + body.data.cargo + ')' : ''}`,
        descricao: `Telefone ${telefone}`, feito_por: user?.id, feito_por_nome: user?.nome,
      },
    }).catch(() => {});

    return reply.send({ status: 'success', data: { contato }, message: 'Conversa vinculada ao cliente.' });
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
          google_meet_link: body.data.link || null, responsavel_id: conversa.dono_id, created_by: user?.id || 'system',
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
      const r = await evo.enviarTexto(conversa.instancia.instancia_nome, conversa.contato_numero, msg);
      externo_id = r.externo_id;
    } catch (e: any) {
      return reply.status(502).send({ status: 'error', message: `Reunião criada, mas falha ao enviar no WhatsApp: ${e.message}` });
    }

    // Registra a mensagem enviada no Inbox.
    await prisma.whatsappMensagem.create({
      data: { conversaId: id, externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo: msg, status: 'ENVIADA', enviada_por: user?.id },
    }).catch(() => {});
    await prisma.whatsappConversa.update({ where: { id }, data: { ultima_mensagem: '📅 Reunião agendada', ultima_em: new Date() } }).catch(() => {});

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
    const nome = instanciaNomeDe(user.id);
    const inst = await prisma.whatsappInstancia.findUnique({ where: { instancia_nome: nome } });
    if (!inst) return reply.status(400).send({ status: 'error', message: 'Conecte seu WhatsApp primeiro' });

    const conversa = await prisma.whatsappConversa.upsert({
      where: { uq_conversa: { instanciaId: inst.id, contato_numero: numero } },
      create: {
        instanciaId: inst.id, dono_id: inst.dono_id, contato_numero: numero,
        contato_nome: body.data.nome, lead_id: body.data.lead_id, ultima_em: new Date(),
      },
      update: { contato_nome: body.data.nome || undefined, lead_id: body.data.lead_id || undefined },
    });
    return reply.send({ status: 'success', data: conversa });
  });

  // Define/limpa a etiqueta de organização da conversa (Padaria, Farmácia, etc.).
  // Tipos de atendimento que NÃO são lead comercial → desvinculam do funil ao marcar.
  const TIPOS_NAO_COMERCIAIS = ['Financeiro', 'Renegociação', 'Serviço', 'Parceiro', 'Pessoal', 'Suporte'];

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
      data.bot_ativo = false; data.bot_estado = null;
      if (conversa.lead_id) {
        const lead = await prisma.lead.findUnique({ where: { id: conversa.lead_id }, select: { origem: true } }).catch(() => null);
        if (lead?.origem === 'WHATSAPP') {
          await prisma.lead.update({ where: { id: conversa.lead_id }, data: { deleted_at: new Date() as any } }).catch(() => {});
        }
        data.lead_id = null;
      }
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
    // ou em branco/null — tolerante) + contas de sistema (Jessica/Diretora, que
    // são mock fora do banco). Raw query p/ não depender do match exato de status.
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome, cargo FROM UsuarioCRM WHERE status IS NULL OR status = '' OR UPPER(status) = 'ATIVO' ORDER BY nome ASC`
    ).catch(() => []);
    // Inclui as contas de sistema que também atendem/vendem (ex.: Jessica).
    try {
      const { CONTAS_SISTEMA } = await import('@/lib/usuarios');
      Object.entries(CONTAS_SISTEMA).forEach(([id, info]: any) => {
        if (!rows.some(r => r.id === id)) rows.unshift({ id, nome: info.nome, cargo: info.cargo || 'CEO' });
      });
    } catch { /* ignora se o módulo não existir */ }
    return reply.send({ status: 'success', data: rows });
  });

  // Painel lateral da conversa: resumo comercial (cliente vinculado, proposta em
  // aberto, tempo de casa) para a tela de atendimento — não pesa a listagem.
  fastify.get('/whatsapp/conversas/:id/painel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const filtro = podeVerTudo(getUser(request)) ? {} : escopoDono(request);
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
    const filtro = podeVerTudo(getUser(request)) ? {} : escopoDono(request);
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
      const r = await evo.enviarTexto(conversa.instancia.instancia_nome, conversa.contato_numero, body.data.texto);
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
      const r = await evo.enviarAudio(conversa.instancia.instancia_nome, conversa.contato_numero, dataUrl);
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

    return reply.send({ status: 'success', data: msg });
  });

  // ===== WEBHOOK (público — chamado pela Evolution) =====
  // Recebe MESSAGES_UPSERT / CONNECTION_UPDATE. Resolve a instância pelo nome,
  // cria/vincula conversa e grava a mensagem. Idempotente por externo_id.
  fastify.post('/whatsapp/webhook', async (request, reply) => {
    // Responde rápido — processa em try/catch para nunca falhar p/ a Evolution.
    reply.send({ status: 'success' });

    try {
      const payload = request.body as any;
      const evento = payload?.event || payload?.type;
      const instanciaNome = payload?.instance || payload?.instanceName;
      if (!instanciaNome) return;

      const inst = await prisma.whatsappInstancia.findUnique({ where: { instancia_nome: instanciaNome } });
      if (!inst) return;

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
        let midiaUrl: string | undefined;
        let texto = msg.conversation || msg.extendedTextMessage?.text || '';

        const ehMidia = !!(msg.imageMessage || msg.audioMessage || msg.pttMessage || msg.documentMessage);
        if (msg.imageMessage) { tipoMsg = 'IMAGEM'; texto = msg.imageMessage.caption || '[imagem]'; }
        else if (msg.audioMessage || msg.pttMessage) { tipoMsg = 'AUDIO'; texto = '[áudio]'; }
        else if (msg.documentMessage) { tipoMsg = 'DOCUMENTO'; texto = msg.documentMessage.fileName || '[documento]'; }
        else if (!texto) { tipoMsg = 'OUTRO'; texto = '[mensagem]'; }

        // Conteúdo da mídia: usa o base64 do webhook se vier; senão baixa via
        // Evolution (a url crua do WhatsApp é criptografada e não abre no browser).
        if (ehMidia) {
          let b64: string | undefined = data?.message?.base64;
          let mime: string | undefined =
            msg.imageMessage?.mimetype || (msg.audioMessage || msg.pttMessage)?.mimetype || msg.documentMessage?.mimetype;
          if (!b64) {
            const baixada = await evo.baixarMidiaBase64(inst.instancia_nome, data.key).catch(() => ({} as any));
            b64 = baixada.base64; mime = baixada.mimetype || mime;
          }
          if (b64) {
            const tipoMime = mime || (tipoMsg === 'IMAGEM' ? 'image/jpeg' : tipoMsg === 'AUDIO' ? 'audio/ogg' : 'application/octet-stream');
            midiaUrl = `data:${tipoMime};base64,${b64}`;
          }
        }

        // Idempotência: se já gravamos essa mensagem, sai.
        if (externo_id) {
          const existe = await prisma.whatsappMensagem.findUnique({ where: { externo_id } }).catch(() => null);
          if (existe) return;
        }

        // Tenta vincular a um Lead existente pelo telefone — IGNORANDO máscara.
        // O telefone do lead pode estar salvo como "(27) 99999-8888"; comparar só
        // os dígitos evita não casar com o número cru do WhatsApp (5527999998888).
        let lead = await acharLeadPorTelefone(prisma, contato_numero);

        // EVO-4 — Captação automática: número desconhecido + conversa nova
        // vira um Lead novo no funil, atribuído ao dono da instância (o vendedor).
        const conversaExistente = await prisma.whatsappConversa.findUnique({
          where: { uq_conversa: { instanciaId: inst.id, contato_numero } },
          select: { id: true },
        }).catch(() => null);

        if (!lead && !conversaExistente) {
          // Nome do vendedor dono da instância p/ a etiqueta do card (cor + nome).
          // Usa dono_nome da instância; se faltar, resolve do cadastro/contas de sistema.
          let vendedorNome: string | undefined = (inst as any).dono_nome || undefined;
          if (!vendedorNome && inst.dono_id) {
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
              responsavel_id: inst.dono_id,
              vendedor_nome: vendedorNome,           // → etiqueta do responsável no card
              atribuido_em: new Date(),
              created_by: inst.dono_id,
              observacoes_comerciais: `Lead captado automaticamente via WhatsApp. Primeira mensagem: "${texto.slice(0, 180)}"`,
            },
            select: { id: true, nome: true },
          }).then(l => {
            console.log(`[WPP] Lead captado automaticamente: ${l.id} (${contato_numero})`);
            return l;
          }).catch(() => null);
        }

        // Conversa nova? (antes do upsert) — define se o bot deve iniciar.
        const ehNova = !conversaExistente;

        // Upsert da conversa (1 por instância+contato). Mensagem de entrada
        // (re)inicia a contagem do SLA de resposta na prioridade vigente.
        const prioridadeAtual = conversaExistente
          ? ((await prisma.whatsappConversa.findUnique({ where: { id: conversaExistente.id }, select: { prioridade: true } }))?.prioridade || 'NORMAL')
          : 'NORMAL';
        const conversa = await prisma.whatsappConversa.upsert({
          where: { uq_conversa: { instanciaId: inst.id, contato_numero } },
          create: {
            instanciaId: inst.id,
            dono_id: inst.dono_id,
            contato_numero,
            contato_nome,
            lead_id: lead?.id,
            ultima_mensagem: texto.slice(0, 200),
            ultima_em: new Date(),
            nao_lidas: 1,
            bot_ativo: true,           // número novo → bot conduz a qualificação
            bot_estado: 'SAUDACAO',
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

        await prisma.whatsappMensagem.create({
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
        console.log(`[WPP] Msg recebida de ${contato_numero} (instância ${instanciaNome})`);

        // Lead respondeu: para a cadência automática (não incomodar mais).
        if (conversa.cadencia_proxima_etapa) {
          await pausarCadencia(prisma, conversa.id).catch(() => {});
        }

        // ===== CHATBOT DE QUALIFICAÇÃO (fluxo guiado, sem custo) =====
        // Kill switch global: o bot só roda se WHATSAPP_BOT_ATIVO === 'true'.
        // Desligado por padrão (Jessica pediu para parar o bot). Para religar,
        // basta setar WHATSAPP_BOT_ATIVO=true nas variáveis do backend no Railway.
        const botLigado = process.env.WHATSAPP_BOT_ATIVO === 'true';
        if (botLigado && conversa.bot_ativo && conversa.bot_estado) {
          try {
            // C5: reconhece se o número é de um CLIENTE da base (pelos últimos 8 dígitos).
            const sufTel = contato_numero.slice(-8);
            const clienteBase = await prisma.cliente.findFirst({
              where: { telefone: { contains: sufTel } },
              select: { id: true, nome: true, razao_social: true, nome_fantasia: true },
            }).catch(() => null);
            await processarBot(prisma, inst.instancia_nome, conversa, ehNova, texto, lead?.id, clienteBase);
          } catch (e: any) { console.error('[BOT] erro:', e?.message); }
        }
      }
    } catch (err: any) {
      console.error('[WPP] Erro no webhook:', err?.message);
    }
  });
}

// ===== CHATBOT DE QUALIFICAÇÃO (fluxo guiado) =====
// Máquina de estados simples. Reaproveita a instância do dono para responder.
// Estados: SAUDACAO → AGUARDA_CLIENTE → AGUARDA_SEGMENTO → AGUARDA_NOME → CONCLUIDO.
async function processarBot(
  prisma: PrismaClient,
  instanciaNome: string,
  conversa: any,
  ehNova: boolean,
  texto: string,
  leadId?: string,
  clienteBase?: { id: string; nome: string; razao_social?: string | null; nome_fantasia?: string | null } | null,
) {
  const responder = async (msg: string, proximoEstado: string | null) => {
    let externo_id: string | undefined;
    try { const r = await evo.enviarTexto(instanciaNome, conversa.contato_numero, msg); externo_id = r.externo_id; } catch {}
    await prisma.whatsappMensagem.create({
      data: { conversaId: conversa.id, externo_id, direcao: 'SAIDA', tipo: 'TEXTO', conteudo: msg, status: 'ENVIADA', enviada_por: 'bot' },
    }).catch(() => {});
    await prisma.whatsappConversa.update({
      where: { id: conversa.id },
      data: {
        ultima_mensagem: msg.slice(0, 200), ultima_em: new Date(),
        bot_estado: proximoEstado, bot_ativo: proximoEstado !== null,
      },
    }).catch(() => {});
  };

  const t = (texto || '').trim();
  const tl = t.toLowerCase();

  // 1) Primeira mensagem do contato novo → saudação.
  if (ehNova || conversa.bot_estado === 'SAUDACAO') {
    // C5: número reconhecido como CLIENTE da base → saudação personalizada e
    // deixa o cliente falar (encerra o bot; um consultor assume p/ upsell/filial).
    if (clienteBase) {
      const nomeCli = clienteBase.nome_fantasia || clienteBase.razao_social || clienteBase.nome;
      await responder(
        `Olá! 👋 Que bom falar com você novamente. Identificamos seu cadastro aqui na *ProSystem* — *${nomeCli}*. ✅\n\n` +
        'Como podemos ajudar hoje? Pode falar à vontade sobre o que precisa (suporte, dúvida, nova unidade/filial, upgrade de plano…) que um consultor já te atende. 💙',
        null, // encerra o bot → consultor assume
      );
      return;
    }
    // Contato novo desconhecido → fluxo de qualificação.
    await responder(
      'Olá! 👋 Aqui é o atendimento virtual da *ProSystem Sistemas* (sistemas para varejo).\n\n' +
      'Posso adiantar seu atendimento? Para começar, me responda:\n\n' +
      'Você *já é cliente* ProSystem?\n*1* - Sim, já sou cliente\n*2* - Não, quero conhecer',
      'AGUARDA_CLIENTE',
    );
    return;
  }

  // 2) Já é cliente? Valida a resposta (1/2/sim/não); senão re-pergunta.
  if (conversa.bot_estado === 'AGUARDA_CLIENTE') {
    const disseSim = tl.startsWith('1') || /\b(sim|sou|já sou|ja sou|cliente)\b/.test(tl);
    const disseNao = tl.startsWith('2') || /\b(n[aã]o|ainda n|quero conhecer|conhecer)\b/.test(tl);
    if (!disseSim && !disseNao) {
      // Resposta não reconhecida → re-pergunta de forma objetiva (não avança).
      await responder(
        'Só para eu entender melhor 🙂 — você *já é cliente* da ProSystem?\n' +
        'Responda com *1* (já sou cliente) ou *2* (quero conhecer).',
        'AGUARDA_CLIENTE',
      );
      return;
    }
    if (leadId) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { observacoes_comerciais: disseSim ? 'WhatsApp: já é cliente ProSystem.' : 'WhatsApp: lead novo (ainda não é cliente).' },
      }).catch(() => {});
    }
    await responder(
      'Perfeito, obrigado! 🙌\n\nQual o *segmento* do seu negócio?\n' +
      '_Ex.: Farmácia, Padaria, Supermercado, Loja de varejo, Outro…_',
      'AGUARDA_SEGMENTO',
    );
    return;
  }

  // 3) Segmento → valida (texto com pelo menos 2 letras); senão re-pergunta.
  if (conversa.bot_estado === 'AGUARDA_SEGMENTO') {
    const valido = t.replace(/[^a-zA-ZÀ-ÿ]/g, '').length >= 2; // tem palavra de verdade
    if (!valido) {
      await responder(
        'Pode me dizer o *segmento* do seu negócio? Ex.: Farmácia, Padaria, Supermercado, Varejo…',
        'AGUARDA_SEGMENTO',
      );
      return;
    }
    if (leadId) {
      await prisma.lead.update({ where: { id: leadId }, data: { segmento: t.slice(0, 80) } }).catch(() => {});
    }
    await responder(
      'Anotado! E qual o *nome da sua empresa* (razão social ou nome fantasia)?',
      'AGUARDA_NOME',
    );
    return;
  }

  // 4) Nome da empresa → valida (>=2 letras); senão re-pergunta. Depois encerra.
  if (conversa.bot_estado === 'AGUARDA_NOME') {
    const valido = t.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '').length >= 2;
    if (!valido) {
      await responder(
        'Quase lá! Qual é o *nome da sua empresa* (razão social ou nome fantasia)?',
        'AGUARDA_NOME',
      );
      return;
    }
    if (leadId && t) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { nome: t.slice(0, 120), razao_social: t.slice(0, 120), empresa: t.slice(0, 120) },
      }).catch(() => {});
    }
    if (conversa.contato_nome === null && t) {
      await prisma.whatsappConversa.update({ where: { id: conversa.id }, data: { contato_nome: t.slice(0, 80) } }).catch(() => {});
    }
    await responder(
      'Muito obrigado! ✅ Suas informações foram registradas.\n\n' +
      'Um de nossos *consultores* dará continuidade ao seu atendimento em instantes. ' +
      'Enquanto isso, fique à vontade para enviar suas dúvidas por aqui. 💙',
      null, // encerra o bot (CONCLUIDO) → vendedor assume
    );
    return;
  }
}

// Registra no Inbox uma mensagem ENVIADA pela própria conta fora do CRM
// (WhatsApp Web/celular), para a conversa ficar completa. Idempotente por
// externo_id (não duplica o eco das que o próprio CRM enviou). Não cria
// conversa nova nem lead — só anexa se a conversa já existir.
async function registrarMensagemPropria(prisma: PrismaClient, data: any) {
  const remoteJid: string = data?.key?.remoteJid || '';
  // Ignora grupos/broadcast/status.
  if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast') || remoteJid === 'status@broadcast' || data?.key?.participant) return;
  const contato_numero = remoteJid.split('@')[0];
  if (!contato_numero) return;
  const externo_id = data?.key?.id;

  // Já gravada? (eco da mensagem enviada pelo CRM) → não duplica.
  if (externo_id) {
    const existe = await prisma.whatsappMensagem.findUnique({ where: { externo_id } }).catch(() => null);
    if (existe) return;
  }

  // Acha a conversa pelo número (qualquer instância). Não cria nova.
  const conversa = await prisma.whatsappConversa.findFirst({
    where: { contato_numero },
    include: { instancia: true },
  }).catch(() => null);
  if (!conversa) return;

  const msg = data?.message || {};
  let tipo: 'TEXTO' | 'IMAGEM' | 'AUDIO' | 'DOCUMENTO' | 'OUTRO' = 'TEXTO';
  let texto = msg.conversation || msg.extendedTextMessage?.text || '';
  let midiaUrl: string | undefined;
  const ehMidia = !!(msg.imageMessage || msg.audioMessage || msg.pttMessage || msg.documentMessage);
  if (msg.imageMessage) { tipo = 'IMAGEM'; texto = msg.imageMessage.caption || '[imagem]'; }
  else if (msg.audioMessage || msg.pttMessage) { tipo = 'AUDIO'; texto = '[áudio]'; }
  else if (msg.documentMessage) { tipo = 'DOCUMENTO'; texto = msg.documentMessage.fileName || '[documento]'; }
  else if (!texto) { tipo = 'OUTRO'; texto = '[mensagem]'; }

  // Áudio/imagem/doc enviados pelo celular precisam do base64 p/ tocar/abrir no CRM
  // (a url crua do WhatsApp é criptografada). Baixa via Evolution, igual ao webhook normal.
  if (ehMidia && (conversa as any).instancia?.instancia_nome) {
    let b64: string | undefined = data?.message?.base64;
    let mime: string | undefined =
      msg.imageMessage?.mimetype || (msg.audioMessage || msg.pttMessage)?.mimetype || msg.documentMessage?.mimetype;
    if (!b64) {
      const baixada = await evo.baixarMidiaBase64((conversa as any).instancia.instancia_nome, data.key).catch(() => ({} as any));
      b64 = baixada.base64; mime = baixada.mimetype || mime;
    }
    if (b64) {
      const tipoMime = mime || (tipo === 'IMAGEM' ? 'image/jpeg' : tipo === 'AUDIO' ? 'audio/ogg' : 'application/octet-stream');
      midiaUrl = `data:${tipoMime};base64,${b64}`;
    }
  }

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

  await prisma.whatsappMensagem.create({
    data: { conversaId: conversa.id, externo_id, direcao: 'SAIDA', tipo, conteudo: texto, midia_url: midiaUrl, status: 'ENVIADA' },
  }).catch(() => {});
  await prisma.whatsappConversa.update({
    where: { id: conversa.id },
    data: { ultima_mensagem: texto.slice(0, 200), ultima_em: new Date() },
  }).catch(() => {});
  console.log(`[WPP] Mensagem própria (WhatsApp Web) registrada p/ ${contato_numero}`);
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
    select: { id: true, nome: true, telefone: true, responsavel_telefone: true },
    take: 50,
  }).catch(() => []);

  const hit = candidatos.find(
    (l: any) => so(l.telefone).slice(-8) === alvo8 || so(l.responsavel_telefone).slice(-8) === alvo8,
  );
  return hit ? { id: hit.id, nome: hit.nome } : null;
}
