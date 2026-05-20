# Sprint 13 — Step 04 — Felipe Santos (Backend)
# Ranking Comercial Avançado — Implementação API

## Migration

```sql
CREATE TABLE "metas_vendedor" (
  "id"          TEXT NOT NULL,
  "vendedorId"  TEXT NOT NULL,
  "mes"         INTEGER NOT NULL,
  "ano"         INTEGER NOT NULL,
  "fechamentos" INTEGER NOT NULL DEFAULT 0,
  "mrr"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "propostas"   INTEGER NOT NULL DEFAULT 0,
  "abordados"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "metas_vendedor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "metas_vendedor_vendedorId_mes_ano_key" UNIQUE ("vendedorId", "mes", "ano")
);
ALTER TABLE "metas_vendedor" ADD CONSTRAINT "metas_vendedor_vendedorId_fkey"
  FOREIGN KEY ("vendedorId") REFERENCES "users"("id") ON DELETE RESTRICT;
```

## ranking.service.ts

```typescript
import NodeCache from 'node-cache'
import { PrismaClient } from '@prisma/client'

const cache = new NodeCache({ stdTTL: 300 }) // 5min

export type PeriodoInput = 'mes-atual' | 'mes-anterior' | 'trimestre' | 'ano'

export type RankingRow = {
  posicao: number
  vendedorId: string
  nome: string
  fechamentos: number
  mrr: number
  propostas: number
  abordados: number
  taxaConversao: number
  ticketMedio: number
  mrrAnterior: number
  variacaoMrr: number  // percentual
  badges: string[]
  metas: { fechamentos: number; mrr: number; propostas: number; abordados: number } | null
}

function resolverPeriodo(periodo: PeriodoInput | { mes: number; ano: number }) {
  if (typeof periodo === 'object') {
    const { mes, ano } = periodo
    return { inicio: new Date(ano, mes - 1, 1), fim: new Date(ano, mes, 0, 23, 59, 59) }
  }
  const hoje = new Date()
  const ano  = hoje.getFullYear()
  const mes  = hoje.getMonth()
  if (periodo === 'mes-atual')    return { inicio: new Date(ano, mes, 1),     fim: new Date(ano, mes + 1, 0, 23, 59, 59) }
  if (periodo === 'mes-anterior') return { inicio: new Date(ano, mes - 1, 1), fim: new Date(ano, mes, 0, 23, 59, 59) }
  if (periodo === 'trimestre') {
    const t = Math.floor(mes / 3)
    return { inicio: new Date(ano, t * 3, 1), fim: new Date(ano, t * 3 + 3, 0, 23, 59, 59) }
  }
  return { inicio: new Date(ano, 0, 1), fim: new Date(ano, 11, 31, 23, 59, 59) }
}

export async function getRanking(periodo: PeriodoInput, prisma: PrismaClient): Promise<RankingRow[]> {
  const cacheKey = `ranking:${periodo}`
  const cached = cache.get<RankingRow[]>(cacheKey)
  if (cached) return cached

  const { inicio, fim } = resolverPeriodo(periodo)
  const { inicio: inicioAnt, fim: fimAnt } = resolverPeriodo('mes-anterior')

  const [fechAtual, fechAnterior, propostas, abordados, vendedores, todasMetas] = await Promise.all([
    prisma.lead.groupBy({
      by: ['vendedorId'],
      where: { status: 'fechado', updatedAt: { gte: inicio, lte: fim }, vendedorId: { not: null } },
      _count: { id: true },
      _sum: { potencialMensalidade: true },
    }),
    prisma.lead.groupBy({
      by: ['vendedorId'],
      where: { status: 'fechado', updatedAt: { gte: inicioAnt, lte: fimAnt }, vendedorId: { not: null } },
      _sum: { potencialMensalidade: true },
    }),
    prisma.proposta.groupBy({
      by: ['vendedorId'],
      where: { createdAt: { gte: inicio, lte: fim } },
      _count: { id: true },
    }),
    prisma.lead.groupBy({
      by: ['vendedorId'],
      where: { dataUltimoContato: { gte: inicio, lte: fim }, vendedorId: { not: null } },
      _count: { id: true },
    }),
    prisma.user.findMany({
      where: { perfil: { in: ['VENDEDOR', 'SUPERVISAO'] }, status: 'ATIVO' },
      select: { id: true, nome: true },
    }),
    prisma.metaVendedor.findMany({
      where: {
        mes: new Date().getMonth() + 1,
        ano: new Date().getFullYear(),
      },
    }),
  ])

  // Maior deal do mês para badge
  const maiorDeal = await prisma.lead.findFirst({
    where: { status: 'fechado', updatedAt: { gte: inicio, lte: fim } },
    orderBy: { potencialMensalidade: 'desc' },
    select: { vendedorId: true },
  })

  // Fecha semana — para badge "em chamas"
  const semana = new Date(); semana.setDate(semana.getDate() - 7)
  const fechSemana = await prisma.lead.groupBy({
    by: ['vendedorId'],
    where: { status: 'fechado', updatedAt: { gte: semana }, vendedorId: { not: null } },
    _count: { id: true },
  })

  const mapFech     = new Map(fechAtual.map(r => [r.vendedorId!, r]))
  const mapFechAnt  = new Map(fechAnterior.map(r => [r.vendedorId!, r]))
  const mapProp     = new Map(propostas.map(r => [r.vendedorId!, r]))
  const mapAbord    = new Map(abordados.map(r => [r.vendedorId!, r]))
  const mapMetas    = new Map(todasMetas.map(m => [m.vendedorId, m]))
  const mapSemana   = new Map(fechSemana.map(r => [r.vendedorId!, r._count.id]))

  const rows: Omit<RankingRow, 'posicao'>[] = vendedores.map(v => {
    const f   = mapFech.get(v.id)
    const fa  = mapFechAnt.get(v.id)
    const p   = mapProp.get(v.id)
    const ab  = mapAbord.get(v.id)
    const m   = mapMetas.get(v.id) ?? null

    const totalFech   = f?._count.id ?? 0
    const totalMrr    = f?._sum.potencialMensalidade ?? 0
    const totalProp   = p?._count.id ?? 0
    const totalAbord  = ab?._count.id ?? 0
    const mrrAnt      = fa?._sum.potencialMensalidade ?? 0
    const varMrr      = mrrAnt > 0 ? ((totalMrr - mrrAnt) / mrrAnt) * 100 : 0
    const conversao   = totalProp > 0 ? (totalFech / totalProp) * 100 : 0
    const ticket      = totalFech > 0 ? totalMrr / totalFech : 0

    const badges: string[] = []
    if (m && totalFech >= m.fechamentos) badges.push('meta-batida')
    if (totalMrr > mrrAnt) badges.push('crescimento')
    if (maiorDeal?.vendedorId === v.id) badges.push('maior-deal')
    if ((mapSemana.get(v.id) ?? 0) >= 3) badges.push('em-chamas')

    return {
      vendedorId: v.id, nome: v.nome,
      fechamentos: totalFech, mrr: totalMrr, propostas: totalProp, abordados: totalAbord,
      taxaConversao: conversao, ticketMedio: ticket,
      mrrAnterior: mrrAnt, variacaoMrr: varMrr,
      badges,
      metas: m ? { fechamentos: m.fechamentos, mrr: m.mrr, propostas: m.propostas, abordados: m.abordados } : null,
    }
  })

  const ranked = rows
    .sort((a, b) => b.mrr - a.mrr)
    .map((row, i) => {
      const r = { ...row, posicao: i + 1 }
      if (r.posicao === 1) r.badges.push('campiao')
      return r as RankingRow
    })

  cache.set(cacheKey, ranked)
  return ranked
}

export async function getMeuDesempenho(vendedorId: string, prisma: PrismaClient) {
  const ranking = await getRanking('mes-atual', prisma)
  const minha = ranking.find(r => r.vendedorId === vendedorId)
  const historico = await historico6Meses(vendedorId, prisma)
  return { ...minha, historico, totalNoTime: ranking.length }
}

async function historico6Meses(vendedorId: string, prisma: PrismaClient) {
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    return { mes: d.getMonth() + 1, ano: d.getFullYear() }
  })

  return Promise.all(meses.map(async (p) => {
    const { inicio, fim } = resolverPeriodo(p)
    const agg = await prisma.lead.aggregate({
      where: { vendedorId, status: 'fechado', updatedAt: { gte: inicio, lte: fim } },
      _sum: { potencialMensalidade: true },
      _count: { id: true },
    })
    return { ...p, mrr: agg._sum.potencialMensalidade ?? 0, fechamentos: agg._count.id }
  }))
}

export async function salvarMetas(
  metas: Array<{ vendedorId: string; mes: number; ano: number; fechamentos: number; mrr: number; propostas: number; abordados: number }>,
  prisma: PrismaClient
) {
  await Promise.all(metas.map(m =>
    prisma.metaVendedor.upsert({
      where: { vendedorId_mes_ano: { vendedorId: m.vendedorId, mes: m.mes, ano: m.ano } },
      update: { fechamentos: m.fechamentos, mrr: m.mrr, propostas: m.propostas, abordados: m.abordados },
      create: m,
    })
  ))
  cache.del(`ranking:mes-atual`)
}
```

## ranking.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { getRanking, getMeuDesempenho, salvarMetas, PeriodoInput } from './ranking.service'
import { requireRole } from '../../middleware/requireRole'
import { gerarPdfRanking } from './ranking.pdf'
import { gerarCsvRanking } from './ranking.csv'

const PERIODOS_VALIDOS: PeriodoInput[] = ['mes-atual', 'mes-anterior', 'trimestre', 'ano']

export async function rankingRoutes(fastify: FastifyInstance) {
  // GET /api/ranking
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const perfil = (req as any).user.perfil
    if (perfil === 'VENDEDOR') return reply.redirect('/api/ranking/meu-desempenho')

    const { periodo = 'mes-atual' } = req.query as any
    if (!PERIODOS_VALIDOS.includes(periodo)) return reply.code(400).send({ error: 'Período inválido' })

    const ranking = await getRanking(periodo, prisma)
    return reply.send({ periodo, ranking })
  })

  // GET /api/ranking/meu-desempenho
  fastify.get('/meu-desempenho', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const vendedorId = (req as any).user.id
    const dados = await getMeuDesempenho(vendedorId, prisma)
    return reply.send(dados)
  })

  // GET /api/ranking/metas
  fastify.get('/metas', { preHandler: [fastify.authenticate, requireRole(['SUPERVISAO', 'CEO', 'ADMIN'])] }, async (req, reply) => {
    const { mes = new Date().getMonth() + 1, ano = new Date().getFullYear() } = req.query as any
    const metas = await prisma.metaVendedor.findMany({
      where: { mes: Number(mes), ano: Number(ano) },
      include: { vendedor: { select: { id: true, nome: true } } },
    })
    const vendedores = await prisma.user.findMany({
      where: { perfil: { in: ['VENDEDOR', 'SUPERVISAO'] }, status: 'ATIVO' },
      select: { id: true, nome: true },
    })
    // Garante linha para cada vendedor mesmo sem meta cadastrada
    const result = vendedores.map(v => ({
      vendedorId: v.id,
      nome: v.nome,
      ...(metas.find(m => m.vendedorId === v.id) ?? { fechamentos: 0, mrr: 0, propostas: 0, abordados: 0 }),
    }))
    return reply.send({ mes: Number(mes), ano: Number(ano), metas: result })
  })

  // POST /api/ranking/metas
  fastify.post('/metas', { preHandler: [fastify.authenticate, requireRole(['SUPERVISAO', 'CEO', 'ADMIN'])] }, async (req, reply) => {
    const { mes, ano, metas } = req.body as any
    await salvarMetas(metas.map((m: any) => ({ ...m, mes: Number(mes), ano: Number(ano) })), prisma)
    return reply.send({ ok: true })
  })

  // GET /api/ranking/export
  fastify.get('/export', { preHandler: [fastify.authenticate, requireRole(['SUPERVISAO', 'CEO', 'ADMIN'])] }, async (req, reply) => {
    const { periodo = 'mes-atual', fmt = 'csv' } = req.query as any
    const ranking = await getRanking(periodo, prisma)

    if (fmt === 'pdf') {
      const pdf = await gerarPdfRanking(ranking, periodo)
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="ranking-${periodo}.pdf"`)
        .send(pdf)
    }

    const csv = gerarCsvRanking(ranking, periodo)
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="ranking-${periodo}.csv"`)
      .send('﻿' + csv)
  })
}
```

## ranking.csv.ts

```typescript
import { RankingRow } from './ranking.service'

export function gerarCsvRanking(ranking: RankingRow[], periodo: string): string {
  const header = 'Posição,Vendedor,MRR (R$),Fechamentos,Propostas,Taxa Conversão (%),Ticket Médio (R$),Variação MRR (%),Abordados'
  const rows = ranking.map(r =>
    [r.posicao, r.nome, r.mrr.toFixed(2), r.fechamentos, r.propostas,
     r.taxaConversao.toFixed(1), r.ticketMedio.toFixed(2), r.variacaoMrr.toFixed(1), r.abordados].join(',')
  )
  return [header, ...rows].join('\n')
}
```

## ranking.pdf.ts

```typescript
import ReactPDF, { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { RankingRow } from './ranking.service'

const styles = StyleSheet.create({
  page:  { padding: 32, fontFamily: 'Helvetica' },
  title: { fontSize: 18, marginBottom: 16, fontWeight: 'bold' },
  row:   { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e7eb', paddingVertical: 6 },
  cell:  { flex: 1, fontSize: 10 },
  header:{ fontSize: 10, fontWeight: 'bold', color: '#6b7280' },
})

export async function gerarPdfRanking(ranking: RankingRow[], periodo: string) {
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Ranking Comercial — {periodo}</Text>
        <View style={styles.row}>
          {['#', 'Vendedor', 'MRR', 'Fecham.', 'Propostas', 'Conversão'].map(h => (
            <Text key={h} style={[styles.cell, styles.header]}>{h}</Text>
          ))}
        </View>
        {ranking.map(r => (
          <View key={r.vendedorId} style={styles.row}>
            <Text style={styles.cell}>{r.posicao}</Text>
            <Text style={styles.cell}>{r.nome}</Text>
            <Text style={styles.cell}>R$ {r.mrr.toFixed(0)}</Text>
            <Text style={styles.cell}>{r.fechamentos}</Text>
            <Text style={styles.cell}>{r.propostas}</Text>
            <Text style={styles.cell}>{r.taxaConversao.toFixed(1)}%</Text>
          </View>
        ))}
      </Page>
    </Document>
  )
  return ReactPDF.renderToBuffer(doc)
}
```

## Registro no server.ts

```typescript
import { rankingRoutes } from './modules/ranking/ranking.routes'
fastify.register(rankingRoutes, { prefix: '/api/ranking' })
```
