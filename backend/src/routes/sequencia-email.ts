import { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import { entrarNaSequencia, pausarSequencia } from '@/services/sequencia-email.service';
import { requireGestor } from '@/lib/scope';

// Tolerância de relógio recomendada pela Svix (biblioteca usada pelo Resend) — evita replay de payloads antigos.
const SVIX_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

/** Valida a assinatura HMAC (formato Svix) que o Resend envia em todo webhook. */
function verificarAssinaturaResend(rawBody: Buffer, headers: FastifyRequest['headers'], secret: string): boolean {
  const svixId = headers['svix-id'];
  const svixTimestamp = headers['svix-timestamp'];
  const svixSignature = headers['svix-signature'];
  if (typeof svixId !== 'string' || typeof svixTimestamp !== 'string' || typeof svixSignature !== 'string') {
    return false;
  }

  const timestampSeconds = Number(svixTimestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > SVIX_TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  const secretBytes = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody.toString('utf8')}`;
  const expectedSignature = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');
  const expectedBuffer = Buffer.from(expectedSignature, 'base64');

  return svixSignature.split(' ').some((entry) => {
    const [version, value] = entry.split(',');
    if (version !== 'v1' || !value) return false;
    const candidate = Buffer.from(value, 'base64');
    return candidate.length === expectedBuffer.length && crypto.timingSafeEqual(candidate, expectedBuffer);
  });
}

export async function sequenciaEmailRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Escopo deste plugin apenas (encapsulamento do Fastify): preserva o corpo cru
  // em bytes para permitir a validação de assinatura do webhook do Resend abaixo,
  // sem afetar o parser JSON global usado pelas outras rotas do sistema.
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (request, body, done) => {
    (request as any).rawBody = body;
    if (!body || (body as Buffer).length === 0) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse((body as Buffer).toString('utf8')));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Lista as sequências disponíveis (hoje só Padarias, mas já preparado p/ mais).
  fastify.get('/sequencias-email', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const sequencias = await prisma.sequenciaEmail.findMany({
      include: { _count: { select: { leads: true } } },
    });
    return reply.send({ status: 'success', data: sequencias });
  });

  // Insere 1 lead na sequência — usado pelo pop-up de opt-in (criar/editar lead).
  // Sem requireGestor de propósito: qualquer usuário autenticado que cria/edita
  // um lead pode optar por incluí-lo na campanha (decisão de produto), não só gestor.
  fastify.post('/sequencias-email/:sequenciaId/leads/:leadId/entrar', async (request, reply) => {
    const { sequenciaId, leadId } = request.params as { sequenciaId: string; leadId: string };
    const user = (request as any).user;

    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, email: true, responsavel_email: true } });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });
    if (!lead.email && !lead.responsavel_email) {
      return reply.status(400).send({ status: 'error', message: 'Lead sem e-mail cadastrado — não é possível incluir na campanha' });
    }

    const vinculo = await entrarNaSequencia(prisma, { sequenciaId, leadId, userId: user?.id || 'system' });
    return reply.status(201).send({ status: 'success', data: vinculo });
  });

  // Lote: candidatos Padaria ainda sem decisão tomada (nem na sequência, nem descadastrados)
  // — alimenta a tela de revisão retroativa (Task 8).
  fastify.get('/sequencias-email/:sequenciaId/candidatos', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { sequenciaId } = request.params as { sequenciaId: string };

    const sequencia = await prisma.sequenciaEmail.findUnique({ where: { id: sequenciaId } });
    if (!sequencia) return reply.status(404).send({ status: 'error', message: 'Sequência não encontrada' });

    const jaDecididos = await prisma.leadSequenciaEmail.findMany({
      where: { sequencia_id: sequenciaId },
      select: { lead_id: true },
    });
    const idsExcluir = jaDecididos.map(d => d.lead_id);

    const candidatos = await prisma.lead.findMany({
      where: {
        segmento: sequencia.segmento,
        deleted_at: null,
        id: { notIn: idsExcluir.length ? idsExcluir : ['__nenhum__'] },
        OR: [{ email: { not: null } }, { responsavel_email: { not: null } }],
      },
      select: { id: true, nome: true, razao_social: true, email: true, responsavel_email: true, vendedor_nome: true, created_at: true },
      orderBy: { created_at: 'desc' },
    });
    return reply.send({ status: 'success', data: candidatos });
  });

  // Entrada em lote (revisão retroativa) — recebe os IDs escolhidos na tela.
  fastify.post('/sequencias-email/:sequenciaId/entrar-lote', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { sequenciaId } = request.params as { sequenciaId: string };
    const body = z.object({ leadIds: z.array(z.string()).min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe leadIds' });

    const user = (request as any).user;
    let inseridos = 0;
    for (const leadId of body.data.leadIds) {
      await entrarNaSequencia(prisma, { sequenciaId, leadId, userId: user?.id || 'system' })
        .then(() => { inseridos++; })
        .catch(() => {});
    }
    return reply.send({ status: 'success', data: { inseridos } });
  });

  // Kanban dedicado — leads agrupados por fase.
  fastify.get('/sequencias-email/:sequenciaId/kanban', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { sequenciaId } = request.params as { sequenciaId: string };
    const leads = await prisma.leadSequenciaEmail.findMany({
      where: { sequencia_id: sequenciaId },
      include: {
        lead: { select: { id: true, nome: true, razao_social: true, nome_fantasia: true, email: true, responsavel_nome: true, responsavel_telefone: true, vendedor_nome: true } },
      },
      orderBy: { updated_at: 'desc' },
    });

    const FASES = ['BASE_VALIDADA', 'NUTRICAO_1', 'NUTRICAO_2', 'NUTRICAO_3', 'NUTRICAO_4', 'ENGAJOU_QUALIFICAR', 'APRESENTACAO_AGENDADA', 'APRESENTACAO_REALIZADA', 'PROPOSTA_NEGOCIACAO', 'CONTRATO_ASSINADO', 'LONGO_PRAZO', 'DESCADASTRADO'];
    const grouped: Record<string, typeof leads> = {};
    for (const f of FASES) grouped[f] = [];
    for (const l of leads) (grouped[l.fase_kanban] ||= []).push(l);

    return reply.send({ status: 'success', data: { fases: FASES, leads: grouped } });
  });

  // Mover manualmente de fase (ex.: marcar "engajou" por resposta/WhatsApp percebido manualmente).
  fastify.patch('/sequencias-email/leads/:leadSequenciaId/fase', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { leadSequenciaId } = request.params as { leadSequenciaId: string };
    const body = z.object({
      fase_kanban: z.string(),
      motivo: z.string().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe fase_kanban' });

    // Mover para ENGAJOU_QUALIFICAR manualmente também pausa a sequência
    // (resposta por e-mail ou WhatsApp — não detectável automaticamente).
    if (body.data.fase_kanban === 'ENGAJOU_QUALIFICAR') {
      const atualizado = await pausarSequencia(prisma, leadSequenciaId, body.data.motivo || 'Engajamento manual (resposta/WhatsApp)');
      return reply.send({ status: 'success', data: atualizado });
    }

    const atualizado = await prisma.leadSequenciaEmail.update({
      where: { id: leadSequenciaId },
      data: { fase_kanban: body.data.fase_kanban },
    });
    return reply.send({ status: 'success', data: atualizado });
  });

  // Descadastro (link do e-mail — rota pública, sem auth).
  fastify.get('/sequencias-email/descadastro/:leadSequenciaId', async (request, reply) => {
    const { leadSequenciaId } = request.params as { leadSequenciaId: string };
    await prisma.leadSequenciaEmail.update({
      where: { id: leadSequenciaId },
      data: { pausada: true, motivo_pausa: 'Descadastro', fase_kanban: 'DESCADASTRADO', descadastrou_em: new Date(), proximo_envio_em: null },
    }).catch(() => {});
    return reply.type('text/html').send('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Você foi removido desta campanha.</h2><p>Não enviaremos mais e-mails desta sequência.</p></body></html>');
  });

  // Webhook do Resend — evento "email.clicked" pausa a sequência automaticamente.
  //
  // Ação manual pendente (não é código): após o deploy desta rota em produção, configurar
  // no painel do Resend (resend.com/webhooks) um endpoint apontando para
  // https://crmcomercialprosystem-production-945e.up.railway.app/webhooks/resend,
  // escutando o evento "email.clicked", e definir RESEND_WEBHOOK_SECRET (valor "Signing Secret"
  // mostrado pelo Resend ao criar o endpoint) nas variáveis de ambiente do backend.
  fastify.post('/webhooks/resend', async (request, reply) => {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      fastify.log.error('RESEND_WEBHOOK_SECRET não configurado — recusando webhook do Resend');
      return reply.status(500).send({ status: 'error', message: 'Webhook não configurado' });
    }

    const rawBody = (request as any).rawBody as Buffer | undefined;
    if (!rawBody || !verificarAssinaturaResend(rawBody, request.headers, webhookSecret)) {
      return reply.status(400).send({ status: 'error', message: 'Assinatura inválida' });
    }

    const body = request.body as any;
    if (body?.type !== 'email.clicked') return reply.send({ status: 'ignored' });

    const messageId = body?.data?.email_id;
    const clickedUrl = body?.data?.click?.link;
    if (!messageId) return reply.send({ status: 'ignored' });

    const disparo = await prisma.leadSequenciaEmailDisparo.findFirst({
      where: { message_id: messageId },
      include: { lead_sequencia: true, etapa: true },
    });
    if (!disparo) return reply.send({ status: 'ignored' }); // não é um e-mail desta sequência

    await prisma.leadSequenciaEmailDisparo.update({
      where: { id: disparo.id },
      data: { link_clicado: true, clicked_at: new Date(), clicked_url: clickedUrl },
    });

    // Clique no link de descadastro não é engajamento comercial — a rota
    // /sequencias-email/descadastro/:id já cuida de marcar DESCADASTRADO
    // quando o link é de fato visitado. Aqui só registramos o clique acima
    // (analytics) e não tocamos em fase_kanban/pausada.
    const isCliqueDescadastro = typeof clickedUrl === 'string' && clickedUrl.includes('/sequencias-email/descadastro/');

    // Nunca re-engajar um lead que já se descadastrou (evita clique fora de
    // ordem reabrindo um lead já marcado DESCADASTRADO).
    const jaDescadastrado = disparo.lead_sequencia.fase_kanban === 'DESCADASTRADO';

    if (!isCliqueDescadastro && !jaDescadastrado && !disparo.lead_sequencia.pausada) {
      await pausarSequencia(prisma, disparo.lead_sequencia.id, 'Clique no CTA');
      await prisma.leadSequenciaEmail.update({
        where: { id: disparo.lead_sequencia.id },
        data: { tema_interesse: disparo.etapa.tema },
      });
    }

    return reply.send({ status: 'ok' });
  });
}
