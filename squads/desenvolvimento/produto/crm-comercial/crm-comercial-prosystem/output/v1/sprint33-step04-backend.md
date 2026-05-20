# Sprint 33 — Step 04 — Felipe Santos (Backend)
# Softphone Integrado — Implementação API

## src/modules/softphone/softphone.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import NodeCache from 'node-cache'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { registrarHistorico } from '../../lib/historico'

const cache = new NodeCache({ stdTTL: 120 })
// Reutiliza TOKEN_ENCRYPTION_KEY do módulo do Google Calendar
const ENC_KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex')

function encriptar(texto: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', ENC_KEY, iv)
  const enc = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`
}

function decriptar(cifrado: string): string {
  const [ivHex, encHex, tagHex] = cifrado.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const enc = Buffer.from(encHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', ENC_KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

export async function getConfigSIP(prisma: PrismaClient) {
  const cached = cache.get<any>('sip-config')
  if (cached) return cached

  const configs = await prisma.configuracao.findMany({
    where: { chave: { in: ['SIP_HOST', 'SIP_USER', 'SIP_PASSWORD_ENC', 'SIP_PORT', 'STUN_SERVER', 'SIP_CODEC', 'SOFTPHONE_GRAVACAO'] } },
  })

  const map = Object.fromEntries(configs.map((c) => [c.chave, c.valor]))
  const resultado = {
    host: map.SIP_HOST ?? '',
    user: map.SIP_USER ?? '',
    password: map.SIP_PASSWORD_ENC ? decriptar(map.SIP_PASSWORD_ENC) : '',
    port: Number(map.SIP_PORT ?? 5060),
    stun: map.STUN_SERVER ?? 'stun:stun.l.google.com:19302',
    codec: map.SIP_CODEC ?? 'PCMU',
    gravacaoAtiva: map.SOFTPHONE_GRAVACAO === 'true',
  }

  cache.set('sip-config', resultado)
  return resultado
}

export async function salvarConfigSIP(dados: {
  host: string; user: string; password: string; port: number
  stun: string; codec: string; gravacaoAtiva: boolean
}, prisma: PrismaClient) {
  const senhaEnc = encriptar(dados.password)
  const upserts = [
    { chave: 'SIP_HOST', valor: dados.host },
    { chave: 'SIP_USER', valor: dados.user },
    { chave: 'SIP_PASSWORD_ENC', valor: senhaEnc },
    { chave: 'SIP_PORT', valor: String(dados.port) },
    { chave: 'STUN_SERVER', valor: dados.stun },
    { chave: 'SIP_CODEC', valor: dados.codec },
    { chave: 'SOFTPHONE_GRAVACAO', valor: dados.gravacaoAtiva ? 'true' : 'false' },
  ]
  for (const u of upserts) {
    await prisma.configuracao.upsert({ where: { chave: u.chave }, create: u, update: { valor: u.valor } })
  }
  cache.del('sip-config')
  return { ok: true }
}

export async function registrarChamada(dados: {
  leadId: string; usuarioId: string; numeroDiscado: string
  duracao: number; status: 'ATENDIDA' | 'NAO_ATENDIDA' | 'OCUPADO' | 'ERRO'
  sipCallId?: string; resultado?: string
}, prisma: PrismaClient) {
  // Idempotência: se sipCallId já existe, retornar chamada existente
  if (dados.sipCallId) {
    const existente = await prisma.chamada.findUnique({ where: { sipCallId: dados.sipCallId } })
    if (existente) return existente
  }

  const chamada = await prisma.chamada.create({ data: dados })

  // Histórico do lead
  await registrarHistorico({
    leadId: dados.leadId,
    tipoEvento: 'ligacao_softphone',
    descricao: `Ligação ${dados.status === 'ATENDIDA' ? 'atendida' : dados.status === 'OCUPADO' ? 'ocupado' : 'não atendida'} — ${Math.floor(dados.duracao / 60)}min ${dados.duracao % 60}s${dados.resultado ? `: "${dados.resultado.slice(0, 80)}"` : ''}`,
    usuarioId: dados.usuarioId,
  }, prisma)

  return chamada
}

export async function getChamadasLead(leadId: string, prisma: PrismaClient) {
  return prisma.chamada.findMany({
    where: { leadId },
    orderBy: { criadoEm: 'desc' },
    include: { usuario: { select: { nome: true } } },
  })
}

export async function getRelatorio(
  inicio: string, fim: string, vendedorId: string | undefined, prisma: PrismaClient
) {
  const cacheKey = `softphone-relatorio:${inicio}:${fim}:${vendedorId ?? 'all'}`
  const cached = cache.get<any>(cacheKey)
  if (cached) return cached

  const where: any = {
    criadoEm: { gte: new Date(inicio), lte: new Date(fim) },
    ...(vendedorId ? { usuarioId: vendedorId } : {}),
  }

  const chamadas = await prisma.chamada.findMany({
    where,
    include: {
      usuario: { select: { nome: true } },
      lead: { select: { nome: true, empresa: true } },
    },
    orderBy: { criadoEm: 'desc' },
  })

  const total = chamadas.length
  const atendidas = chamadas.filter(c => c.status === 'ATENDIDA').length
  const duracaoMedia = atendidas > 0
    ? Math.round(chamadas.filter(c => c.status === 'ATENDIDA').reduce((s, c) => s + c.duracao, 0) / atendidas)
    : 0

  const resultado = {
    total, atendidas,
    naoAtendidas: chamadas.filter(c => c.status === 'NAO_ATENDIDA').length,
    ocupadas: chamadas.filter(c => c.status === 'OCUPADO').length,
    duracaoMedia,
    taxaAtendimento: total > 0 ? Math.round((atendidas / total) * 100) : 0,
    detalhe: chamadas,
  }

  cache.set(cacheKey, resultado, 300) // 5min
  return resultado
}

export async function salvarGravacao(sipCallId: string, gravacaoUrl: string, prisma: PrismaClient) {
  await prisma.chamada.update({ where: { sipCallId }, data: { gravacaoUrl } })
  return { ok: true }
}
```

## src/modules/softphone/softphone.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import {
  getConfigSIP, salvarConfigSIP, registrarChamada,
  getChamadasLead, getRelatorio, salvarGravacao,
} from './softphone.service'

export async function softphoneRoutes(fastify: FastifyInstance) {
  // GET /api/softphone/config
  fastify.get('/softphone/config', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    return reply.send(await getConfigSIP(prisma))
  })

  // POST /api/softphone/chamadas — registrar chamada encerrada
  fastify.post('/softphone/chamadas', { preHandler: [fastify.authenticate] }, async (req: any, reply) => {
    const { leadId, numeroDiscado, duracao, status, sipCallId, resultado } = req.body as any
    if (!leadId || !numeroDiscado || !status) return reply.code(400).send({ error: 'leadId, numeroDiscado e status obrigatórios' })
    const chamada = await registrarChamada(
      { leadId, usuarioId: req.user.id, numeroDiscado, duracao: duracao ?? 0, status, sipCallId, resultado },
      prisma
    )
    return reply.code(201).send(chamada)
  })

  // GET /api/softphone/chamadas/lead/:leadId
  fastify.get('/softphone/chamadas/lead/:leadId', { preHandler: [fastify.authenticate] }, async (req: any, reply) => {
    const { leadId } = req.params
    if (req.user.perfil === 'VENDEDOR') {
      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { vendedorId: true } })
      if (lead?.vendedorId !== req.user.id) return reply.code(403).send({ error: 'Acesso negado' })
    }
    return reply.send(await getChamadasLead(leadId, prisma))
  })

  // GET /api/softphone/relatorio
  fastify.get('/softphone/relatorio', { preHandler: [fastify.authenticate] }, async (req: any, reply) => {
    if (['VENDEDOR'].includes(req.user.perfil)) return reply.code(403).send({ error: 'Acesso negado' })
    const { inicio, fim, vendedorId } = req.query as any
    if (!inicio || !fim) return reply.code(400).send({ error: 'inicio e fim obrigatórios' })
    return reply.send(await getRelatorio(inicio, fim, vendedorId, prisma))
  })

  // PUT /api/softphone/config-admin — apenas ADMIN
  fastify.put('/softphone/config-admin', { preHandler: [fastify.authenticate] }, async (req: any, reply) => {
    if (req.user.perfil !== 'ADMIN') return reply.code(403).send({ error: 'Apenas ADMIN' })
    return reply.send(await salvarConfigSIP(req.body as any, prisma))
  })

  // POST /api/softphone/gravacao-webhook — sem autenticação JWT (webhook do servidor VoIP)
  fastify.post('/softphone/gravacao-webhook', async (req: any, reply) => {
    const secret = req.headers['x-webhook-secret']
    if (secret !== process.env.SOFTPHONE_WEBHOOK_SECRET) return reply.code(403).send('Forbidden')
    const { sipCallId, gravacaoUrl } = req.body as any
    return reply.send(await salvarGravacao(sipCallId, gravacaoUrl, prisma))
  })
}
```

## Registro no server.ts

```typescript
import { softphoneRoutes } from './modules/softphone/softphone.routes'
fastify.register(softphoneRoutes, { prefix: '/api' })
```
