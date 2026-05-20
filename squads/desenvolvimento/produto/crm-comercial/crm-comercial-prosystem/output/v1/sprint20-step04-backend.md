# Sprint 20 — Step 04 — Felipe Santos (Backend)
# Inbound WhatsApp — Implementação API

## src/lib/sse-hub.ts

```typescript
const conexoes = new Map<string, Set<(data: string) => void>>()

export const sseHub = {
  registrar(userId: string, send: (data: string) => void) {
    if (!conexoes.has(userId)) conexoes.set(userId, new Set())
    conexoes.get(userId)!.add(send)
  },
  remover(userId: string, send: (data: string) => void) {
    conexoes.get(userId)?.delete(send)
  },
  notificarUsuario(userId: string, evento: object) {
    const data = `data: ${JSON.stringify(evento)}\n\n`
    conexoes.get(userId)?.forEach((send) => send(data))
  },
  notificarTodos(evento: object) {
    const data = `data: ${JSON.stringify(evento)}\n\n`
    conexoes.forEach((senders) => senders.forEach((send) => send(data)))
  },
  totalConexoes() {
    let total = 0
    conexoes.forEach((s) => (total += s.size))
    return total
  },
}
```

## src/lib/whatsapp-utils.ts

```typescript
import { createHmac } from 'crypto'

export function normalizarTelefone(phone: string): string {
  let num = phone.replace(/[^\d+]/g, '')
  if (!num.startsWith('+')) num = '+' + num
  return num
}

export function verificarAssinaturaMeta(
  rawBody: Buffer,
  signature: string | undefined,
  appSecret: string
): boolean {
  if (!signature) return false
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')
  return signature === expected
}

export function dentroJanela24h(ultimaRecebida: Date | null): boolean {
  if (!ultimaRecebida) return false
  return Date.now() - ultimaRecebida.getTime() < 24 * 60 * 60 * 1000
}
```

## src/modules/whatsapp/whatsapp.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import { normalizarTelefone } from '../../lib/whatsapp-utils'
import { sseHub } from '../../lib/sse-hub'
import { registrarHistorico } from '../../lib/historico'
import { enviarWhatsApp } from '../../lib/whatsapp'
import { getConfigValor } from '../integracao/config.service'

// Processa mensagem recebida do webhook Meta
export async function processarMensagemInbound(
  payload: any,
  prisma: PrismaClient
) {
  const entry = payload.entry?.[0]
  const changes = entry?.changes?.[0]
  const value = changes?.value

  // Ignorar eventos que não são mensagens (status updates, etc.)
  if (!value?.messages?.length) return

  for (const msg of value.messages) {
    const telefone = normalizarTelefone(msg.from)
    const timestamp = new Date(Number(msg.timestamp) * 1000)

    // Determinar tipo e conteúdo
    let tipo: 'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT' | 'UNSUPPORTED' = 'UNSUPPORTED'
    let texto: string | null = null
    let mediaId: string | null = null
    let mediaNome: string | null = null

    if (msg.type === 'text') {
      tipo = 'TEXT'
      texto = msg.text?.body ?? ''
    } else if (msg.type === 'image') {
      tipo = 'IMAGE'
      mediaId = msg.image?.id ?? null
      mediaNome = msg.image?.filename ?? 'imagem'
    } else if (msg.type === 'audio') {
      tipo = 'AUDIO'
      mediaId = msg.audio?.id ?? null
    } else if (msg.type === 'document') {
      tipo = 'DOCUMENT'
      mediaId = msg.document?.id ?? null
      mediaNome = msg.document?.filename ?? 'documento'
    }

    // Upsert da conversa pelo telefone
    const conversa = await prisma.whatsappConversa.upsert({
      where: { telefone },
      create: { telefone },
      update: {},
    })

    // Idempotência: ignorar se waMessageId já existe
    const existing = msg.id
      ? await prisma.whatsappMensagem.findUnique({ where: { waMessageId: msg.id } })
      : null
    if (existing) continue

    // Gravar mensagem
    await prisma.whatsappMensagem.create({
      data: {
        conversaId: conversa.id,
        waMessageId: msg.id,
        direcao: 'INBOUND',
        tipo,
        texto,
        mediaId,
        mediaNome,
        timestamp,
      },
    })

    // Atualizar conversa
    await prisma.whatsappConversa.update({
      where: { id: conversa.id },
      data: {
        ultimaMensagemEm: timestamp,
        ultimaMensagemRecebidaEm: timestamp,
        totalNaoLidas: { increment: 1 },
      },
    })

    // Vincular automaticamente a lead pelo telefone (se não vinculado)
    if (!conversa.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { telefone: { equals: telefone } },
        select: { id: true, vendedorId: true },
      })
      if (lead) {
        await prisma.whatsappConversa.update({
          where: { id: conversa.id },
          data: { leadId: lead.id },
        })
      }
    }

    // Registrar no histórico do lead (se vinculado)
    const conversaAtualizada = await prisma.whatsappConversa.findUnique({
      where: { id: conversa.id }, select: { leadId: true, lead: { select: { vendedorId: true } } }
    })

    if (conversaAtualizada?.leadId) {
      await registrarHistorico({
        leadId: conversaAtualizada.leadId,
        tipoEvento: 'mensagem_recebida',
        descricao: `WhatsApp recebido${texto ? `: "${texto.slice(0, 80)}"` : ' (mídia)'}`,
        usuarioId: null,
      }, prisma)

      // Notificar vendedor via SSE
      if (conversaAtualizada.lead?.vendedorId) {
        sseHub.notificarUsuario(conversaAtualizada.lead.vendedorId, {
          tipo: 'nova_mensagem_whatsapp',
          leadId: conversaAtualizada.leadId,
          preview: texto?.slice(0, 60) ?? '[mídia]',
          timestamp,
        })
      }
    }

    // Notificar supervisores (todos conectados)
    sseHub.notificarTodos({
      tipo: 'nova_mensagem_whatsapp_global',
      telefone,
      leadId: conversaAtualizada?.leadId ?? null,
    })
  }
}

export async function listarConversas(
  perfil: string,
  vendedorId: string,
  prisma: PrismaClient
) {
  const where: any = {}
  if (perfil === 'VENDEDOR') {
    where.lead = { vendedorId }
  }
  return prisma.whatsappConversa.findMany({
    where,
    orderBy: { ultimaMensagemEm: 'desc' },
    include: {
      lead: { select: { nome: true, empresa: true, vendedor: { select: { nome: true } } } },
      mensagens: { orderBy: { timestamp: 'desc' }, take: 1, select: { texto: true, tipo: true, direcao: true } },
    },
  })
}

export async function listarMensagens(leadId: string, prisma: PrismaClient) {
  const conversa = await prisma.whatsappConversa.findFirst({
    where: { leadId },
    include: {
      mensagens: {
        orderBy: { timestamp: 'asc' },
        include: { enviadoPor: { select: { nome: true } } },
      },
    },
  })
  return conversa
}

export async function responderMensagem(
  leadId: string,
  texto: string,
  usuarioId: string,
  prisma: PrismaClient
) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { telefone: true, nome: true, empresa: true, vendedor: { select: { nome: true } } },
  })
  if (!lead?.telefone) throw Object.assign(new Error('Lead sem telefone'), { statusCode: 400 })

  const conversa = await prisma.whatsappConversa.findFirst({ where: { leadId } })
  if (!conversa) throw Object.assign(new Error('Conversa não encontrada'), { statusCode: 404 })

  const [phoneNumberId, accessToken, templateName] = await Promise.all([
    getConfigValor('WHATSAPP_PHONE_ID', prisma),
    getConfigValor('WHATSAPP_TOKEN', prisma),
    getConfigValor('WHATSAPP_TEMPLATE', prisma),
  ])
  if (!phoneNumberId || !accessToken) {
    throw Object.assign(new Error('WhatsApp não configurado'), { statusCode: 400 })
  }

  const naJanela = conversa.ultimaMensagemRecebidaEm &&
    Date.now() - conversa.ultimaMensagemRecebidaEm.getTime() < 24 * 60 * 60 * 1000

  if (naJanela) {
    // Texto livre via API
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizarTelefone(lead.telefone),
          type: 'text',
          text: { body: texto },
        }),
      }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message ?? `WhatsApp API ${res.status}`)
    }
  } else {
    // Template fora da janela
    await enviarWhatsApp({
      phoneNumberId, accessToken,
      templateName: templateName ?? 'saudacao_vendedor',
      para: normalizarTelefone(lead.telefone),
      params: [
        { type: 'text', text: lead.nome },
        { type: 'text', text: lead.vendedor?.nome ?? '' },
        { type: 'text', text: lead.empresa ?? '' },
      ],
    })
  }

  // Gravar mensagem enviada
  const mensagem = await prisma.whatsappMensagem.create({
    data: {
      conversaId: conversa.id,
      direcao: 'OUTBOUND',
      tipo: 'TEXT',
      texto,
      timestamp: new Date(),
      enviadoPorId: usuarioId,
      lida: true,
    },
  })

  await prisma.whatsappConversa.update({
    where: { id: conversa.id },
    data: { ultimaMensagemEm: new Date() },
  })

  await registrarHistorico({
    leadId,
    tipoEvento: 'mensagem_respondida',
    descricao: `WhatsApp enviado: "${texto.slice(0, 80)}"`,
    usuarioId,
  }, prisma)

  return mensagem
}

export async function marcarComoLidas(leadId: string, prisma: PrismaClient) {
  const conversa = await prisma.whatsappConversa.findFirst({ where: { leadId } })
  if (!conversa) return

  await prisma.whatsappMensagem.updateMany({
    where: { conversaId: conversa.id, direcao: 'INBOUND', lida: false },
    data: { lida: true },
  })
  await prisma.whatsappConversa.update({
    where: { id: conversa.id },
    data: { totalNaoLidas: 0 },
  })
}

export async function totalNaoLidas(perfil: string, vendedorId: string, prisma: PrismaClient) {
  const where: any = { totalNaoLidas: { gt: 0 } }
  if (perfil === 'VENDEDOR') where.lead = { vendedorId }
  const conversas = await prisma.whatsappConversa.findMany({
    where,
    select: { totalNaoLidas: true },
  })
  return conversas.reduce((sum, c) => sum + c.totalNaoLidas, 0)
}
```

## src/modules/whatsapp/whatsapp.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { verificarAssinaturaMeta } from '../../lib/whatsapp-utils'
import { sseHub } from '../../lib/sse-hub'
import {
  processarMensagemInbound, listarConversas, listarMensagens,
  responderMensagem, marcarComoLidas, totalNaoLidas,
} from './whatsapp.service'
import { getConfigValor } from '../integracao/config.service'

const PERFIS_GESTAO = ['SUPERVISAO', 'CEO', 'ADMIN']

export async function whatsappRoutes(fastify: FastifyInstance) {

  // GET /webhook/whatsapp — verificação Meta
  fastify.get('/webhook/whatsapp', async (req, reply) => {
    const q = req.query as any
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
    if (q['hub.verify_token'] === verifyToken) {
      return reply.send(q['hub.challenge'])
    }
    return reply.code(403).send('Forbidden')
  })

  // POST /webhook/whatsapp — mensagens inbound
  fastify.post(
    '/webhook/whatsapp',
    {
      config: { rawBody: true }, // Fastify precisa do rawBody para HMAC
    },
    async (req, reply) => {
      const appSecret = process.env.WHATSAPP_APP_SECRET ?? ''
      const sig = req.headers['x-hub-signature-256'] as string | undefined
      const raw = (req as any).rawBody as Buffer

      if (!verificarAssinaturaMeta(raw, sig, appSecret)) {
        return reply.code(403).send('Invalid signature')
      }

      // Processar de forma assíncrona para responder 200 imediatamente (Meta exige)
      processarMensagemInbound(req.body, prisma).catch(console.error)
      return reply.code(200).send('OK')
    }
  )

  // GET /api/conversas
  fastify.get('/conversas', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { perfil, id } = (req as any).user
    return reply.send(await listarConversas(perfil, id, prisma))
  })

  // GET /api/conversas/:leadId
  fastify.get('/conversas/:leadId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { leadId } = req.params as any
    const conversa = await listarMensagens(leadId, prisma)
    if (!conversa) return reply.send({ mensagens: [], ultimaMensagemRecebidaEm: null })
    return reply.send(conversa)
  })

  // POST /api/conversas/:leadId/responder
  fastify.post('/conversas/:leadId/responder', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { leadId } = req.params as any
    const { texto } = req.body as { texto: string }
    const userId = (req as any).user.id
    const perfil = (req as any).user.perfil

    // VENDEDOR só responde seus leads
    if (perfil === 'VENDEDOR') {
      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { vendedorId: true } })
      if (lead?.vendedorId !== userId) return reply.code(403).send({ error: 'Acesso negado' })
    }

    const msg = await responderMensagem(leadId, texto, userId, prisma)
    return reply.code(201).send(msg)
  })

  // PATCH /api/conversas/:leadId/lida
  fastify.patch('/conversas/:leadId/lida', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { leadId } = req.params as any
    await marcarComoLidas(leadId, prisma)
    return reply.send({ ok: true })
  })

  // GET /api/conversas/nao-lidas/contagem
  fastify.get('/conversas/nao-lidas/contagem', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { perfil, id } = (req as any).user
    const total = await totalNaoLidas(perfil, id, prisma)
    return reply.send({ total })
  })

  // GET /api/conversas/stream — SSE
  fastify.get('/conversas/stream', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req as any).user.id

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.flushHeaders()

    const send = (data: string) => reply.raw.write(data)
    sseHub.registrar(userId, send)

    // Heartbeat a cada 30s para manter conexão viva
    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 30_000)

    req.raw.on('close', () => {
      clearInterval(heartbeat)
      sseHub.remover(userId, send)
    })
  })

  // GET /api/whatsapp/media/:mediaId — proxy de mídia
  fastify.get('/whatsapp/media/:mediaId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { mediaId } = req.params as any
    const token = await getConfigValor('WHATSAPP_TOKEN', prisma)
    if (!token) return reply.code(400).send({ error: 'WhatsApp não configurado' })

    // Obter URL de download da Meta
    const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!metaRes.ok) return reply.code(404).send({ error: 'Mídia não encontrada' })

    const { url, mime_type } = await metaRes.json()

    // Fazer proxy do download
    const mediaRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    reply.header('Content-Type', mime_type ?? 'application/octet-stream')
    return reply.send(mediaRes.body)
  })
}
```

## Registro no server.ts

```typescript
import { whatsappRoutes } from './modules/whatsapp/whatsapp.routes'

// Webhook público (sem prefix /api)
fastify.register(whatsappRoutes)

// Configurar rawBody para o webhook:
fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
  ;(req as any).rawBody = body
  done(null, JSON.parse(body.toString()))
})
```
