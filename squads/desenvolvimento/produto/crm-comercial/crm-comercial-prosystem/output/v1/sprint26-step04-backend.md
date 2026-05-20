# Sprint 26 — Step 04 — Felipe Santos (Backend Developer)
# Módulo de Agenda — Implementação Backend

---

## 1. Estrutura de arquivos

```
src/
  modules/
    agenda/
      agenda.routes.ts
      agenda.schema.ts
      agenda.service.ts
      google-auth.service.ts
      google-calendar.service.ts
  lib/
    crypto.ts          (conforme Tech Lead)
    google-calendar.ts (conforme Tech Lead)
    google-token.ts    (conforme Tech Lead)
```

---

## 2. agenda.schema.ts — Validação Zod

```typescript
import { z } from 'zod'

export const criarEventoSchema = z.object({
  titulo:          z.string().min(3).max(200),
  tipo:            z.enum(['REUNIAO','LIGACAO','VISITA','APRESENTACAO','FOLLOW_UP','DEMO','OUTRO']).default('REUNIAO'),
  status:          z.enum(['AGENDADO','CONFIRMADO','REALIZADO','CANCELADO','REAGENDADO','NAO_COMPARECEU']).default('AGENDADO'),
  dataInicio:      z.string().datetime(),
  dataFim:         z.string().datetime(),
  tipoLocal:       z.enum(['ONLINE','PRESENCIAL']).default('ONLINE'),
  descricao:       z.string().max(2000).optional(),
  convidados:      z.array(z.string().email()).default([]),
  lembreteMinutos: z.number().int().min(0).max(1440).default(30),
  leadId:          z.string().optional(),
  clienteBaseId:   z.string().optional(),
}).refine(d => d.leadId || d.clienteBaseId, {
  message: 'Informe leadId ou clienteBaseId',
}).refine(d => new Date(d.dataFim) > new Date(d.dataInicio), {
  message: 'dataFim deve ser posterior a dataInicio',
})

export const atualizarEventoSchema = criarEventoSchema.partial().omit({ leadId: true, clienteBaseId: true })

export const filtrosEventoSchema = z.object({
  inicio:     z.string().datetime().optional(),
  fim:        z.string().datetime().optional(),
  leadId:     z.string().optional(),
  status:     z.enum(['AGENDADO','CONFIRMADO','REALIZADO','CANCELADO','REAGENDADO','NAO_COMPARECEU']).optional(),
  tipo:       z.enum(['REUNIAO','LIGACAO','VISITA','APRESENTACAO','FOLLOW_UP','DEMO','OUTRO']).optional(),
  vendedorId: z.string().optional(), // apenas SUPERVISAO+
})
```

---

## 3. google-auth.service.ts — OAuth2 Flow

```typescript
import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../../lib/prisma'
import { encrypt } from '../../lib/crypto'
import { createOAuth2Client, getAuthUrl } from '../../lib/google-calendar'
import { OAuth2Client } from 'google-auth-library'

export async function iniciarOAuth(req: FastifyRequest, reply: FastifyReply) {
  const oauth2 = createOAuth2Client()
  const url    = getAuthUrl(oauth2)
  return reply.redirect(url)
}

export async function callbackOAuth(req: FastifyRequest<{ Querystring: { code: string } }>, reply: FastifyReply) {
  const { code } = req.query
  const userId   = (req as any).user.id

  const oauth2 = createOAuth2Client()
  const { tokens } = await oauth2.getToken(code)
  oauth2.setCredentials(tokens)

  // decodifica id_token para pegar e-mail do Google
  const ticket     = await oauth2.verifyIdToken({ idToken: tokens.id_token!, audience: process.env.GOOGLE_CLIENT_ID! })
  const payload    = ticket.getPayload()!
  const googleEmail = payload.email!

  await prisma.googleCalendarToken.upsert({
    where:  { userId },
    create: {
      userId,
      accessToken:  encrypt(tokens.access_token!),
      refreshToken: encrypt(tokens.refresh_token!),
      expiresAt:    new Date(tokens.expiry_date!),
      googleEmail,
      calendarId:   googleEmail,
    },
    update: {
      accessToken:  encrypt(tokens.access_token!),
      refreshToken: encrypt(tokens.refresh_token ?? (await _getStoredRefresh(userId))),
      expiresAt:    new Date(tokens.expiry_date!),
      googleEmail,
      calendarId:   googleEmail,
    },
  })

  return reply.redirect('/configuracoes?google=conectado')
}

async function _getStoredRefresh(userId: string): Promise<string> {
  // Google às vezes não retorna refresh_token no update — mantém o existente
  const rec = await prisma.googleCalendarToken.findUnique({ where: { userId } })
  return rec?.refreshToken ?? ''
}

export async function statusOAuth(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req as any).user.id
  const record = await prisma.googleCalendarToken.findUnique({ where: { userId } })
  if (!record) return reply.send({ conectado: false })
  return reply.send({
    conectado:  true,
    email:      record.googleEmail,
    calendarId: record.calendarId,
    desde:      record.createdAt,
  })
}

export async function desconectarOAuth(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req as any).user.id
  const record = await prisma.googleCalendarToken.findUnique({ where: { userId } })

  if (record) {
    try {
      // revoga token no Google
      const oauth2 = createOAuth2Client()
      oauth2.setCredentials({ access_token: decrypt(record.accessToken) })
      await oauth2.revokeCredentials()
    } catch {
      // ignora erro de revogação — remove localmente de qualquer forma
    }
    await prisma.googleCalendarToken.delete({ where: { userId } })
  }

  return reply.send({ desconectado: true })
}
```

---

## 4. google-calendar.service.ts — Operações no Calendar

```typescript
import { google } from 'googleapis'
import { v4 as uuidv4 } from 'uuid'
import { getAuthenticatedClient } from '../../lib/google-token'

export interface CriarEventoGoogleParams {
  titulo:          string
  descricao?:      string
  dataInicio:      Date
  dataFim:         Date
  tipoLocal:       'ONLINE' | 'PRESENCIAL'
  convidados:      string[]   // e-mails (inclui lead)
  lembreteMinutos: number
}

export interface GoogleEventResult {
  googleEventId: string
  hangoutLink:   string | null
  htmlLink:      string | null
}

export async function criarEventoNoGoogle(
  userId: string,
  params: CriarEventoGoogleParams
): Promise<GoogleEventResult> {
  const authClient = await getAuthenticatedClient(userId)
  const calendar   = google.calendar({ version: 'v3', auth: authClient })

  const attendees = params.convidados.map(email => ({ email }))

  const requestBody: any = {
    summary:     params.titulo,
    description: params.descricao,
    start:       { dateTime: params.dataInicio.toISOString(), timeZone: 'America/Sao_Paulo' },
    end:         { dateTime: params.dataFim.toISOString(),    timeZone: 'America/Sao_Paulo' },
    attendees,
    reminders: {
      useDefault: false,
      overrides:  [{ method: 'popup', minutes: params.lembreteMinutos }],
    },
  }

  if (params.tipoLocal === 'ONLINE') {
    requestBody.conferenceData = {
      createRequest: { requestId: uuidv4(), conferenceSolutionKey: { type: 'hangoutsMeet' } },
    }
  }

  const { data: event } = await calendar.events.insert({
    calendarId:             'primary',
    conferenceDataVersion:  params.tipoLocal === 'ONLINE' ? 1 : 0,
    sendUpdates:            'all', // envia convite por e-mail aos attendees
    requestBody,
  })

  return {
    googleEventId: event.id!,
    hangoutLink:   event.hangoutLink ?? null,
    htmlLink:      event.htmlLink   ?? null,
  }
}

export async function atualizarEventoNoGoogle(
  userId: string,
  googleEventId: string,
  params: Partial<CriarEventoGoogleParams>
): Promise<void> {
  const authClient = await getAuthenticatedClient(userId)
  const calendar   = google.calendar({ version: 'v3', auth: authClient })

  const patchBody: any = {}
  if (params.titulo)     patchBody.summary     = params.titulo
  if (params.descricao)  patchBody.description = params.descricao
  if (params.dataInicio) patchBody.start = { dateTime: params.dataInicio.toISOString(), timeZone: 'America/Sao_Paulo' }
  if (params.dataFim)    patchBody.end   = { dateTime: params.dataFim.toISOString(),    timeZone: 'America/Sao_Paulo' }
  if (params.convidados) patchBody.attendees = params.convidados.map(email => ({ email }))
  if (params.lembreteMinutos !== undefined) {
    patchBody.reminders = { useDefault: false, overrides: [{ method: 'popup', minutes: params.lembreteMinutos }] }
  }

  await calendar.events.patch({
    calendarId:   'primary',
    eventId:      googleEventId,
    sendUpdates:  'all',
    requestBody:  patchBody,
  })
}

export async function cancelarEventoNoGoogle(userId: string, googleEventId: string): Promise<void> {
  const authClient = await getAuthenticatedClient(userId)
  const calendar   = google.calendar({ version: 'v3', auth: authClient })

  await calendar.events.delete({
    calendarId:  'primary',
    eventId:     googleEventId,
    sendUpdates: 'all',
  })
}
```

---

## 5. agenda.service.ts — CRUD + HistoricoLead

```typescript
import { prisma }   from '../../lib/prisma'
import NodeCache    from 'node-cache'
import { criarEventoNoGoogle, atualizarEventoNoGoogle, cancelarEventoNoGoogle } from './google-calendar.service'
import { getAuthenticatedClient } from '../../lib/google-token'

const cache = new NodeCache({ stdTTL: 120 }) // 2 min

// ─── LISTAR ──────────────────────────────────────────────────────────────────

export async function listarEventos(userId: string, role: string, filtros: any) {
  // VENDEDOR só vê os próprios; SUPERVISAO+ pode filtrar por vendedorId
  const criadoPorId = (role === 'VENDEDOR') ? userId : (filtros.vendedorId ?? undefined)

  const cacheKey = `agenda:eventos:${criadoPorId ?? 'all'}:${filtros.inicio ?? ''}:${filtros.fim ?? ''}:${filtros.leadId ?? ''}:${filtros.status ?? ''}:${filtros.tipo ?? ''}`
  const cached   = cache.get(cacheKey)
  if (cached) return cached

  const where: any = {}
  if (criadoPorId)     where.criadoPorId = criadoPorId
  if (filtros.leadId)  where.leadId      = filtros.leadId
  if (filtros.status)  where.status      = filtros.status
  if (filtros.tipo)    where.tipo        = filtros.tipo
  if (filtros.inicio || filtros.fim) {
    where.dataInicio = {}
    if (filtros.inicio) where.dataInicio.gte = new Date(filtros.inicio)
    if (filtros.fim)    where.dataInicio.lte = new Date(filtros.fim)
  }

  const eventos = await prisma.agendaEvento.findMany({
    where,
    orderBy: { dataInicio: 'asc' },
    include: {
      lead:        { select: { id: true, nomeEmpresa: true, emailContato: true } },
      clienteBase: { select: { id: true, nomeEmpresa: true } },
      criadoPor:   { select: { id: true, nome: true } },
    },
  })

  cache.set(cacheKey, eventos)
  return eventos
}

// ─── CONTAGEM HOJE (badge sidebar) ────────────────────────────────────────────

export async function contarEventosHoje(userId: string) {
  const hoje     = new Date()
  const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0)
  const fimDia    = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59)

  const cacheKey = `agenda:badge:${userId}:${inicioDia.toISOString().split('T')[0]}`
  const cached   = cache.get<number>(cacheKey)
  if (cached !== undefined) return cached

  const count = await prisma.agendaEvento.count({
    where: {
      criadoPorId: userId,
      status:      { notIn: ['CANCELADO'] },
      dataInicio:  { gte: inicioDia, lte: fimDia },
    },
  })

  cache.set(cacheKey, count, 300) // 5 min
  return count
}

// ─── CRIAR ────────────────────────────────────────────────────────────────────

export async function criarEvento(userId: string, dados: any) {
  // busca e-mail do lead para incluir como attendee
  let leadEmail: string | null = null
  if (dados.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: dados.leadId }, select: { emailContato: true } })
    leadEmail  = lead?.emailEmail ?? null
  }

  const convidadosCompletos = leadEmail
    ? [leadEmail, ...dados.convidados.filter((e: string) => e !== leadEmail)]
    : dados.convidados

  // tenta criar no Google
  let googleData = { googleEventId: null as string | null, hangoutLink: null as string | null, htmlLink: null as string | null }
  let googleCreated = false

  try {
    googleData    = await criarEventoNoGoogle(userId, {
      titulo:          dados.titulo,
      descricao:       dados.descricao,
      dataInicio:      new Date(dados.dataInicio),
      dataFim:         new Date(dados.dataFim),
      tipoLocal:       dados.tipoLocal,
      convidados:      convidadosCompletos,
      lembreteMinutos: dados.lembreteMinutos,
    })
    googleCreated = true
  } catch (err: any) {
    if (err.message !== 'GOOGLE_NOT_CONNECTED') {
      // erro real da API — log mas não bloqueia
      console.error('[Agenda] Google Calendar error on create:', err.message)
    }
  }

  const evento = await prisma.agendaEvento.create({
    data: {
      titulo:          dados.titulo,
      tipo:            dados.tipo,
      status:          dados.status,
      dataInicio:      new Date(dados.dataInicio),
      dataFim:         new Date(dados.dataFim),
      tipoLocal:       dados.tipoLocal,
      descricao:       dados.descricao,
      convidados:      dados.convidados,
      lembreteMinutos: dados.lembreteMinutos,
      leadId:          dados.leadId,
      clienteBaseId:   dados.clienteBaseId,
      criadoPorId:     userId,
      ...googleData,
    },
    include: { lead: { select: { id: true, nomeEmpresa: true } }, criadoPor: { select: { nome: true } } },
  })

  // historico do lead
  if (dados.leadId) {
    const dataFormatada = new Date(dados.dataInicio).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    await prisma.historicoLead.create({
      data: {
        leadId:    dados.leadId,
        usuarioId: userId,
        tipo:      'reuniao_agendada',
        descricao: `📅 Reunião agendada — ${dados.titulo}\n${dataFormatada}${googleData.hangoutLink ? `\n🎥 ${googleData.hangoutLink}` : ''}`,
      },
    }).catch(() => {})
  }

  _invalidateCache(userId)
  return { evento, googleCreated }
}

// ─── ATUALIZAR ────────────────────────────────────────────────────────────────

export async function atualizarEvento(id: string, userId: string, role: string, dados: any) {
  const existente = await _verificarPermissao(id, userId, role)

  // campos alterados para histórico
  const alteracoes: string[] = []
  if (dados.dataInicio && dados.dataInicio !== existente.dataInicio.toISOString()) {
    alteracoes.push(`Horário início: ${_fmt(existente.dataInicio)} → ${_fmt(new Date(dados.dataInicio))}`)
  }
  if (dados.dataFim && dados.dataFim !== existente.dataFim.toISOString()) {
    alteracoes.push(`Horário fim: ${_fmt(existente.dataFim)} → ${_fmt(new Date(dados.dataFim))}`)
  }
  if (dados.status && dados.status !== existente.status) {
    alteracoes.push(`Status: ${existente.status} → ${dados.status}`)
  }

  // atualiza no Google
  if (existente.googleEventId) {
    try {
      await atualizarEventoNoGoogle(existente.criadoPorId, existente.googleEventId, {
        titulo:          dados.titulo,
        descricao:       dados.descricao,
        dataInicio:      dados.dataInicio ? new Date(dados.dataInicio) : undefined,
        dataFim:         dados.dataFim    ? new Date(dados.dataFim)    : undefined,
        convidados:      dados.convidados,
        lembreteMinutos: dados.lembreteMinutos,
      })
    } catch (err: any) {
      console.error('[Agenda] Google Calendar error on update:', err.message)
      // continua — atualiza localmente
    }
  }

  const atualizado = await prisma.agendaEvento.update({
    where: { id },
    data:  { ...dados, dataInicio: dados.dataInicio ? new Date(dados.dataInicio) : undefined, dataFim: dados.dataFim ? new Date(dados.dataFim) : undefined },
    include: { lead: { select: { id: true, nomeEmpresa: true } } },
  })

  // histórico
  if (existente.leadId && alteracoes.length > 0) {
    await prisma.historicoLead.create({
      data: {
        leadId:    existente.leadId,
        usuarioId: userId,
        tipo:      'reuniao_editada',
        descricao: `✏️ Reunião editada — ${existente.titulo}\n${alteracoes.join('\n')}`,
      },
    }).catch(() => {})
  }

  _invalidateCache(existente.criadoPorId)
  return atualizado
}

// ─── CANCELAR ─────────────────────────────────────────────────────────────────

export async function cancelarEvento(id: string, userId: string, role: string) {
  const existente = await _verificarPermissao(id, userId, role)

  // cancela no Google
  if (existente.googleEventId) {
    try {
      await cancelarEventoNoGoogle(existente.criadoPorId, existente.googleEventId)
    } catch (err: any) {
      console.error('[Agenda] Google Calendar error on delete:', err.message)
    }
  }

  await prisma.agendaEvento.update({
    where: { id },
    data:  { status: 'CANCELADO' },
  })

  // histórico
  if (existente.leadId) {
    await prisma.historicoLead.create({
      data: {
        leadId:    existente.leadId,
        usuarioId: userId,
        tipo:      'reuniao_cancelada',
        descricao: `❌ Reunião cancelada — ${existente.titulo}`,
      },
    }).catch(() => {})
  }

  _invalidateCache(existente.criadoPorId)
  return { cancelado: true }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function _verificarPermissao(id: string, userId: string, role: string) {
  const evento = await prisma.agendaEvento.findUnique({ where: { id } })
  if (!evento) throw { statusCode: 404, message: 'Evento não encontrado' }
  const podeEditar = evento.criadoPorId === userId || ['SUPERVISAO','CEO','ADMIN'].includes(role)
  if (!podeEditar) throw { statusCode: 403, message: 'Sem permissão para editar este evento' }
  return evento
}

function _invalidateCache(userId: string) {
  const keys = cache.keys().filter(k => k.startsWith(`agenda:eventos:${userId}`))
  cache.del(keys)
  const badgeKeys = cache.keys().filter(k => k.startsWith(`agenda:badge:${userId}`))
  cache.del(badgeKeys)
}

function _fmt(d: Date): string {
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
}
```

---

## 6. agenda.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { authenticate }   from '../../middleware/auth'
import { iniciarOAuth, callbackOAuth, statusOAuth, desconectarOAuth } from './google-auth.service'
import { listarEventos, contarEventosHoje, criarEvento, atualizarEvento, cancelarEvento } from './agenda.service'
import { criarEventoSchema, atualizarEventoSchema, filtrosEventoSchema } from './agenda.schema'

export async function agendaRoutes(app: FastifyInstance) {

  // ── Auth OAuth2 ──────────────────────────────────────────────────────────────
  app.get('/agenda/auth/google',                      { preHandler: [authenticate] }, iniciarOAuth)
  app.get('/agenda/auth/google/callback',             { preHandler: [authenticate] }, callbackOAuth)
  app.get('/agenda/auth/status',                      { preHandler: [authenticate] }, statusOAuth)
  app.delete('/agenda/auth/disconnect',               { preHandler: [authenticate] }, desconectarOAuth)

  // ── Eventos ──────────────────────────────────────────────────────────────────
  app.get('/agenda/eventos/hoje/count', { preHandler: [authenticate] }, async (req, reply) => {
    const userId = (req as any).user.id
    const count  = await contarEventosHoje(userId)
    return reply.send({ count })
  })

  app.get('/agenda/eventos', { preHandler: [authenticate] }, async (req, reply) => {
    const user    = (req as any).user
    const filtros = filtrosEventoSchema.parse(req.query)
    const eventos = await listarEventos(user.id, user.role, filtros)
    return reply.send(eventos)
  })

  app.get('/agenda/eventos/:id', { preHandler: [authenticate] }, async (req: any, reply) => {
    const { id } = req.params
    const user   = (req as any).user
    const evento = await prisma.agendaEvento.findUnique({
      where: { id },
      include: {
        lead:        { select: { id: true, nomeEmpresa: true, emailContato: true } },
        clienteBase: { select: { id: true, nomeEmpresa: true } },
        criadoPor:   { select: { id: true, nome: true } },
      },
    })
    if (!evento) return reply.status(404).send({ message: 'Evento não encontrado' })
    // VENDEDOR só pode ver os próprios
    if (user.role === 'VENDEDOR' && evento.criadoPorId !== user.id) {
      return reply.status(403).send({ message: 'Acesso negado' })
    }
    return reply.send(evento)
  })

  app.post('/agenda/eventos', { preHandler: [authenticate] }, async (req, reply) => {
    const user  = (req as any).user
    const dados = criarEventoSchema.parse(req.body)
    const result = await criarEvento(user.id, dados)
    return reply.status(201).send(result)
  })

  app.patch('/agenda/eventos/:id', { preHandler: [authenticate] }, async (req: any, reply) => {
    const user  = (req as any).user
    const dados = atualizarEventoSchema.parse(req.body)
    const result = await atualizarEvento(req.params.id, user.id, user.role, dados)
    return reply.send(result)
  })

  app.delete('/agenda/eventos/:id', { preHandler: [authenticate] }, async (req: any, reply) => {
    const user   = (req as any).user
    const result = await cancelarEvento(req.params.id, user.id, user.role)
    return reply.send(result)
  })
}
```

---

## 7. Tipos no HistoricoLead — extensão do enum

```typescript
// Os tipos abaixo são adicionados ao enum TipoHistorico existente:
// reuniao_agendada
// reuniao_editada
// reuniao_cancelada
```

```sql
-- Migration manual (se enum já existir no banco):
ALTER TYPE "TipoHistorico" ADD VALUE IF NOT EXISTS 'reuniao_agendada';
ALTER TYPE "TipoHistorico" ADD VALUE IF NOT EXISTS 'reuniao_editada';
ALTER TYPE "TipoHistorico" ADD VALUE IF NOT EXISTS 'reuniao_cancelada';
```

---

## 8. Registro da rota no servidor

```typescript
// src/server.ts — adicionar:
import { agendaRoutes } from './modules/agenda/agenda.routes'

app.register(agendaRoutes)
```

---

## Sprint 26 — STEP 04 PRONTO ✅
