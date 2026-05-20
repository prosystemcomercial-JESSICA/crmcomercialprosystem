# Sprint 21 — Step 04 — Felipe Santos (Backend)
# BI Avançado — Implementação API

## src/modules/bi/bi.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import NodeCache from 'node-cache'

const cache = new NodeCache({ stdTTL: 600 })

function cacheKey(fn: string, params: object) {
  return `bi:${fn}:${JSON.stringify(params)}`
}

function parsePeriodo(inicio: string, fim: string) {
  return {
    inicio: new Date(inicio),
    fim: new Date(fim + 'T23:59:59.999Z'),
  }
}

// ─────────────────────────────── KPIs ───────────────────────────────

export async function getKpis(
  inicio: string, fim: string, vendedorId: string | null,
  prisma: PrismaClient
) {
  const key = cacheKey('kpis', { inicio, fim, vendedorId })
  if (cache.has(key)) return cache.get(key)

  const { inicio: dtInicio, fim: dtFim } = parsePeriodo(inicio, fim)
  const duracao = dtFim.getTime() - dtInicio.getTime()
  const dtInicioAnt = new Date(dtInicio.getTime() - duracao)
  const dtFimAnt    = new Date(dtFim.getTime() - duracao)

  const vWhere: any = vendedorId ? { vendedorId } : {}
  const pWhere  = { ...vWhere, createdAt: { gte: dtInicio, lte: dtFim } }
  const aWhere  = { ...vWhere, createdAt: { gte: dtInicioAnt, lte: dtFimAnt } }

  const [
    leadsAtivos, leadsAnt,
    propostas, propostasAnt,
    contratos, contratosAnt,
    recAgg, recAntAgg,
    totalPeriodo,
  ] = await Promise.all([
    prisma.lead.count({ where: { ...vWhere, status: 'ativo' } }),
    prisma.lead.count({ where: { ...vWhere, status: 'ativo', createdAt: { lte: dtFimAnt } } }),
    prisma.proposta.count({ where: pWhere }),
    prisma.proposta.count({ where: aWhere }),
    prisma.contrato.count({ where: pWhere }),
    prisma.contrato.count({ where: aWhere }),
    prisma.contrato.aggregate({ where: pWhere, _sum: { valorMensal: true } }),
    prisma.contrato.aggregate({ where: aWhere, _sum: { valorMensal: true } }),
    prisma.lead.count({ where: pWhere }),
  ])

  const receita    = recAgg._sum.valorMensal    ?? 0
  const receitaAnt = recAntAgg._sum.valorMensal ?? 0
  const taxaConv   = totalPeriodo > 0 ? (contratos / totalPeriodo) * 100 : 0
  const taxaAnt    = totalPeriodo > 0 ? (contratosAnt / totalPeriodo) * 100 : 0
  const ticket     = contratos > 0 ? receita / contratos : 0
  const ticketAnt  = contratosAnt > 0 ? receitaAnt / contratosAnt : 0
  const delta = (a: number, b: number) => b > 0 ? ((a - b) / b) * 100 : 0

  const result = [
    { label: 'Leads Ativos',       valor: leadsAtivos, delta: delta(leadsAtivos, leadsAnt),   tipo: 'numero' },
    { label: 'Propostas Enviadas',  valor: propostas,   delta: delta(propostas, propostasAnt),  tipo: 'numero' },
    { label: 'Contratos Fechados',  valor: contratos,   delta: delta(contratos, contratosAnt),  tipo: 'numero' },
    { label: 'Receita Mensal',      valor: receita,     delta: delta(receita, receitaAnt),      tipo: 'moeda' },
    { label: 'Taxa de Conversão',   valor: taxaConv,    delta: taxaConv - taxaAnt,              tipo: 'percentual' },
    { label: 'Ticket Médio',        valor: ticket,      delta: delta(ticket, ticketAnt),        tipo: 'moeda' },
  ]

  cache.set(key, result)
  return result
}

// ─────────────────────────────── Funil ───────────────────────────────

const ETAPAS = ['qualificacao', 'proposta', 'negociacao', 'fechado']

export async function getFunil(
  inicio: string, fim: string, vendedorId: string | null,
  prisma: PrismaClient
) {
  const key = cacheKey('funil', { inicio, fim, vendedorId })
  if (cache.has(key)) return cache.get(key)

  const { inicio: dtI, fim: dtF } = parsePeriodo(inicio, fim)
  const where: any = { createdAt: { gte: dtI, lte: dtF } }
  if (vendedorId) where.vendedorId = vendedorId

  const contagens = await prisma.lead.groupBy({ by: ['etapa'], where, _count: true })
  const mapa = Object.fromEntries(contagens.map((c) => [c.etapa, c._count]))
  const etapas = ETAPAS.map((e) => ({ etapa: e, total: mapa[e] ?? 0 }))

  const result = etapas.map((e, i) => ({
    ...e,
    conversaoProximaEtapa: i < etapas.length - 1 && etapas[i].total > 0
      ? Math.round((etapas[i + 1].total / etapas[i].total) * 100)
      : null,
  }))

  cache.set(key, result)
  return result
}

// ─────────────────────────────── Cohort ───────────────────────────────

export async function getCohort(meses: number, prisma: PrismaClient) {
  const key = cacheKey('cohort', { meses })
  if (cache.has(key)) return cache.get(key)

  const agora = new Date()
  const resultado = []

  for (let m = meses - 1; m >= 0; m--) {
    const inicio = new Date(agora.getFullYear(), agora.getMonth() - m, 1)
    const fim    = new Date(agora.getFullYear(), agora.getMonth() - m + 1, 0, 23, 59, 59)

    const leads = await prisma.lead.findMany({
      where: { createdAt: { gte: inicio, lte: fim } },
      select: { id: true },
    })
    const ids = leads.map((l) => l.id)
    const total = ids.length

    const mes = inicio.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })

    if (total === 0) {
      resultado.push({ mes, leadsCriados: 0, pctProposta: 0, pctFechado: 0, pctContrato: 0 })
      continue
    }

    const [comProposta, comFechado, comContrato] = await Promise.all([
      prisma.proposta.count({ where: { leadId: { in: ids } } }),
      prisma.lead.count({ where: { id: { in: ids }, etapa: 'fechado' } }),
      prisma.contrato.count({ where: { leadId: { in: ids } } }),
    ])

    resultado.push({
      mes,
      leadsCriados: total,
      pctProposta:  Math.round((comProposta / total) * 100),
      pctFechado:   Math.round((comFechado  / total) * 100),
      pctContrato:  Math.round((comContrato / total) * 100),
    })
  }

  cache.set(key, resultado)
  return resultado
}

// ─────────────────────────────── Perdas ───────────────────────────────

export async function getPerdas(
  inicio: string, fim: string, vendedorId: string | null,
  prisma: PrismaClient
) {
  const key = cacheKey('perdas', { inicio, fim, vendedorId })
  if (cache.has(key)) return cache.get(key)

  const { inicio: dtI, fim: dtF } = parsePeriodo(inicio, fim)
  const where: any = { status: 'perdido', updatedAt: { gte: dtI, lte: dtF } }
  if (vendedorId) where.vendedorId = vendedorId

  const leads = await prisma.lead.findMany({
    where,
    select: { motivoPerda: true, etapa: true, concorrenteEscolhido: true },
  })

  function agrupa(campo: string, fallback = 'Não informado') {
    const m = new Map<string, number>()
    for (const l of leads) {
      const k = (l as any)[campo] ?? fallback
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return [...m.entries()].map(([k, v]) => ({ nome: k, total: v })).sort((a, b) => b.total - a.total)
  }

  const result = {
    porMotivo:      agrupa('motivoPerda'),
    porEtapa:       agrupa('etapa'),
    porConcorrente: agrupa('concorrenteEscolhido'),
  }

  cache.set(key, result)
  return result
}

// ─────────────────────────────── Origens ───────────────────────────────

export async function getOrigens(inicio: string, fim: string, prisma: PrismaClient) {
  const key = cacheKey('origens', { inicio, fim })
  if (cache.has(key)) return cache.get(key)

  const { inicio: dtI, fim: dtF } = parsePeriodo(inicio, fim)
  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: dtI, lte: dtF } },
    select: { id: true, origem: true },
  })

  const grupos = new Map<string, string[]>()
  for (const l of leads) {
    const o = (l as any).origem ?? 'Sem origem'
    if (!grupos.has(o)) grupos.set(o, [])
    grupos.get(o)!.push(l.id)
  }

  const resultado = await Promise.all(
    [...grupos.entries()].map(async ([origem, ids]) => {
      const [convertidos, recAgg] = await Promise.all([
        prisma.contrato.count({ where: { leadId: { in: ids } } }),
        prisma.contrato.aggregate({ where: { leadId: { in: ids } }, _sum: { valorMensal: true } }),
      ])
      return {
        origem,
        total: ids.length,
        convertidos,
        taxaConversao: ids.length > 0 ? Math.round((convertidos / ids.length) * 1000) / 10 : 0,
        receitaGerada: recAgg._sum.valorMensal ?? 0,
      }
    })
  )

  const sorted = resultado.sort((a, b) => b.total - a.total)
  cache.set(key, sorted)
  return sorted
}

// ─────────────────────────────── Exportar ───────────────────────────────

export async function gerarExcelBI(
  secao: string, inicio: string, fim: string,
  vendedorId: string | null, prisma: PrismaClient
): Promise<Buffer> {
  const XLSX = await import('xlsx')
  let dados: any[] = []

  if (secao === 'funil')   dados = (await getFunil(inicio, fim, vendedorId, prisma)) as any[]
  if (secao === 'perdas') {
    const p = await getPerdas(inicio, fim, vendedorId, prisma) as any
    dados = [
      ...p.porMotivo.map((r: any) => ({ tipo: 'Motivo', ...r })),
      ...p.porEtapa.map((r: any)  => ({ tipo: 'Etapa', ...r })),
      ...p.porConcorrente.map((r: any) => ({ tipo: 'Concorrente', ...r })),
    ]
  }
  if (secao === 'origens') dados = (await getOrigens(inicio, fim, prisma)) as any[]
  if (secao === 'cohort')  dados = (await getCohort(6, prisma)) as any[]
  if (secao === 'kpis')    dados = (await getKpis(inicio, fim, vendedorId, prisma)) as any[]

  const ws = XLSX.utils.json_to_sheet(dados)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, secao)
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}
```

## src/modules/bi/bi.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import {
  getKpis, getFunil, getCohort, getPerdas, getOrigens, gerarExcelBI,
} from './bi.service'

const PERFIS_BI = ['SUPERVISAO', 'CEO', 'ADMIN']

function defaultPeriodo() {
  const agora = new Date()
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().slice(0, 10)
  const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { inicio, fim }
}

export async function biRoutes(fastify: FastifyInstance) {

  function guard(req: any, reply: any) {
    if (!PERFIS_BI.includes(req.user.perfil)) {
      reply.code(403).send({ error: 'Acesso restrito — BI Avançado' })
      return false
    }
    return true
  }

  fastify.get('/bi/kpis', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    if (!guard(req as any, reply)) return
    const { inicio, fim, vendedorId } = { ...defaultPeriodo(), ...(req.query as any) }
    return reply.send(await getKpis(inicio, fim, vendedorId ?? null, prisma))
  })

  fastify.get('/bi/funil', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    if (!guard(req as any, reply)) return
    const { inicio, fim, vendedorId } = { ...defaultPeriodo(), ...(req.query as any) }
    return reply.send(await getFunil(inicio, fim, vendedorId ?? null, prisma))
  })

  fastify.get('/bi/cohort', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    if (!guard(req as any, reply)) return
    const { meses = '6' } = req.query as any
    return reply.send(await getCohort(Number(meses), prisma))
  })

  fastify.get('/bi/perdas', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    if (!guard(req as any, reply)) return
    const { inicio, fim, vendedorId } = { ...defaultPeriodo(), ...(req.query as any) }
    return reply.send(await getPerdas(inicio, fim, vendedorId ?? null, prisma))
  })

  fastify.get('/bi/origens', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    if (!guard(req as any, reply)) return
    const { inicio, fim } = { ...defaultPeriodo(), ...(req.query as any) }
    return reply.send(await getOrigens(inicio, fim, prisma))
  })

  fastify.get('/bi/exportar', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    if (!guard(req as any, reply)) return
    const { secao, inicio, fim, vendedorId, formato = 'xlsx' } = {
      ...defaultPeriodo(),
      ...(req.query as any),
    }

    if (formato === 'xlsx') {
      const buffer = await gerarExcelBI(secao, inicio, fim, vendedorId ?? null, prisma)
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="bi-${secao}-${inicio}.xlsx"`)
        .send(buffer)
    }

    // PDF: retorna dados brutos; frontend renderiza com @react-pdf/renderer
    return reply.code(501).send({ error: 'PDF gerado no frontend' })
  })
}
```

## Registro no server.ts

```typescript
import { biRoutes } from './modules/bi/bi.routes'
fastify.register(biRoutes)
```
