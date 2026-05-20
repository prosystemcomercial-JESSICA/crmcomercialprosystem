# Sprint 34 — Step 04 — Felipe Santos (Backend)
# Vínculo Manual WA → Lead — Implementação API

## src/modules/whatsapp/desconhecidas.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import NodeCache from 'node-cache'
import { registrarHistorico } from '../../lib/historico'
import { sseHub } from '../../lib/sse-hub'

const cache = new NodeCache({ stdTTL: 120 }) // 2min
const KEY_LISTA = 'wa-desconhecidas-lista'
const KEY_CONTAGEM = 'wa-desconhecidas-contagem'

function invalidarCache() {
  cache.del(KEY_LISTA)
  cache.del(KEY_CONTAGEM)
}

export async function listarDesconhecidas(
  incluirArquivadas: boolean,
  prisma: PrismaClient
) {
  const cacheKey = `${KEY_LISTA}:${incluirArquivadas}`
  const cached = cache.get<any[]>(cacheKey)
  if (cached) return cached

  const where: any = { leadId: null }
  if (!incluirArquivadas) where.arquivada = false

  const conversas = await prisma.whatsappConversa.findMany({
    where,
    orderBy: { ultimaMensagemEm: 'desc' },
    include: {
      mensagens: {
        orderBy: { timestamp: 'desc' },
        take: 1,
        select: { texto: true, tipo: true, direcao: true, timestamp: true },
      },
      _count: { select: { mensagens: true } },
    },
  })

  const resultado = conversas.map((c) => ({
    id: c.id,
    telefone: c.telefone,
    ultimaMensagemEm: c.ultimaMensagemEm,
    totalMensagens: c._count.mensagens,
    totalNaoLidas: c.totalNaoLidas,
    arquivada: c.arquivada,
    previewMensagem: c.mensagens[0]?.texto ?? null,
    previewTipo: c.mensagens[0]?.tipo ?? null,
  }))

  cache.set(cacheKey, resultado)
  return resultado
}

export async function contarDesconhecidas(prisma: PrismaClient) {
  const cached = cache.get<number>(KEY_CONTAGEM)
  if (cached !== undefined) return cached

  const total = await prisma.whatsappConversa.count({
    where: { leadId: null, arquivada: false },
  })

  cache.set(KEY_CONTAGEM, total)
  return total
}

export async function mensagensDesconhecida(id: string, prisma: PrismaClient) {
  const conversa = await prisma.whatsappConversa.findUnique({
    where: { id },
    include: {
      mensagens: {
        orderBy: { timestamp: 'asc' },
        include: { enviadoPor: { select: { nome: true } } },
      },
    },
  })
  if (!conversa) throw Object.assign(new Error('Conversa não encontrada'), { statusCode: 404 })
  if (conversa.leadId) throw Object.assign(new Error('Conversa já vinculada'), { statusCode: 409 })

  return conversa
}

export async function vincularALead(
  id: string,
  leadId: string,
  usuarioId: string,
  prisma: PrismaClient
) {
  const conversa = await prisma.whatsappConversa.findUnique({ where: { id } })
  if (!conversa) throw Object.assign(new Error('Conversa não encontrada'), { statusCode: 404 })
  if (conversa.leadId) throw Object.assign(new Error('Conversa já vinculada a um lead'), { statusCode: 409 })

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, nome: true, telefone: true, vendedorId: true, vendedor: { select: { nome: true } } },
  })
  if (!lead) throw Object.assign(new Error('Lead não encontrado'), { statusCode: 404 })

  // Atualizar telefone do lead somente se não tiver um
  const atualizarTelefone = !lead.telefone

  await prisma.$transaction(async (tx) => {
    // Vincular conversa ao lead
    await tx.whatsappConversa.update({
      where: { id },
      data: { leadId },
    })

    // Atualizar telefone do lead se necessário
    if (atualizarTelefone) {
      await tx.lead.update({
        where: { id: leadId },
        data: { telefone: conversa.telefone },
      })
    }

    // Histórico
    await registrarHistorico({
      leadId,
      tipoEvento: 'conversa_wa_vinculada',
      descricao: `Conversa WhatsApp do número ${conversa.telefone} vinculada manualmente${
        conversa.telefone !== lead.telefone && lead.telefone
          ? ` (número difere do cadastro: ${lead.telefone})`
          : ''
      }`,
      usuarioId,
    }, tx as any)
  })

  // Notificar vendedor via SSE
  if (lead.vendedorId) {
    sseHub.notificarUsuario(lead.vendedorId, {
      tipo: 'conversa_wa_vinculada',
      leadId,
      leadNome: lead.nome,
      telefone: conversa.telefone,
    })
  }

  invalidarCache()
  return { ok: true, leadId, leadNome: lead.nome }
}

export async function criarLeadEVincular(
  id: string,
  dados: {
    nome: string
    empresa?: string
    email?: string
    vendedorId: string
  },
  usuarioId: string,
  prisma: PrismaClient
) {
  const conversa = await prisma.whatsappConversa.findUnique({ where: { id } })
  if (!conversa) throw Object.assign(new Error('Conversa não encontrada'), { statusCode: 404 })
  if (conversa.leadId) throw Object.assign(new Error('Conversa já vinculada a um lead'), { statusCode: 409 })

  // Verificar vendedor existe
  const vendedor = await prisma.usuario.findUnique({
    where: { id: dados.vendedorId },
    select: { id: true, nome: true },
  })
  if (!vendedor) throw Object.assign(new Error('Vendedor não encontrado'), { statusCode: 404 })

  let leadId: string

  await prisma.$transaction(async (tx) => {
    // Criar lead
    const novoLead = await tx.lead.create({
      data: {
        nome: dados.nome,
        empresa: dados.empresa ?? null,
        email: dados.email ?? null,
        telefone: conversa.telefone,
        vendedorId: dados.vendedorId,
        status: 'NOVO',
        etapa: 'Novo Lead',
        criadoPorId: usuarioId,
      },
    })
    leadId = novoLead.id

    // Vincular conversa
    await tx.whatsappConversa.update({
      where: { id },
      data: { leadId: novoLead.id },
    })

    // Histórico
    await registrarHistorico({
      leadId: novoLead.id,
      tipoEvento: 'lead_criado_via_whatsapp',
      descricao: `Lead criado a partir da conversa WhatsApp do número ${conversa.telefone}`,
      usuarioId,
    }, tx as any)
  })

  // Notificar vendedor via SSE
  sseHub.notificarUsuario(dados.vendedorId, {
    tipo: 'conversa_wa_vinculada',
    leadId: leadId!,
    leadNome: dados.nome,
    telefone: conversa.telefone,
  })

  invalidarCache()
  return { ok: true, leadId: leadId! }
}

export async function arquivarConversa(
  id: string,
  arquivada: boolean,
  usuarioId: string,
  prisma: PrismaClient
) {
  const conversa = await prisma.whatsappConversa.findUnique({ where: { id } })
  if (!conversa) throw Object.assign(new Error('Conversa não encontrada'), { statusCode: 404 })
  if (conversa.leadId) throw Object.assign(new Error('Conversa já vinculada — não pode arquivar'), { statusCode: 409 })

  await prisma.whatsappConversa.update({
    where: { id },
    data: {
      arquivada,
      arquivadaEm: arquivada ? new Date() : null,
      arquivadaPorId: arquivada ? usuarioId : null,
    },
  })

  invalidarCache()
  return { ok: true, arquivada }
}
```

## src/modules/whatsapp/desconhecidas.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import {
  listarDesconhecidas,
  contarDesconhecidas,
  mensagensDesconhecida,
  vincularALead,
  criarLeadEVincular,
  arquivarConversa,
} from './desconhecidas.service'

const PERFIS_GESTAO = ['SUPERVISAO', 'CEO', 'ADMIN']

function assertGestao(perfil: string) {
  if (!PERFIS_GESTAO.includes(perfil)) {
    throw Object.assign(new Error('Acesso restrito à gestão'), { statusCode: 403 })
  }
}

export async function desconhecidasRoutes(fastify: FastifyInstance) {
  // GET /api/conversas/desconhecidas?arquivadas=true
  fastify.get(
    '/conversas/desconhecidas',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const { perfil } = (req as any).user
      assertGestao(perfil)

      const { arquivadas } = req.query as { arquivadas?: string }
      const incluirArquivadas = arquivadas === 'true'

      return reply.send(await listarDesconhecidas(incluirArquivadas, prisma))
    }
  )

  // GET /api/conversas/desconhecidas/contagem
  fastify.get(
    '/conversas/desconhecidas/contagem',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const { perfil } = (req as any).user
      assertGestao(perfil)
      const total = await contarDesconhecidas(prisma)
      return reply.send({ total })
    }
  )

  // GET /api/conversas/desconhecidas/:id/mensagens
  fastify.get(
    '/conversas/desconhecidas/:id/mensagens',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const { perfil } = (req as any).user
      assertGestao(perfil)
      const { id } = req.params as { id: string }
      return reply.send(await mensagensDesconhecida(id, prisma))
    }
  )

  // PATCH /api/conversas/desconhecidas/:id/vincular
  fastify.patch(
    '/conversas/desconhecidas/:id/vincular',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const { perfil, id: usuarioId } = (req as any).user
      assertGestao(perfil)
      const { id } = req.params as { id: string }
      const { leadId } = req.body as { leadId: string }
      if (!leadId) return reply.code(400).send({ error: 'leadId obrigatório' })
      const result = await vincularALead(id, leadId, usuarioId, prisma)
      return reply.send(result)
    }
  )

  // POST /api/conversas/desconhecidas/:id/criar-lead
  fastify.post(
    '/conversas/desconhecidas/:id/criar-lead',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const { perfil, id: usuarioId } = (req as any).user
      assertGestao(perfil)
      const { id } = req.params as { id: string }
      const body = req.body as {
        nome: string
        empresa?: string
        email?: string
        vendedorId: string
      }
      if (!body.nome || !body.vendedorId) {
        return reply.code(400).send({ error: 'nome e vendedorId são obrigatórios' })
      }
      const result = await criarLeadEVincular(id, body, usuarioId, prisma)
      return reply.code(201).send(result)
    }
  )

  // PATCH /api/conversas/desconhecidas/:id/arquivar
  fastify.patch(
    '/conversas/desconhecidas/:id/arquivar',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const { perfil, id: usuarioId } = (req as any).user
      assertGestao(perfil)
      const { id } = req.params as { id: string }
      const { arquivada } = req.body as { arquivada: boolean }
      if (typeof arquivada !== 'boolean') {
        return reply.code(400).send({ error: 'arquivada (boolean) obrigatório' })
      }
      const result = await arquivarConversa(id, arquivada, usuarioId, prisma)
      return reply.send(result)
    }
  )
}
```

## Registro no server.ts

```typescript
import { desconhecidasRoutes } from './modules/whatsapp/desconhecidas.routes'

// Adicionar ao registro da API
fastify.register(desconhecidasRoutes, { prefix: '/api' })
```

## Busca de Leads (reutilizar endpoint existente)

O frontend usará `GET /api/leads/buscar?q=<termo>` já implementado no Sprint 1.
Retorno já inclui: id, nome, empresa, telefone, vendedor.nome.
Nenhuma alteração necessária no backend.
