# Sprint 19 — Step 04 — Felipe Santos (Backend)
# Integrações — Implementação API

## src/lib/whatsapp.ts

```typescript
export async function enviarWhatsApp(opts: {
  phoneNumberId: string
  accessToken: string
  templateName: string
  para: string
  params: { type: 'text'; text: string }[]
}): Promise<{ messageId: string }> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${opts.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: opts.para,
        type: 'template',
        template: {
          name: opts.templateName,
          language: { code: 'pt_BR' },
          components: [{ type: 'body', parameters: opts.params }],
        },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `WhatsApp API ${res.status}`)
  }

  const data = await res.json()
  return { messageId: data.messages?.[0]?.id ?? '' }
}
```

## src/lib/crypto.ts

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const KEY = Buffer.from(process.env.ENCRYPTION_KEY ?? '0'.repeat(64), 'hex')
const ALGO = 'aes-256-cbc'

export function encrypt(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGO, KEY, iv)
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${enc.toString('hex')}`
}

export function decrypt(text: string): string {
  const [ivHex, encHex] = text.split(':')
  const decipher = createDecipheriv(ALGO, KEY, Buffer.from(ivHex, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]).toString('utf8')
}
```

## src/modules/integracao/config.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import { encrypt, decrypt } from '../../lib/crypto'

const CAMPOS_SENSIVEIS = new Set([
  'WHATSAPP_TOKEN', 'SMTP_PASS',
])

export async function listarConfig(prisma: PrismaClient) {
  const configs = await prisma.configIntegracao.findMany()
  return configs.map((c) => ({
    chave: c.chave,
    valor: c.sensivel ? '••••••••' : c.valor,
    sensivel: c.sensivel,
  }))
}

export async function salvarConfig(
  entries: { chave: string; valor: string }[],
  prisma: PrismaClient
) {
  for (const { chave, valor } of entries) {
    const sensivel = CAMPOS_SENSIVEIS.has(chave)
    await prisma.configIntegracao.upsert({
      where: { chave },
      create: { chave, valor: sensivel ? encrypt(valor) : valor, sensivel },
      update: { valor: sensivel ? encrypt(valor) : valor, sensivel },
    })
  }
}

export async function getConfigValor(chave: string, prisma: PrismaClient): Promise<string | null> {
  const cfg = await prisma.configIntegracao.findUnique({ where: { chave } })
  if (!cfg) return null
  return cfg.sensivel ? decrypt(cfg.valor) : cfg.valor
}

export async function testarWhatsApp(prisma: PrismaClient) {
  const [phoneNumberId, accessToken, templateName] = await Promise.all([
    getConfigValor('WHATSAPP_PHONE_ID', prisma),
    getConfigValor('WHATSAPP_TOKEN', prisma),
    getConfigValor('WHATSAPP_TEMPLATE', prisma),
  ])
  if (!phoneNumberId || !accessToken) throw new Error('WhatsApp não configurado')

  // Só valida o token sem enviar (GET na API de conta)
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) throw new Error('Token inválido ou Phone Number ID incorreto')
  return { ok: true, template: templateName ?? 'não configurado' }
}

export async function testarSmtp(prisma: PrismaClient) {
  const nodemailer = await import('nodemailer')
  const [host, port, secure, user, pass] = await Promise.all([
    getConfigValor('SMTP_HOST', prisma),
    getConfigValor('SMTP_PORT', prisma),
    getConfigValor('SMTP_SECURE', prisma),
    getConfigValor('SMTP_USER', prisma),
    getConfigValor('SMTP_PASS', prisma),
  ])

  const transporter = nodemailer.default.createTransport({
    host:   host   ?? process.env.SMTP_HOST,
    port:   Number(port ?? process.env.SMTP_PORT ?? 587),
    secure: (secure ?? process.env.SMTP_SECURE) === 'true',
    auth: { user: user ?? process.env.SMTP_USER, pass: pass ?? process.env.SMTP_PASS },
  })

  await transporter.verify()
  return { ok: true }
}
```

## src/modules/integracao/whatsapp.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import { enviarWhatsApp } from '../../lib/whatsapp'
import { getConfigValor } from './config.service'
import { registrarHistorico } from '../../lib/historico'

export async function enviarMensagemWhatsApp(
  leadId: string,
  usuarioId: string,
  prisma: PrismaClient
) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { nome: true, empresa: true, telefone: true, vendedor: { select: { nome: true } } },
  })
  if (!lead) throw Object.assign(new Error('Lead não encontrado'), { statusCode: 404 })
  if (!lead.telefone) throw Object.assign(new Error('Lead sem telefone cadastrado'), { statusCode: 400 })

  const [phoneNumberId, accessToken, templateName] = await Promise.all([
    getConfigValor('WHATSAPP_PHONE_ID', prisma),
    getConfigValor('WHATSAPP_TOKEN', prisma),
    getConfigValor('WHATSAPP_TEMPLATE', prisma),
  ])
  if (!phoneNumberId || !accessToken) {
    throw Object.assign(new Error('WhatsApp não configurado — acesse Configurações > Integrações'), { statusCode: 400 })
  }

  const params = [
    { type: 'text' as const, text: lead.nome },
    { type: 'text' as const, text: lead.vendedor?.nome ?? '' },
    { type: 'text' as const, text: lead.empresa ?? '' },
  ]

  let logId: string | null = null

  // Criar log pendente
  const log = await prisma.logMensagem.create({
    data: {
      canal: 'WHATSAPP',
      destinatario: lead.telefone,
      template: templateName ?? 'saudacao_vendedor',
      status: 'PENDENTE',
      leadId,
      enviadoPorId: usuarioId,
    },
  })
  logId = log.id

  try {
    await enviarWhatsApp({
      phoneNumberId,
      accessToken,
      templateName: templateName ?? 'saudacao_vendedor',
      para: lead.telefone,
      params,
    })

    await prisma.logMensagem.update({ where: { id: logId }, data: { status: 'ENVIADO' } })

    await registrarHistorico({
      leadId,
      tipoEvento: 'whatsapp_enviado',
      descricao: `WhatsApp enviado via template "${templateName ?? 'saudacao_vendedor'}"`,
      usuarioId,
    }, prisma)

    return { ok: true }
  } catch (err: any) {
    await prisma.logMensagem.update({
      where: { id: logId },
      data: { status: 'FALHA', erro: err?.message },
    })
    throw Object.assign(new Error(err?.message ?? 'Falha ao enviar WhatsApp'), { statusCode: 502 })
  }
}
```

## src/modules/integracao/ligacao.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import { registrarHistorico } from '../../lib/historico'

const RESULTADOS_VALIDOS = ['conectou_agendou', 'conectou_sem_interesse', 'nao_atendeu', 'caixa_postal']

export async function registrarLigacao(
  leadId: string,
  data: {
    dataHora: string
    duracaoMin?: number
    resultado: string
    notas?: string
  },
  usuarioId: string,
  prisma: PrismaClient
) {
  if (!RESULTADOS_VALIDOS.includes(data.resultado)) {
    throw Object.assign(new Error('Resultado inválido'), { statusCode: 400 })
  }

  const ligacao = await prisma.registroLigacao.create({
    data: {
      leadId,
      dataHora: new Date(data.dataHora),
      duracaoMin: data.duracaoMin ?? null,
      resultado: data.resultado,
      notas: data.notas ?? null,
      registradoPorId: usuarioId,
    },
  })

  const resultadoLabel: Record<string, string> = {
    conectou_agendou: 'Conectou — agendou retorno',
    conectou_sem_interesse: 'Conectou — sem interesse',
    nao_atendeu: 'Não atendeu',
    caixa_postal: 'Caixa postal',
  }

  await registrarHistorico({
    leadId,
    tipoEvento: 'ligacao_registrada',
    descricao: `📞 Ligação: ${resultadoLabel[data.resultado]}${data.duracaoMin ? ` · ${data.duracaoMin} min` : ''}${data.notas ? ` — ${data.notas.slice(0, 80)}` : ''}`,
    usuarioId,
  }, prisma)

  return ligacao
}

export async function listarLigacoes(leadId: string, prisma: PrismaClient) {
  return prisma.registroLigacao.findMany({
    where: { leadId },
    orderBy: { dataHora: 'desc' },
    include: { registradoPor: { select: { nome: true } } },
  })
}
```

## src/modules/integracao/integracao.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { listarConfig, salvarConfig, testarWhatsApp, testarSmtp } from './config.service'
import { enviarMensagemWhatsApp } from './whatsapp.service'
import { registrarLigacao, listarLigacoes } from './ligacao.service'

const PERFIS_ADMIN = ['CEO', 'ADMIN']
const PERFIS_GESTAO = ['SUPERVISAO', 'CEO', 'ADMIN']

export async function integracaoRoutes(fastify: FastifyInstance) {

  // GET /api/config/integracoes
  fastify.get('/config/integracoes', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    if (!PERFIS_ADMIN.includes((req as any).user.perfil)) return reply.code(403).send({ error: 'Acesso negado' })
    return reply.send(await listarConfig(prisma))
  })

  // PUT /api/config/integracoes
  fastify.put('/config/integracoes', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    if (!PERFIS_ADMIN.includes((req as any).user.perfil)) return reply.code(403).send({ error: 'Acesso negado' })
    const { entries } = req.body as { entries: { chave: string; valor: string }[] }
    await salvarConfig(entries, prisma)
    return reply.send({ ok: true })
  })

  // POST /api/config/integracoes/testar/whatsapp
  fastify.post('/config/integracoes/testar/whatsapp', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    if (!PERFIS_ADMIN.includes((req as any).user.perfil)) return reply.code(403).send({ error: 'Acesso negado' })
    const result = await testarWhatsApp(prisma)
    return reply.send(result)
  })

  // POST /api/config/integracoes/testar/smtp
  fastify.post('/config/integracoes/testar/smtp', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    if (!PERFIS_ADMIN.includes((req as any).user.perfil)) return reply.code(403).send({ error: 'Acesso negado' })
    const result = await testarSmtp(prisma)
    return reply.send(result)
  })

  // POST /api/leads/:leadId/whatsapp
  fastify.post('/leads/:leadId/whatsapp', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { leadId } = req.params as any
    const userId = (req as any).user.id
    const perfil = (req as any).user.perfil

    // VENDEDOR só pode enviar para seus próprios leads
    if (perfil === 'VENDEDOR') {
      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { vendedorId: true } })
      if (lead?.vendedorId !== userId) return reply.code(403).send({ error: 'Acesso negado' })
    }

    const result = await enviarMensagemWhatsApp(leadId, userId, prisma)
    return reply.send(result)
  })

  // POST /api/leads/:leadId/ligacoes
  fastify.post('/leads/:leadId/ligacoes', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { leadId } = req.params as any
    const userId = (req as any).user.id
    const result = await registrarLigacao(leadId, req.body as any, userId, prisma)
    return reply.code(201).send(result)
  })

  // GET /api/leads/:leadId/ligacoes
  fastify.get('/leads/:leadId/ligacoes', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { leadId } = req.params as any
    return reply.send(await listarLigacoes(leadId, prisma))
  })

  // GET /api/log-mensagens
  fastify.get('/log-mensagens', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    if (!PERFIS_GESTAO.includes((req as any).user.perfil)) return reply.code(403).send({ error: 'Acesso negado' })
    const { canal, dias = '7' } = req.query as any
    const desde = new Date()
    desde.setDate(desde.getDate() - Number(dias))

    const where: any = { createdAt: { gte: desde } }
    if (canal) where.canal = canal

    const logs = await prisma.logMensagem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        lead:      { select: { nome: true, empresa: true } },
        campanha:  { select: { nome: true } },
        enviadoPor: { select: { nome: true } },
      },
    })
    return reply.send(logs)
  })
}
```

## Registro no server.ts

```typescript
import { integracaoRoutes } from './modules/integracao/integracao.routes'
fastify.register(integracaoRoutes)
```

## Extensão de campanha.service.ts para WhatsApp

```typescript
// Adicionar dentro de enviarEmMassa — trecho do canal WhatsApp:
if (campanha.canal === 'WHATSAPP') {
  const waConfig = await getWhatsAppConfig(prisma)
  if (!waConfig) throw new Error('WhatsApp não configurado')

  const params = [
    { type: 'text' as const, text: dest.lead.nome },
    { type: 'text' as const, text: dest.lead.vendedor?.nome ?? '' },
    { type: 'text' as const, text: dest.lead.empresa ?? '' },
  ]

  await enviarWhatsApp({
    phoneNumberId: waConfig.phoneNumberId,
    accessToken:   waConfig.accessToken,
    templateName:  waConfig.templateName,
    para:          dest.whatsappPhone!,
    params,
  })
}

// No snapshot (dispararCampanha), capturar phone:
data: leads.map((l) => ({
  campanhaId: id,
  leadId:     l.id,
  email:      l.email ?? null,
  whatsappPhone: l.telefone ?? null,
  status: campanha.canal === 'EMAIL'
    ? (l.email ? 'PENDENTE' : 'SEM_CANAL')
    : (l.telefone ? 'PENDENTE' : 'SEM_CANAL'),
}))
```

## Adicionar ao HistoricoLead — novo tipoEvento

```typescript
// Em src/lib/historico.ts — o tipo tipoEvento já é string genérico (sem enum)
// Basta usar:
tipoEvento: 'whatsapp_enviado'
tipoEvento: 'ligacao_registrada'
// Nenhuma alteração de schema necessária
```
