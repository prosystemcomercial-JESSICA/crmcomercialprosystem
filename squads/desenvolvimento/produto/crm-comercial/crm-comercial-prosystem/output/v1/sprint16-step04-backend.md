# Sprint 16 — Step 04 — Felipe Santos (Backend)
# Nutrição / Recontato Futuro — Implementação API

## Sem migração — todos os campos já existem no modelo Lead

## nutricao.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import { registrarHistorico } from '../../lib/historico'

export type NutricaoLead = {
  id: string
  nomeEmpresa: string
  motivoPerda: string | null
  dataRecontato: Date
  diasAtraso: number
  vendedorId: string
  vendedorNome: string
  segmento: string | null
  whatsapp: string | null
}

export type NutricaoSection = {
  vencidos:     NutricaoLead[]
  hoje:         NutricaoLead[]
  proximos:     NutricaoLead[]
  totalAlerta:  number
}

function startOfDay(d: Date): Date {
  const r = new Date(d); r.setHours(0,0,0,0); return r
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000)
}

export async function getNutricao(
  perfil: string,
  userId: string,
  vendedorIdFiltro: string | undefined,
  prisma: PrismaClient
): Promise<NutricaoSection> {
  const hoje = startOfDay(new Date())
  const em7dias = new Date(hoje); em7dias.setDate(em7dias.getDate() + 8)

  const where: any = {
    status: 'perdido',
    podeRecontatar: 'sim',
    dataRecontato: { not: null, lte: em7dias },
  }

  if (perfil === 'VENDEDOR') {
    where.vendedorId = userId
  } else if (vendedorIdFiltro) {
    where.vendedorId = vendedorIdFiltro
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { dataRecontato: 'asc' },
    select: {
      id: true, nomeEmpresa: true, motivoPerda: true, dataRecontato: true,
      vendedorId: true, segmento: true, whatsapp: true,
      vendedor: { select: { nome: true } },
    },
  })

  const mapper = (l: typeof leads[0]): NutricaoLead => ({
    id: l.id,
    nomeEmpresa: l.nomeEmpresa,
    motivoPerda: l.motivoPerda,
    dataRecontato: l.dataRecontato!,
    diasAtraso: diffDays(l.dataRecontato!, hoje),
    vendedorId: l.vendedorId ?? '',
    vendedorNome: l.vendedor?.nome ?? 'Sem vendedor',
    segmento: l.segmento,
    whatsapp: l.whatsapp,
  })

  const todayMs = hoje.getTime()
  const vencidos = leads.filter(l => startOfDay(l.dataRecontato!).getTime() < todayMs).map(mapper)
  const hojeArr  = leads.filter(l => startOfDay(l.dataRecontato!).getTime() === todayMs).map(mapper)
  const proximos = leads.filter(l => startOfDay(l.dataRecontato!).getTime() > todayMs).map(mapper)

  return {
    vencidos,
    hoje: hojeArr,
    proximos,
    totalAlerta: vencidos.length + hojeArr.length,
  }
}

export async function reativarLead(leadId: string, usuarioId: string, prisma: PrismaClient) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { status: true, vendedorId: true },
  })

  if (!lead || lead.status !== 'perdido') {
    throw Object.assign(new Error('Lead não está na fila de nutrição'), { statusCode: 409 })
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: 'ativo',
      etapaFunil: 'qualificacao',
      motivoPerda: null,
      podeRecontatar: null,
      dataRecontato: null,
      concorrenteEscolhido: null,
    },
  })

  await registrarHistorico({
    leadId,
    tipoEvento: 'status_alterado',
    descricao: 'Reativado da fila de nutrição',
    valorAnterior: 'perdido',
    valorNovo: 'ativo',
    usuarioId,
  }, prisma)
}

export async function reagendarRecontato(
  leadId: string,
  novaData: Date,
  usuarioId: string,
  prisma: PrismaClient
) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { status: true, dataRecontato: true },
  })

  if (!lead || lead.status !== 'perdido') {
    throw Object.assign(new Error('Lead não está na fila de nutrição'), { statusCode: 409 })
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { dataRecontato: novaData },
  })

  await registrarHistorico({
    leadId,
    tipoEvento: 'campo_alterado',
    descricao: 'Recontato reagendado',
    valorAnterior: lead.dataRecontato?.toISOString() ?? '',
    valorNovo: novaData.toISOString(),
    usuarioId,
  }, prisma)
}

export function gerarCsvNutricao(leads: NutricaoLead[]): string {
  const header = 'Empresa,Motivo Perda,Data Recontato,Vendedor,Dias Atraso'
  const rows = leads.map(l => [
    l.nomeEmpresa,
    l.motivoPerda ?? '',
    new Date(l.dataRecontato).toLocaleDateString('pt-BR'),
    l.vendedorNome,
    l.diasAtraso < 0 ? String(l.diasAtraso) : l.diasAtraso === 0 ? 'Hoje' : `+${l.diasAtraso}`,
  ].map(v => `"${v.replace(/"/g, '""')}"`).join(','))
  return [header, ...rows].join('\n')
}
```

## nutricao.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { z } from 'zod'
import { getNutricao, reativarLead, reagendarRecontato, gerarCsvNutricao } from './nutricao.service'

const reagendarSchema = z.object({
  dataRecontato: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
})

export async function nutricaoRoutes(fastify: FastifyInstance) {
  // GET /api/nutricao
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId  = (req as any).user.id
    const perfil  = (req as any).user.perfil
    const { vendedorId } = req.query as any

    const data = await getNutricao(perfil, userId, vendedorId, prisma)
    return reply.send(data)
  })

  // GET /api/nutricao/alerta — badge do sino (apenas vencidos + hoje do usuário)
  fastify.get('/alerta', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req as any).user.id
    const perfil = (req as any).user.perfil

    const data = await getNutricao(perfil, userId, undefined, prisma)
    return reply.send({
      total: data.totalAlerta,
      leads: [...data.vencidos, ...data.hoje].slice(0, 5).map(l => ({
        id: l.id,
        nomeEmpresa: l.nomeEmpresa,
        diasAtraso: l.diasAtraso,
      })),
    })
  })

  // POST /api/nutricao/:id/reativar
  fastify.post('/:id/reativar', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id }    = req.params as any
    const usuarioId = (req as any).user.id
    const perfil    = (req as any).user.perfil

    // VENDEDOR só pode reativar seu próprio lead
    if (perfil === 'VENDEDOR') {
      const lead = await prisma.lead.findUnique({ where: { id }, select: { vendedorId: true } })
      if (lead?.vendedorId !== usuarioId) return reply.code(403).send({ error: 'Acesso negado' })
    }

    await reativarLead(id, usuarioId, prisma)
    return reply.send({ ok: true })
  })

  // PATCH /api/nutricao/:id/reagendar
  fastify.patch('/:id/reagendar', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id }    = req.params as any
    const usuarioId = (req as any).user.id
    const perfil    = (req as any).user.perfil
    const { dataRecontato } = reagendarSchema.parse(req.body)

    if (perfil === 'VENDEDOR') {
      const lead = await prisma.lead.findUnique({ where: { id }, select: { vendedorId: true } })
      if (lead?.vendedorId !== usuarioId) return reply.code(403).send({ error: 'Acesso negado' })
    }

    const novaData = new Date(dataRecontato)
    if (isNaN(novaData.getTime())) return reply.code(400).send({ error: 'Data inválida' })

    await reagendarRecontato(id, novaData, usuarioId, prisma)
    return reply.send({ ok: true })
  })

  // GET /api/nutricao/export-csv
  fastify.get('/export-csv', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const userId  = (req as any).user.id
    const perfil  = (req as any).user.perfil
    const { vendedorId } = req.query as any

    const data = await getNutricao(perfil, userId, vendedorId, prisma)
    const todos = [...data.vencidos, ...data.hoje, ...data.proximos]
    const csv   = gerarCsvNutricao(todos)

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="nutricao-recontato.csv"')
      .send('﻿' + csv)
  })
}
```

## Registro no server.ts

```typescript
import { nutricaoRoutes } from './modules/nutricao/nutricao.routes'
fastify.register(nutricaoRoutes, { prefix: '/api/nutricao' })
```

## Extensão do cron job (alertas.ts existente)

```typescript
// Adicionar ao final do job existente:
import { getNutricao } from '../modules/nutricao/nutricao.service'

// Dentro do cron '0 * * * *':
const vendedores = await prisma.user.findMany({
  where: { perfil: 'VENDEDOR', status: 'ATIVO' },
  select: { id: true },
})

for (const v of vendedores) {
  const { totalAlerta, vencidos, hoje } = await getNutricao('VENDEDOR', v.id, undefined, prisma)
  if (totalAlerta > 0) {
    // emite para o eventEmitter de alertas existente
    alertaEmitter.emit(`alerta:${v.id}`, {
      tipo: 'nutricao',
      count: totalAlerta,
      leads: [...vencidos, ...hoje].slice(0, 5).map(l => l.nomeEmpresa),
    })
  }
}
```
