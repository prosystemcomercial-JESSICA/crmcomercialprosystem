# Sprint 18 — Step 04 — Felipe Santos (Backend)
# Campanhas — Implementação API

## Dependências

```bash
npm install nodemailer @types/nodemailer
```

## src/lib/mailer.ts

```typescript
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST ?? 'localhost',
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function enviarEmail(opts: {
  para: string
  assunto: string
  corpo: string
}) {
  await transporter.sendMail({
    from:    process.env.SMTP_FROM ?? 'CRM ProSystem <noreply@prosystem.com.br>',
    to:      opts.para,
    subject: opts.assunto,
    html:    opts.corpo,
  })
}
```

## src/modules/campanha/campanha.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import { enviarEmail } from '../../lib/mailer'

export function substituirVariaveis(
  template: string,
  dados: { nome: string; empresa: string; vendedor: string }
): string {
  return template
    .replace(/\{nome\}/g, dados.nome)
    .replace(/\{empresa\}/g, dados.empresa)
    .replace(/\{vendedor\}/g, dados.vendedor)
}

// Monta filtro Prisma a partir dos filtros da campanha
function buildFiltroLeads(params: {
  filtroEtapas: string[]
  filtroStatus: string[]
  filtroVendedores: string[]
}) {
  const where: any = {}
  if (params.filtroEtapas.length)    where.etapa  = { in: params.filtroEtapas }
  if (params.filtroStatus.length)    where.status = { in: params.filtroStatus }
  if (params.filtroVendedores.length) where.vendedorId = { in: params.filtroVendedores }
  return where
}

export async function criarCampanha(
  data: {
    nome: string
    descricao?: string
    assunto: string
    corpo: string
    filtroEtapas?: string[]
    filtroStatus?: string[]
    filtroVendedores?: string[]
    criadoPorId: string
  },
  prisma: PrismaClient
) {
  return prisma.campanha.create({
    data: {
      nome:              data.nome,
      descricao:         data.descricao,
      assunto:           data.assunto,
      corpo:             data.corpo,
      filtroEtapas:      data.filtroEtapas ?? [],
      filtroStatus:      data.filtroStatus ?? [],
      filtroVendedores:  data.filtroVendedores ?? [],
      criadoPorId:       data.criadoPorId,
    },
    include: { criadoPor: { select: { nome: true } } },
  })
}

export async function listarCampanhas(perfil: string, vendedorId: string, prisma: PrismaClient) {
  // VENDEDOR: só campanhas que incluem seus leads
  if (perfil === 'VENDEDOR') {
    const ids = await prisma.campanhaDestinatario.findMany({
      where: { lead: { vendedorId } },
      select: { campanhaId: true },
      distinct: ['campanhaId'],
    })
    const campanhaIds = ids.map((i) => i.campanhaId)
    return prisma.campanha.findMany({
      where: { id: { in: campanhaIds } },
      orderBy: { createdAt: 'desc' },
      include: { criadoPor: { select: { nome: true } } },
    })
  }
  return prisma.campanha.findMany({
    orderBy: { createdAt: 'desc' },
    include: { criadoPor: { select: { nome: true } } },
  })
}

export async function previewDestinatarios(
  filtros: { filtroEtapas: string[]; filtroStatus: string[]; filtroVendedores: string[] },
  prisma: PrismaClient
) {
  const where = buildFiltroLeads(filtros)
  const leads = await prisma.lead.findMany({
    where,
    select: { id: true, nome: true, empresa: true, email: true, vendedor: { select: { nome: true } } },
  })
  const total = leads.length
  const comEmail = leads.filter((l) => !!l.email).length
  const semEmail = total - comEmail
  return { total, comEmail, semEmail, leads }
}

export async function editarCampanha(
  id: string,
  data: Partial<{
    nome: string
    descricao: string
    assunto: string
    corpo: string
    filtroEtapas: string[]
    filtroStatus: string[]
    filtroVendedores: string[]
  }>,
  prisma: PrismaClient
) {
  const campanha = await prisma.campanha.findUnique({ where: { id }, select: { status: true } })
  if (!campanha) throw Object.assign(new Error('Campanha não encontrada'), { statusCode: 404 })
  if (campanha.status !== 'RASCUNHO') {
    throw Object.assign(new Error('Apenas campanhas em rascunho podem ser editadas'), { statusCode: 400 })
  }
  return prisma.campanha.update({ where: { id }, data })
}

export async function dispararCampanha(
  id: string,
  agendadaPara: Date | null,
  prisma: PrismaClient
) {
  const campanha = await prisma.campanha.findUnique({ where: { id } })
  if (!campanha) throw Object.assign(new Error('Campanha não encontrada'), { statusCode: 404 })
  if (!['RASCUNHO', 'AGENDADA'].includes(campanha.status)) {
    throw Object.assign(new Error('Campanha não pode ser disparada neste status'), { statusCode: 400 })
  }

  // Snapshot de destinatários
  const leads = await prisma.lead.findMany({
    where: buildFiltroLeads({
      filtroEtapas: campanha.filtroEtapas,
      filtroStatus: campanha.filtroStatus,
      filtroVendedores: campanha.filtroVendedores,
    }),
    select: { id: true, nome: true, empresa: true, email: true, vendedor: { select: { nome: true } } },
  })

  if (leads.length === 0) {
    throw Object.assign(new Error('Nenhum lead corresponde aos filtros'), { statusCode: 400 })
  }

  // Gravar destinatários (upsert para evitar duplicata em re-disparo de agendada)
  await prisma.campanhaDestinatario.createMany({
    data: leads.map((l) => ({
      campanhaId: id,
      leadId:     l.id,
      email:      l.email ?? null,
      status:     l.email ? 'PENDENTE' : 'SEM_CANAL',
    })),
    skipDuplicates: true,
  })

  if (agendadaPara && agendadaPara > new Date()) {
    // Agendar
    await prisma.campanha.update({
      where: { id },
      data: { status: 'AGENDADA', agendadaPara, totalDestinatarios: leads.length },
    })
    return { agendada: true, agendadaPara }
  }

  // Disparar agora
  await prisma.campanha.update({
    where: { id },
    data: { status: 'ENVIANDO', iniciadaEm: new Date(), totalDestinatarios: leads.length },
  })

  // Envio assíncrono
  enviarEmMassa(id, campanha.assunto, campanha.corpo, prisma).catch(() => {})
  return { agendada: false }
}

async function enviarEmMassa(
  campanhaId: string,
  assunto: string,
  corpo: string,
  prisma: PrismaClient
) {
  const destinatarios = await prisma.campanhaDestinatario.findMany({
    where: { campanhaId, status: 'PENDENTE' },
    include: { lead: { select: { nome: true, empresa: true, vendedor: { select: { nome: true } } } } },
  })

  for (const dest of destinatarios) {
    // Verificar se campanha ainda está ENVIANDO (pode ter sido cancelada)
    const atual = await prisma.campanha.findUnique({ where: { id: campanhaId }, select: { status: true } })
    if (atual?.status !== 'ENVIANDO') break

    try {
      const corpoFinal = substituirVariaveis(corpo, {
        nome:     dest.lead.nome,
        empresa:  dest.lead.empresa ?? '',
        vendedor: dest.lead.vendedor?.nome ?? '',
      })
      await enviarEmail({ para: dest.email!, assunto, corpo: corpoFinal })
      await prisma.$transaction([
        prisma.campanhaDestinatario.update({
          where: { id: dest.id },
          data: { status: 'ENVIADO', enviadoEm: new Date() },
        }),
        prisma.campanha.update({
          where: { id: campanhaId },
          data: { totalEnviados: { increment: 1 } },
        }),
      ])
    } catch (err: any) {
      await prisma.$transaction([
        prisma.campanhaDestinatario.update({
          where: { id: dest.id },
          data: { status: 'FALHA', erro: err?.message ?? 'Erro desconhecido' },
        }),
        prisma.campanha.update({
          where: { id: campanhaId },
          data: { totalFalhas: { increment: 1 } },
        }),
      ])
    }

    // Pausa entre envios para não sobrecarregar o SMTP
    await new Promise((r) => setImmediate(r))
  }

  // Verificar se ainda está enviando antes de concluir
  const final = await prisma.campanha.findUnique({ where: { id: campanhaId }, select: { status: true } })
  if (final?.status === 'ENVIANDO') {
    await prisma.campanha.update({
      where: { id: campanhaId },
      data: { status: 'CONCLUIDA', concluidaEm: new Date() },
    })
  }
}

export async function cancelarCampanha(id: string, prisma: PrismaClient) {
  const campanha = await prisma.campanha.findUnique({ where: { id }, select: { status: true } })
  if (!campanha) throw Object.assign(new Error('Campanha não encontrada'), { statusCode: 404 })
  if (!['AGENDADA', 'ENVIANDO'].includes(campanha.status)) {
    throw Object.assign(new Error('Campanha não pode ser cancelada neste status'), { statusCode: 400 })
  }
  return prisma.campanha.update({ where: { id }, data: { status: 'CANCELADA', concluidaEm: new Date() } })
}

export async function detalharCampanha(id: string, prisma: PrismaClient) {
  const campanha = await prisma.campanha.findUnique({
    where: { id },
    include: { criadoPor: { select: { nome: true } } },
  })
  if (!campanha) throw Object.assign(new Error('Campanha não encontrada'), { statusCode: 404 })
  return campanha
}

export async function listarDestinatarios(
  campanhaId: string,
  filtroStatus: string | undefined,
  prisma: PrismaClient
) {
  const where: any = { campanhaId }
  if (filtroStatus) where.status = filtroStatus
  return prisma.campanhaDestinatario.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: { lead: { select: { nome: true, empresa: true } } },
  })
}

// Cron: verificar campanhas agendadas
export async function verificarCampanhasAgendadas(prisma: PrismaClient) {
  const agora = new Date()
  const campanhas = await prisma.campanha.findMany({
    where: { status: 'AGENDADA', agendadaPara: { lte: agora } },
    select: { id: true, assunto: true, corpo: true },
  })
  for (const c of campanhas) {
    await prisma.campanha.update({ where: { id: c.id }, data: { status: 'ENVIANDO', iniciadaEm: new Date() } })
    enviarEmMassa(c.id, c.assunto, c.corpo, prisma).catch(() => {})
  }
}
```

## src/modules/campanha/campanha.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import {
  criarCampanha, listarCampanhas, previewDestinatarios,
  editarCampanha, dispararCampanha, cancelarCampanha,
  detalharCampanha, listarDestinatarios,
} from './campanha.service'

const PERFIS_GESTAO = ['SUPERVISAO', 'CEO', 'ADMIN']

export async function campanhaRoutes(fastify: FastifyInstance) {

  // POST /api/campanhas
  fastify.post('/campanhas', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const perfil = (req as any).user.perfil
    if (!PERFIS_GESTAO.includes(perfil)) return reply.code(403).send({ error: 'Acesso negado' })

    const body = req.body as any
    const campanha = await criarCampanha({ ...body, criadoPorId: (req as any).user.id }, prisma)
    return reply.code(201).send(campanha)
  })

  // GET /api/campanhas
  fastify.get('/campanhas', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { perfil, id } = (req as any).user
    const campanhas = await listarCampanhas(perfil, id, prisma)
    return reply.send(campanhas)
  })

  // GET /api/campanhas/preview
  fastify.get('/campanhas/preview', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { filtroEtapas, filtroStatus, filtroVendedores } = req.query as any
    const preview = await previewDestinatarios(
      {
        filtroEtapas:     filtroEtapas ? JSON.parse(filtroEtapas) : [],
        filtroStatus:     filtroStatus ? JSON.parse(filtroStatus) : [],
        filtroVendedores: filtroVendedores ? JSON.parse(filtroVendedores) : [],
      },
      prisma
    )
    return reply.send(preview)
  })

  // GET /api/campanhas/:id
  fastify.get('/campanhas/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const campanha = await detalharCampanha(id, prisma)
    return reply.send(campanha)
  })

  // PATCH /api/campanhas/:id
  fastify.patch('/campanhas/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const perfil = (req as any).user.perfil
    if (!PERFIS_GESTAO.includes(perfil)) return reply.code(403).send({ error: 'Acesso negado' })

    const { id } = req.params as any
    const campanha = await editarCampanha(id, req.body as any, prisma)
    return reply.send(campanha)
  })

  // POST /api/campanhas/:id/disparar
  fastify.post('/campanhas/:id/disparar', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const perfil = (req as any).user.perfil
    if (!PERFIS_GESTAO.includes(perfil)) return reply.code(403).send({ error: 'Acesso negado' })

    const { id } = req.params as any
    const { agendadaPara } = req.body as any
    const result = await dispararCampanha(id, agendadaPara ? new Date(agendadaPara) : null, prisma)
    return reply.send(result)
  })

  // POST /api/campanhas/:id/cancelar
  fastify.post('/campanhas/:id/cancelar', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const perfil = (req as any).user.perfil
    if (!PERFIS_GESTAO.includes(perfil)) return reply.code(403).send({ error: 'Acesso negado' })

    const { id } = req.params as any
    await cancelarCampanha(id, prisma)
    return reply.send({ ok: true })
  })

  // GET /api/campanhas/:id/destinatarios
  fastify.get('/campanhas/:id/destinatarios', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const { status } = req.query as any
    const lista = await listarDestinatarios(id, status, prisma)
    return reply.send(lista)
  })

  // GET /api/campanhas/:id/progresso (SSE)
  fastify.get('/campanhas/:id/progresso', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as any

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.flushHeaders()

    const enviar = async () => {
      const campanha = await prisma.campanha.findUnique({
        where: { id },
        select: { status: true, totalDestinatarios: true, totalEnviados: true, totalFalhas: true },
      })
      if (!campanha) { reply.raw.end(); return true }
      reply.raw.write(`data: ${JSON.stringify(campanha)}\n\n`)
      return ['CONCLUIDA', 'CANCELADA'].includes(campanha.status)
    }

    const done = await enviar()
    if (done) return

    const interval = setInterval(async () => {
      const finished = await enviar()
      if (finished) { clearInterval(interval); reply.raw.end() }
    }, 1500)

    req.raw.on('close', () => clearInterval(interval))
  })
}
```

## Registro no server.ts

```typescript
import { campanhaRoutes } from './modules/campanha/campanha.routes'
import { verificarCampanhasAgendadas } from './modules/campanha/campanha.service'

fastify.register(campanhaRoutes)

// No cron existente, adicionar:
await verificarCampanhasAgendadas(prisma)
```
