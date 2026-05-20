# Sprint 14 — Step 04 — Felipe Santos (Backend)
# Previsão de Fechamento — Implementação API

## Migration

```sql
CREATE TABLE "probabilidades_etapa" (
  "id"            TEXT NOT NULL,
  "etapa"         TEXT NOT NULL,
  "probabilidade" DOUBLE PRECISION NOT NULL,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "probabilidades_etapa_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "probabilidades_etapa_etapa_key" UNIQUE ("etapa")
);

-- Seed com valores padrão
INSERT INTO "probabilidades_etapa" ("id", "etapa", "probabilidade", "updatedAt") VALUES
  (gen_random_uuid(), 'primeiro-contato',      0.05, NOW()),
  (gen_random_uuid(), 'qualificacao',          0.15, NOW()),
  (gen_random_uuid(), 'apresentacao-agendada', 0.30, NOW()),
  (gen_random_uuid(), 'proposta-enviada',      0.55, NOW()),
  (gen_random_uuid(), 'negociacao',            0.75, NOW());
```

## forecast.service.ts

```typescript
import NodeCache from 'node-cache'
import { PrismaClient } from '@prisma/client'

const cache = new NodeCache({ stdTTL: 300 })

const ETAPAS_EXCLUIDAS = ['fechado', 'perdido']

const PROBS_PADRAO: Record<string, number> = {
  'primeiro-contato':      0.05,
  'qualificacao':          0.15,
  'apresentacao-agendada': 0.30,
  'proposta-enviada':      0.55,
  'negociacao':            0.75,
}

async function getProbs(prisma: PrismaClient): Promise<Record<string, number>> {
  const cached = cache.get<Record<string, number>>('forecast:probs')
  if (cached) return cached

  const registros = await prisma.probabilidadeEtapa.findMany()
  const probs = registros.length > 0
    ? Object.fromEntries(registros.map(r => [r.etapa, r.probabilidade]))
    : PROBS_PADRAO

  cache.set('forecast:probs', probs, 1800) // 30min
  return probs
}

function resolverMeses(n = 3): Array<{ mes: number; ano: number }> {
  const hoje = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)
    return { mes: d.getMonth() + 1, ano: d.getFullYear() }
  })
}

function leadPertenceAoMes(dataProximoContato: Date | null, mes: number, ano: number, isFirst: boolean): boolean {
  if (!dataProximoContato) return isFirst // sem data → mês atual (isFirst = true para o 1º mês)
  const d = new Date(dataProximoContato)
  return d.getMonth() + 1 === mes && d.getFullYear() === ano
}

export async function getForecast(prisma: PrismaClient) {
  const cacheKey = 'forecast:3meses'
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const probs  = await getProbs(prisma)
  const meses  = resolverMeses(3)

  const pipeline = await prisma.lead.findMany({
    where: {
      status: 'ativo',
      etapaFunil: { notIn: ETAPAS_EXCLUIDAS },
      potencialMensalidade: { not: null, gt: 0 },
    },
    select: {
      id: true, nomeEmpresa: true, etapaFunil: true,
      potencialMensalidade: true, dataProximoContato: true,
      vendedorId: true,
      vendedor: { select: { id: true, nome: true } },
    },
  })

  const resultado = await Promise.all(meses.map(async ({ mes, ano }, idx) => {
    const inicio = new Date(ano, mes - 1, 1)
    const fim    = new Date(ano, mes, 0, 23, 59, 59)

    const [fechadoAgg, fechadoPorVend, metas] = await Promise.all([
      prisma.lead.aggregate({
        where: { status: 'fechado', updatedAt: { gte: inicio, lte: fim } },
        _sum: { potencialMensalidade: true },
      }),
      prisma.lead.groupBy({
        by: ['vendedorId'],
        where: { status: 'fechado', updatedAt: { gte: inicio, lte: fim }, vendedorId: { not: null } },
        _sum: { potencialMensalidade: true },
      }),
      prisma.metaVendedor.findMany({ where: { mes, ano }, select: { mrr: true } }),
    ])

    const metaMrr = metas.reduce((s, m) => s + m.mrr, 0)
    const leadsDoMes = pipeline.filter(l => leadPertenceAoMes(l.dataProximoContato, mes, ano, idx === 0))

    let provavel = 0; let otimista = 0
    const vMap = new Map<string, { nome: string; fechado: number; provavel: number; otimista: number }>()

    for (const l of leadsDoMes) {
      const prob = probs[l.etapaFunil] ?? 0
      const pot  = l.potencialMensalidade ?? 0
      provavel += pot * prob
      otimista += pot
      const vid = l.vendedorId ?? '_'
      const vnm = l.vendedor?.nome ?? 'Sem vendedor'
      if (!vMap.has(vid)) vMap.set(vid, { nome: vnm, fechado: 0, provavel: 0, otimista: 0 })
      const v = vMap.get(vid)!
      v.provavel += pot * prob
      v.otimista += pot
    }

    for (const f of fechadoPorVend) {
      const vid = f.vendedorId!
      const fval = f._sum.potencialMensalidade ?? 0
      if (!vMap.has(vid)) {
        const u = await prisma.user.findUnique({ where: { id: vid }, select: { nome: true } })
        vMap.set(vid, { nome: u?.nome ?? '', fechado: fval, provavel: 0, otimista: 0 })
      } else {
        vMap.get(vid)!.fechado += fval
      }
    }

    return {
      mes, ano,
      fechado:  Number((fechadoAgg._sum.potencialMensalidade ?? 0).toFixed(2)),
      provavel: Number(provavel.toFixed(2)),
      otimista: Number(otimista.toFixed(2)),
      metaMrr,
      porVendedor: [...vMap.entries()]
        .map(([vendedorId, v]) => ({ vendedorId, ...v }))
        .sort((a, b) => b.provavel - a.provavel),
    }
  }))

  cache.set(cacheKey, resultado)
  return resultado
}

export async function getPipelineDetalhado(
  mes: number, ano: number, prisma: PrismaClient
) {
  const probs = await getProbs(prisma)
  const hoje  = new Date()
  const isFirst = mes === hoje.getMonth() + 1 && ano === hoje.getFullYear()

  const leads = await prisma.lead.findMany({
    where: {
      status: 'ativo',
      etapaFunil: { notIn: ETAPAS_EXCLUIDAS },
      potencialMensalidade: { not: null, gt: 0 },
    },
    select: {
      id: true, nomeEmpresa: true, etapaFunil: true,
      potencialMensalidade: true, dataProximoContato: true,
      vendedor: { select: { nome: true } },
    },
    orderBy: { potencialMensalidade: 'desc' },
  })

  return leads
    .filter(l => leadPertenceAoMes(l.dataProximoContato, mes, ano, isFirst))
    .map(l => ({
      id: l.id,
      nomeEmpresa: l.nomeEmpresa,
      etapaFunil: l.etapaFunil,
      vendedorNome: l.vendedor?.nome ?? 'Sem vendedor',
      potencialMensalidade: l.potencialMensalidade,
      probabilidade: probs[l.etapaFunil] ?? 0,
      valorPonderado: Number(((l.potencialMensalidade ?? 0) * (probs[l.etapaFunil] ?? 0)).toFixed(2)),
      dataProximoContato: l.dataProximoContato,
    }))
}

export async function getProbabilidades(prisma: PrismaClient) {
  const probs = await getProbs(prisma)
  return Object.entries(probs).map(([etapa, probabilidade]) => ({ etapa, probabilidade }))
}

export async function salvarProbabilidades(
  configs: Array<{ etapa: string; probabilidade: number }>,
  prisma: PrismaClient
) {
  await Promise.all(configs.map(c =>
    prisma.probabilidadeEtapa.upsert({
      where: { etapa: c.etapa },
      update: { probabilidade: Math.max(0, Math.min(1, c.probabilidade)) },
      create: { etapa: c.etapa, probabilidade: Math.max(0, Math.min(1, c.probabilidade)) },
    })
  ))
  cache.del('forecast:probs')
  cache.del('forecast:3meses')
}
```

## forecast.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { requireRole } from '../../middleware/requireRole'
import { getForecast, getPipelineDetalhado, getProbabilidades, salvarProbabilidades } from './forecast.service'
import { gerarPdfForecast } from './forecast.pdf'
import { gerarCsvForecast } from './forecast.csv'
import { z } from 'zod'

const probSchema = z.object({
  probabilidades: z.array(z.object({
    etapa: z.string(),
    probabilidade: z.number().min(0).max(1),
  }))
})

export async function forecastRoutes(fastify: FastifyInstance) {
  const guard = [fastify.authenticate, requireRole(['SUPERVISAO', 'CEO', 'ADMIN'])]

  // GET /api/forecast
  fastify.get('/', { preHandler: guard }, async (_, reply) => {
    const data = await getForecast(prisma)
    return reply.send(data)
  })

  // GET /api/forecast/pipeline?mes=5&ano=2026
  fastify.get('/pipeline', { preHandler: guard }, async (req, reply) => {
    const { mes = new Date().getMonth() + 1, ano = new Date().getFullYear() } = req.query as any
    const data = await getPipelineDetalhado(Number(mes), Number(ano), prisma)
    return reply.send(data)
  })

  // GET /api/forecast/probabilidades
  fastify.get('/probabilidades', { preHandler: guard }, async (_, reply) => {
    const data = await getProbabilidades(prisma)
    return reply.send(data)
  })

  // POST /api/forecast/probabilidades
  fastify.post('/probabilidades', {
    preHandler: [fastify.authenticate, requireRole(['SUPERVISAO', 'ADMIN'])],
  }, async (req, reply) => {
    const { probabilidades } = probSchema.parse(req.body)
    await salvarProbabilidades(probabilidades, prisma)
    return reply.send({ ok: true })
  })

  // GET /api/forecast/export
  fastify.get('/export', { preHandler: guard }, async (req, reply) => {
    const { fmt = 'csv' } = req.query as any
    const forecast = await getForecast(prisma)

    if (fmt === 'pdf') {
      const pdf = await gerarPdfForecast(forecast)
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', 'attachment; filename="forecast.pdf"')
        .send(pdf)
    }

    const csv = gerarCsvForecast(forecast)
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="forecast.csv"')
      .send('﻿' + csv)
  })
}
```

## forecast.csv.ts

```typescript
export function gerarCsvForecast(forecast: any[]): string {
  const header = 'Mês/Ano,MRR Fechado (R$),MRR Provável (R$),MRR Otimista (R$),Meta MRR (R$)'
  const rows = forecast.map(f =>
    [`${String(f.mes).padStart(2,'0')}/${f.ano}`, f.fechado, f.provavel, f.otimista, f.metaMrr].join(',')
  )
  return [header, ...rows].join('\n')
}
```

## forecast.pdf.ts

```typescript
import ReactPDF, { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page:  { padding: 32 },
  title: { fontSize: 16, marginBottom: 12, fontWeight: 'bold' },
  row:   { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#e5e7eb' },
  cell:  { flex: 1, fontSize: 10 },
  hdr:   { flex: 1, fontSize: 10, fontWeight: 'bold', color: '#6b7280' },
})

export async function gerarPdfForecast(forecast: any[]) {
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Previsão de Fechamento</Text>
        <View style={styles.row}>
          {['Mês', 'Fechado', 'Provável', 'Otimista', 'Meta'].map(h => (
            <Text key={h} style={styles.hdr}>{h}</Text>
          ))}
        </View>
        {forecast.map((f, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.cell}>{f.mes}/{f.ano}</Text>
            <Text style={styles.cell}>R$ {f.fechado.toLocaleString('pt-BR')}</Text>
            <Text style={styles.cell}>R$ {f.provavel.toLocaleString('pt-BR')}</Text>
            <Text style={styles.cell}>R$ {f.otimista.toLocaleString('pt-BR')}</Text>
            <Text style={styles.cell}>R$ {f.metaMrr.toLocaleString('pt-BR')}</Text>
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
import { forecastRoutes } from './modules/forecast/forecast.routes'
fastify.register(forecastRoutes, { prefix: '/api/forecast' })
```
