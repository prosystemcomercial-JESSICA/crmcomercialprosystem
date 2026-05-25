import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const STATUS = ['PENDENTE', 'CONFIRMADA', 'REALIZADA', 'CANCELADA', 'REMARCADA', 'CLIENTE_NAO_COMPARECEU', 'AGUARDANDO_RETORNO'] as const;
const TIPOS = ['LIGACAO', 'EMAIL', 'REUNIAO', 'WHATSAPP', 'VISITA', 'TAREFA', 'OUTRO'] as const;

const CreateAtividadeSchema = z.object({
  lead_id: z.string().min(1),
  tipo: z.enum(TIPOS),
  titulo: z.string().min(1),
  descricao: z.string().optional(),
  resumo_reuniao: z.string().optional(),
  responsavel_id: z.string().optional(),
  data_prevista: z.string().datetime().optional(),
  google_meet_link: z.string().optional()
});

const UpdateAtividadeSchema = z.object({
  titulo: z.string().optional(),
  descricao: z.string().optional(),
  resumo_reuniao: z.string().optional(),
  status: z.enum(STATUS).optional(),
  resultado: z.string().optional(),
  data_prevista: z.string().datetime().optional(),
  data_realizada: z.string().datetime().optional(),
  responsavel_id: z.string().optional(),
  google_meet_link: z.string().optional()
});

const ListAtividadeSchema = z.object({
  page: z.coerce.number().default(0),
  limit: z.coerce.number().default(50),
  status: z.string().optional(),
  tipo: z.string().optional(),
  responsavel_id: z.string().optional(),
  lead_id: z.string().optional()
});

const ConcluirSchema = z.object({
  resultado: z.string().min(1),
  duracao_minutos: z.number().optional(),
  data_realizada: z.string().datetime().optional()
});

const CancelarSchema = z.object({
  motivo_cancelamento: z.string().min(1)
});

const ReagendarSchema = z.object({
  nova_data_remarcada: z.string().datetime(),
  motivo: z.string().optional()
});

const RelatorioSchema = z.object({
  data_inicio: z.string().datetime().optional(),
  data_fim: z.string().datetime().optional(),
  responsavel_id: z.string().optional(),
  status: z.string().optional(),
  tipo: z.string().optional(),
  lead_id: z.string().optional()
});

export async function atividadesRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // List all atividades
  fastify.get('/atividades', async (request, reply) => {
    const query = ListAtividadeSchema.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ status: 'error', message: 'Invalid query' });
    const { page, limit, status, tipo, responsavel_id, lead_id } = query.data;

    const where: any = {};
    if (status) where.status = status;
    if (tipo) where.tipo = tipo;
    if (responsavel_id) where.responsavel_id = responsavel_id;
    if (lead_id) where.lead_id = lead_id;

    const [atividades, total] = await Promise.all([
      prisma.atividade.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: [{ data_prevista: 'asc' }, { created_at: 'desc' }],
        include: {
          lead: { select: { id: true, nome: true, empresa: true, email: true, telefone: true } }
        }
      }),
      prisma.atividade.count({ where })
    ]);

    return reply.send({ status: 'success', data: { atividades, total, page, limit } });
  });

  // Get single atividade
  fastify.get('/atividades/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const atividade = await prisma.atividade.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, nome: true, empresa: true, email: true, telefone: true } }
      }
    });
    if (!atividade) return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
    return reply.send({ status: 'success', data: atividade });
  });

  // Create atividade
  fastify.post('/atividades', async (request, reply) => {
    const body = CreateAtividadeSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    const user = (request as any).user;
    const data: any = { ...body.data, created_by: user?.id || 'system' };
    if (data.data_prevista) data.data_prevista = new Date(data.data_prevista);

    const atividade = await prisma.atividade.create({
      data,
      include: { lead: { select: { id: true, nome: true, empresa: true, email: true, telefone: true } } }
    });
    return reply.status(201).send({ status: 'success', data: atividade });
  });

  // Update atividade
  fastify.patch('/atividades/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateAtividadeSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    try {
      const data: any = { ...body.data };
      if (data.data_prevista) data.data_prevista = new Date(data.data_prevista);
      if (data.data_realizada) data.data_realizada = new Date(data.data_realizada);
      const atividade = await prisma.atividade.update({ where: { id }, data });
      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // Delete atividade
  fastify.delete('/atividades/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.atividade.delete({ where: { id } });
      return reply.send({ status: 'success', message: 'Atividade removida' });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // ── Status Transitions ────────────────────────────────

  // Concluir atividade
  fastify.post('/atividades/:id/concluir', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ConcluirSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    try {
      const data: any = {
        status: 'REALIZADA',
        resultado: body.data.resultado,
        data_realizada: body.data.data_realizada ? new Date(body.data.data_realizada) : new Date()
      };
      if (body.data.duracao_minutos !== undefined) data.duracao_minutos = body.data.duracao_minutos;

      const atividade = await prisma.atividade.update({ where: { id }, data });
      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // Cancelar atividade
  fastify.post('/atividades/:id/cancelar', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = CancelarSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Motivo obrigatório' });

    try {
      const atividade = await prisma.atividade.update({
        where: { id },
        data: { status: 'CANCELADA', motivo_cancelamento: body.data.motivo_cancelamento }
      });
      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // Remarcar atividade
  fastify.post('/atividades/:id/remarcar', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ReagendarSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Nova data obrigatória' });

    try {
      const novaData = new Date(body.data.nova_data_remarcada);
      const atividade = await prisma.atividade.update({
        where: { id },
        data: {
          status: 'REMARCADA',
          nova_data_remarcada: novaData,
          data_prevista: novaData,
          resultado: body.data.motivo ? `Remarcado: ${body.data.motivo}` : undefined
        }
      });
      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // Confirmar reunião
  fastify.post('/atividades/:id/confirmar', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const atividade = await prisma.atividade.update({
        where: { id },
        data: { status: 'CONFIRMADA' }
      });
      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // ── Relatório ─────────────────────────────────────────

  fastify.get('/atividades/relatorio', async (request, reply) => {
    const query = RelatorioSchema.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ status: 'error', message: 'Parâmetros inválidos' });

    const where: any = {};
    if (query.data.data_inicio || query.data.data_fim) {
      where.data_prevista = {};
      if (query.data.data_inicio) where.data_prevista.gte = new Date(query.data.data_inicio);
      if (query.data.data_fim) where.data_prevista.lte = new Date(query.data.data_fim);
    }
    if (query.data.responsavel_id) where.responsavel_id = query.data.responsavel_id;
    if (query.data.status) where.status = query.data.status;
    if (query.data.tipo) where.tipo = query.data.tipo;
    if (query.data.lead_id) where.lead_id = query.data.lead_id;

    const [atividades, totalPorStatus, totalPorTipo] = await Promise.all([
      prisma.atividade.findMany({
        where,
        orderBy: { data_prevista: 'desc' },
        include: {
          lead: { select: { id: true, nome: true, empresa: true } }
        }
      }),
      prisma.atividade.groupBy({ by: ['status'], where, _count: { id: true } }),
      prisma.atividade.groupBy({ by: ['tipo'], where, _count: { id: true } })
    ]);

    const reunioes = atividades.filter(a => a.tipo === 'REUNIAO');
    const totalDuracaoMin = reunioes.reduce((acc, r) => acc + (r.duracao_minutos || 0), 0);

    return reply.send({
      status: 'success',
      data: {
        atividades,
        total: atividades.length,
        por_status: totalPorStatus.reduce((acc: any, s) => { acc[s.status] = s._count.id; return acc; }, {}),
        por_tipo: totalPorTipo.reduce((acc: any, t) => { acc[t.tipo] = t._count.id; return acc; }, {}),
        reunioes_total: reunioes.length,
        reunioes_realizadas: reunioes.filter(r => r.status === 'REALIZADA').length,
        reunioes_canceladas: reunioes.filter(r => r.status === 'CANCELADA').length,
        reunioes_remarcadas: reunioes.filter(r => r.status === 'REMARCADA').length,
        duracao_total_horas: Math.round(totalDuracaoMin / 60 * 10) / 10
      }
    });
  });

  // ── Agenda semanal ────────────────────────────────────

  fastify.get('/atividades/agenda', async (request, reply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const atividades = await prisma.atividade.findMany({
      where: {
        status: { in: ['PENDENTE', 'CONFIRMADA'] },
        data_prevista: { gte: today, lte: nextWeek }
      },
      orderBy: { data_prevista: 'asc' },
      include: {
        lead: { select: { id: true, nome: true, empresa: true, email: true, telefone: true } }
      }
    });

    return reply.send({ status: 'success', data: atividades });
  });

  // ── Google Calendar helpers ───────────────────────────

  async function getValidToken(userId: string): Promise<{ access_token: string } | null> {
    // Try by real userId, then by 'default' as fallback (OAuth callback stores without JWT)
    let token = await prisma.calendarToken.findUnique({ where: { user_id: userId } });
    if (!token) token = await prisma.calendarToken.findUnique({ where: { user_id: 'default' } });
    if (!token) return null;

    const isExpired = Number(token.expiry_date) < Date.now() + 60_000;
    if (!isExpired) return token;

    if (!token.refresh_token) return null;

    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: token.refresh_token,
          grant_type: 'refresh_token'
        }).toString()
      });

      const data = await res.json() as any;
      if (!data.access_token) return null;

      const updated = await prisma.calendarToken.update({
        where: { user_id: token.user_id },
        data: {
          access_token: data.access_token,
          expiry_date: BigInt(Date.now() + (data.expires_in || 3600) * 1000)
        }
      });
      return updated;
    } catch {
      return null;
    }
  }

  // ── Google Calendar OAuth ─────────────────────────────

  fastify.get('/agenda/google/auth', async (request, reply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/agenda/google/callback';

    if (!clientId) {
      return reply.status(503).send({
        status: 'error',
        message: 'Google Calendar não configurado. Adicione GOOGLE_CLIENT_ID no .env'
      });
    }

    const user = (request as any).user;
    const state = user?.id || 'default';

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ].join(' ');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `access_type=offline&prompt=consent&` +
      `state=${encodeURIComponent(state)}`;

    return reply.send({ status: 'success', data: { auth_url: authUrl } });
  });

  fastify.get('/agenda/google/callback', async (request, reply) => {
    const { code, error, state } = request.query as { code?: string; error?: string; state?: string };
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (error || !code) {
      return reply.redirect(`${frontendUrl}/agenda?google_error=acesso_negado`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/agenda/google/callback';

    // userId was passed in state during auth URL generation
    const userId = state || 'default';

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        }).toString()
      });

      const tokenData = await tokenRes.json() as any;
      fastify.log.info('Google token response: ' + JSON.stringify({ has_access: !!tokenData.access_token, has_refresh: !!tokenData.refresh_token }));

      if (!tokenData.access_token) {
        fastify.log.error('Google token error: ' + JSON.stringify(tokenData));
        return reply.redirect(`${frontendUrl}/agenda?google_error=token_invalido`);
      }

      await prisma.calendarToken.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || '',
          expiry_date: BigInt(Date.now() + (tokenData.expires_in || 3600) * 1000)
        },
        update: {
          access_token: tokenData.access_token,
          ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}),
          expiry_date: BigInt(Date.now() + (tokenData.expires_in || 3600) * 1000)
        }
      });

      fastify.log.info(`Google Calendar token saved for userId: ${userId}`);
      return reply.redirect(`${frontendUrl}/agenda?google_connected=1`);
    } catch (err) {
      fastify.log.error(err);
      return reply.redirect(`${frontendUrl}/agenda?google_error=erro_interno`);
    }
  });

  fastify.get('/agenda/google/status', async (request, reply) => {
    const user = (request as any).user;
    const userId = user?.id || 'default';
    const token = await getValidToken(userId);
    return reply.send({ status: 'success', data: { connected: !!token } });
  });

  // Cliente não compareceu
  fastify.post('/atividades/:id/nao-compareceu', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ observacao: z.string().optional() }).safeParse(request.body);
    try {
      const atividade = await prisma.atividade.update({
        where: { id },
        data: {
          status: 'CLIENTE_NAO_COMPARECEU',
          resultado: (body.success && body.data.observacao) ? body.data.observacao : 'Cliente não compareceu à reunião.',
          data_realizada: new Date()
        }
      });
      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // Aguardar retorno
  fastify.post('/atividades/:id/aguardar-retorno', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ observacao: z.string().optional() }).safeParse(request.body);
    try {
      const atividade = await prisma.atividade.update({
        where: { id },
        data: {
          status: 'AGUARDANDO_RETORNO',
          resultado: (body.success && body.data.observacao) ? body.data.observacao : 'Aguardando retorno do cliente.'
        }
      });
      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });

  // Create Google Meet link for an existing atividade
  fastify.post('/atividades/:id/criar-meet', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    const userId = user?.id || 'default';

    const atividade = await prisma.atividade.findUnique({
      where: { id },
      include: { lead: { select: { nome: true, email: true } } }
    });

    if (!atividade) return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
    if (atividade.tipo !== 'REUNIAO') return reply.status(400).send({ status: 'error', message: 'Apenas reuniões podem ter link Meet' });

    const startTime = atividade.data_prevista || new Date();
    const endTime = new Date(startTime.getTime() + (atividade.duracao_minutos || 60) * 60 * 1000);

    // 1) Tentar N8N primeiro
    let meetLink = await callN8nMeet({
      titulo: atividade.titulo,
      data_prevista: startTime.toISOString(),
      fim: endTime.toISOString(),
      lead_email: atividade.lead?.email || undefined
    });

    let eventId = '';

    // 2) Fallback: Google Calendar direto
    if (!meetLink) {
      const calToken = await getValidToken(userId);
      if (!calToken) {
        return reply.status(403).send({ status: 'error', message: 'Google Calendar não conectado e N8N não disponível.', need_auth: true });
      }
      try {
        const result = await callGoogleMeetDirect({
          titulo: atividade.titulo,
          startTime, endTime,
          lead_email: atividade.lead?.email || undefined,
          token: calToken.access_token
        });
        if (result.error) {
          return reply.status(502).send({ status: 'error', message: 'Erro ao criar evento no Google Calendar', details: result.error });
        }
        meetLink = result.meetLink;
        eventId = result.eventId;
      } catch (err) {
        fastify.log.error(err);
        throw err;
      }
    }

    const updated = await prisma.atividade.update({
      where: { id },
      data: { google_meet_link: meetLink, ...(eventId ? { google_event_id: eventId } : {}) }
    });

    return reply.send({ status: 'success', data: { atividade: updated, meet_link: meetLink, event_id: eventId } });
  });

  // ── N8N helper — tenta gerar Meet via webhook N8N ────────
  async function callN8nMeet(params: {
    titulo: string;
    data_prevista: string;
    fim: string;
    lead_email?: string;
  }): Promise<string | null> {
    const n8nUrl = process.env.N8N_CRIAR_MEET_WEBHOOK;
    if (!n8nUrl) return null;

    try {
      const res = await fetch(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.N8N_WEBHOOK_SECRET ? { 'x-webhook-token': process.env.N8N_WEBHOOK_SECRET } : {})
        },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(20000)
      });

      if (!res.ok) {
        fastify.log.warn(`N8N webhook responded ${res.status}`);
        return null;
      }

      const data = await res.json() as any;
      const link = data.meet_link || data.data?.meet_link || '';
      fastify.log.info(`N8N Meet link: ${link}`);
      return link || null;
    } catch (err) {
      fastify.log.warn('N8N webhook call failed: ' + err);
      return null;
    }
  }

  // ── Helper — gera Meet via Google Calendar direto (fallback) ─
  async function callGoogleMeetDirect(params: {
    titulo: string;
    startTime: Date;
    endTime: Date;
    lead_email?: string;
    token: string;
  }): Promise<{ meetLink: string; eventId: string; error?: string }> {
    const reqId = `crm-${Date.now()}`;

    const buildPayload = (confType: string) => ({
      summary: params.titulo || 'Reunião ProSystem',
      start: { dateTime: params.startTime.toISOString(), timeZone: 'America/Sao_Paulo' },
      end:   { dateTime: params.endTime.toISOString(),   timeZone: 'America/Sao_Paulo' },
      conferenceData: {
        createRequest: { requestId: reqId, conferenceSolutionKey: { type: confType } }
      },
      ...(params.lead_email ? { attendees: [{ email: params.lead_email }] } : {})
    });

    const postEv = (pl: any) =>
      fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
        method: 'POST',
        headers: { Authorization: `Bearer ${params.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(pl)
      });

    let res = await postEv(buildPayload('hangoutsMeet'));
    let eventData = await res.json() as any;

    if (!res.ok) {
      fastify.log.warn('hangoutsMeet failed: ' + JSON.stringify(eventData?.error));
      res = await postEv(buildPayload('eventHangout'));
      eventData = await res.json() as any;
    }

    if (!res.ok) {
      return { meetLink: '', eventId: '', error: eventData?.error?.message || JSON.stringify(eventData?.error) };
    }

    const meetLink =
      eventData.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri ||
      eventData.hangoutLink || '';

    return { meetLink, eventId: eventData.id || '' };
  }

  // Generate Meet link from form data (before saving atividade)
  fastify.post('/agenda/criar-meet-temp', async (request, reply) => {
    const body = z.object({
      titulo: z.string().min(1),
      data_prevista: z.string().datetime().optional(),
      duracao_minutos: z.number().optional(),
      lead_email: z.string().optional()
    }).safeParse(request.body);

    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });

    const startTime = body.data.data_prevista ? new Date(body.data.data_prevista) : new Date();
    const durMin = body.data.duracao_minutos || 60;
    const endTime = new Date(startTime.getTime() + durMin * 60 * 1000);

    // 1) Tentar N8N primeiro
    const n8nLink = await callN8nMeet({
      titulo: body.data.titulo,
      data_prevista: startTime.toISOString(),
      fim: endTime.toISOString(),
      lead_email: body.data.lead_email
    });

    if (n8nLink) {
      return reply.send({ status: 'success', data: { meet_link: n8nLink, via: 'n8n' } });
    }

    // 2) Fallback: Google Calendar direto (requer token salvo no CRM)
    const user = (request as any).user;
    const userId = user?.id || 'default';
    const calToken = await getValidToken(userId);

    if (!calToken) {
      return reply.status(503).send({
        status: 'error',
        message: process.env.N8N_CRIAR_MEET_WEBHOOK
          ? 'N8N não respondeu e o Google Calendar não está conectado no CRM. Verifique o fluxo N8N ou clique em "Conectar Google".'
          : 'Configure N8N_CRIAR_MEET_WEBHOOK no .env ou conecte o Google Calendar.',
        need_auth: true
      });
    }

    try {
      const { meetLink, eventId, error } = await callGoogleMeetDirect({
        titulo: body.data.titulo,
        startTime, endTime,
        lead_email: body.data.lead_email,
        token: calToken.access_token
      });

      if (error) {
        return reply.status(502).send({ status: 'error', message: 'Erro ao criar evento no Google Calendar', details: error });
      }

      return reply.send({ status: 'success', data: { meet_link: meetLink, eventId, via: 'google_direct' } });
    } catch (err) {
      fastify.log.error(err);
      throw err;
    }
  });
}
