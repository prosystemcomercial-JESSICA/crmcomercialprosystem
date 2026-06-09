import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getUser, podeVerTudo } from '@/lib/scope';
import * as evo from '@/services/evolution.service';

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
  function escopoDono(request: any): Record<string, any> {
    const user = getUser(request);
    if (podeVerTudo(user)) return {};            // gestão vê tudo
    return { dono_id: user?.id || '__no_user__' }; // vendedor: só o seu
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
    const { instanciaId } = request.query as { instanciaId?: string };
    const conversas = await prisma.whatsappConversa.findMany({
      where: { ...escopoDono(request), ...(instanciaId ? { instanciaId } : {}) },
      orderBy: { ultima_em: 'desc' },
      take: 150,
      include: { instancia: { select: { apelido: true, dono_nome: true, numero: true } } },
    });
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
  fastify.patch('/whatsapp/conversas/:id/etiqueta', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ etiqueta: z.string().optional(), etiqueta_cor: z.string().optional() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    const conversa = await prisma.whatsappConversa.findFirst({ where: { id, ...escopoDono(request) } });
    if (!conversa) return reply.status(404).send({ status: 'error', message: 'Conversa não encontrada' });
    const upd = await prisma.whatsappConversa.update({
      where: { id }, data: { etiqueta: body.data.etiqueta || null, etiqueta_cor: body.data.etiqueta_cor || '#6b7280' },
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
    const vendedores = await prisma.usuarioCRM.findMany({
      where: { status: 'ATIVO' }, select: { id: true, nome: true, cargo: true }, orderBy: { nome: 'asc' },
    });
    return reply.send({ status: 'success', data: vendedores });
  });

  // Mensagens de uma conversa (valida escopo) + marca como lidas.
  fastify.get('/whatsapp/conversas/:id/mensagens', async (request, reply) => {
    const { id } = request.params as { id: string };
    const conversa = await prisma.whatsappConversa.findFirst({
      where: { id, ...escopoDono(request) },
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
      data: { ultima_mensagem: body.data.texto.slice(0, 200), ultima_em: new Date() },
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
        if (fromMe) return; // ignorar ecos das próprias mensagens enviadas

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

        // Tenta vincular a um Lead existente pelo telefone (últimos 8 dígitos).
        const sufixo = contato_numero.slice(-8);
        let lead = await prisma.lead.findFirst({
          where: {
            deleted_at: null,
            OR: [
              { telefone: { contains: sufixo } },
              { responsavel_telefone: { contains: sufixo } },
            ],
          },
          select: { id: true, nome: true },
        }).catch(() => null);

        // EVO-4 — Captação automática: número desconhecido + conversa nova
        // vira um Lead novo no funil, atribuído ao dono da instância (o vendedor).
        const conversaExistente = await prisma.whatsappConversa.findUnique({
          where: { uq_conversa: { instanciaId: inst.id, contato_numero } },
          select: { id: true },
        }).catch(() => null);

        if (!lead && !conversaExistente) {
          lead = await prisma.lead.create({
            data: {
              nome: contato_nome || `WhatsApp ${contato_numero}`,
              telefone: contato_numero,
              responsavel_telefone: contato_numero,
              origem: 'WHATSAPP',
              responsavel_id: inst.dono_id,
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

        // Upsert da conversa (1 por instância+contato).
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
          },
          update: {
            contato_nome: contato_nome || undefined,
            lead_id: lead?.id,
            ultima_mensagem: texto.slice(0, 200),
            ultima_em: new Date(),
            nao_lidas: { increment: 1 },
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

        // ===== CHATBOT DE QUALIFICAÇÃO (fluxo guiado, sem custo) =====
        // Só conduz se o bot estiver ativo nesta conversa (número novo).
        if (conversa.bot_ativo && conversa.bot_estado) {
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

  // 2) Já é cliente?
  if (conversa.bot_estado === 'AGUARDA_CLIENTE') {
    const jaCliente = tl.startsWith('1') || tl.includes('sim') || tl.includes('sou cliente');
    if (leadId) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { observacoes_comerciais: jaCliente ? 'WhatsApp: já é cliente ProSystem.' : 'WhatsApp: lead novo (ainda não é cliente).' },
      }).catch(() => {});
    }
    await responder(
      'Perfeito, obrigado! 🙌\n\nQual o *segmento* do seu negócio?\n' +
      '_Ex.: Farmácia, Padaria, Supermercado, Loja de varejo, Outro…_',
      'AGUARDA_SEGMENTO',
    );
    return;
  }

  // 3) Segmento → grava no lead.
  if (conversa.bot_estado === 'AGUARDA_SEGMENTO') {
    if (leadId && t) {
      await prisma.lead.update({ where: { id: leadId }, data: { segmento: t.slice(0, 80) } }).catch(() => {});
    }
    await responder(
      'Anotado! E qual o *nome da sua empresa* (razão social ou nome fantasia)?',
      'AGUARDA_NOME',
    );
    return;
  }

  // 4) Nome da empresa → grava e encerra o bot, passando para um consultor.
  if (conversa.bot_estado === 'AGUARDA_NOME') {
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
