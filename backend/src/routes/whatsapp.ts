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

  // ===== CONVERSAS =====

  // Lista conversas (escopadas ao dono; gestão vê todas), ordenadas por atividade.
  fastify.get('/whatsapp/conversas', async (request, reply) => {
    const conversas = await prisma.whatsappConversa.findMany({
      where: { ...escopoDono(request) },
      orderBy: { ultima_em: 'desc' },
      take: 100,
      include: { instancia: { select: { dono_nome: true, numero: true } } },
    });
    return reply.send({ status: 'success', data: conversas });
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
        const contato_numero = remoteJid.split('@')[0];
        if (!contato_numero) return;
        const externo_id = data?.key?.id;
        const contato_nome = data?.pushName || null;
        const texto =
          data?.message?.conversation ||
          data?.message?.extendedTextMessage?.text ||
          '[mídia recebida]';

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
            tipo: 'TEXTO',
            conteudo: texto,
            status: 'ENTREGUE',
          },
        });
        console.log(`[WPP] Msg recebida de ${contato_numero} (instância ${instanciaNome})`);
      }
    } catch (err: any) {
      console.error('[WPP] Erro no webhook:', err?.message);
    }
  });
}
