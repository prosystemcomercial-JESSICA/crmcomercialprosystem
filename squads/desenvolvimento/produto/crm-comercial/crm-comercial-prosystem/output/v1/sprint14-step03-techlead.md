# Sprint 14 — Step 03 — Daniel Mendes (Tech Lead)
# Previsão de Fechamento — Arquitetura

## Modelo Prisma

```prisma
model ProbabilidadeEtapa {
  id        String @id @default(cuid())
  etapa     String @unique  // chave: slug da etapa ('qualificacao', 'proposta-enviada', etc.)
  probabilidade Float       // 0.0 a 1.0 (ex: 0.55 = 55%)
  updatedAt DateTime @updatedAt

  @@map("probabilidades_etapa")
}
```

Nenhum campo novo em Lead — cálculos feitos on-the-fly via queries filtradas.

## Probabilidades padrão

```typescript
export const PROBABILIDADES_PADRAO: Record<string, number> = {
  'primeiro-contato':      0.05,
  'qualificacao':          0.15,
  'apresentacao-agendada': 0.30,
  'proposta-enviada':      0.55,
  'negociacao':            0.75,
}

// Etapas excluídas do forecast:
const ETAPAS_EXCLUIDAS = ['fechado', 'perdido']
```

## Lógica de atribuição ao mês

```typescript
function mesDoLead(lead: Pick<Lead, 'dataProximoContato'>, mesForecast: { mes: number; ano: number }): boolean {
  if (!lead.dataProximoContato) {
    // Sem data → atribui ao mês atual
    const hoje = new Date()
    return mesForecast.mes === hoje.getMonth() + 1 && mesForecast.ano === hoje.getFullYear()
  }
  const d = new Date(lead.dataProximoContato)
  return d.getMonth() + 1 === mesForecast.mes && d.getFullYear() === mesForecast.ano
}
```

## Estrutura do forecast por mês

```typescript
type ForecastMes = {
  mes: number
  ano: number
  fechado:  number   // MRR real (status = 'fechado' no período)
  provavel: number   // SUM(potencial × probabilidade)
  otimista: number   // SUM(potencial)
  metaMrr:  number   // SUM(MetaVendedor.mrr do mês)
  porVendedor: Array<{
    vendedorId: string
    nome: string
    fechado:  number
    provavel: number
    otimista: number
  }>
}

type PipelineLead = {
  id: string
  nomeEmpresa: string
  etapaFunil: string
  vendedorNome: string
  potencialMensalidade: number
  probabilidade: number
  valorPonderado: number
  dataProximoContato: Date | null
  mesForecast: { mes: number; ano: number }
}
```

## Query de forecast

```typescript
async function calcularForecast(
  meses: Array<{ mes: number; ano: number }>,
  prisma: PrismaClient,
  probs: Record<string, number>
): Promise<ForecastMes[]> {

  // Busca todos os leads ativos no pipeline (exceto fechado/perdido)
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

  return Promise.all(meses.map(async ({ mes, ano }) => {
    const { inicio, fim } = { inicio: new Date(ano, mes - 1, 1), fim: new Date(ano, mes, 0, 23, 59, 59) }

    // MRR já fechado no período
    const fechadoAgg = await prisma.lead.aggregate({
      where: { status: 'fechado', updatedAt: { gte: inicio, lte: fim } },
      _sum: { potencialMensalidade: true },
    })
    const fechadoPorVendedor = await prisma.lead.groupBy({
      by: ['vendedorId'],
      where: { status: 'fechado', updatedAt: { gte: inicio, lte: fim }, vendedorId: { not: null } },
      _sum: { potencialMensalidade: true },
    })

    // Meta do mês
    const metas = await prisma.metaVendedor.findMany({ where: { mes, ano }, select: { mrr: true } })
    const metaMrr = metas.reduce((acc, m) => acc + m.mrr, 0)

    // Leads do pipeline atribuídos a este mês
    const leadsDoMes = pipeline.filter(l => mesDoLead(l as any, { mes, ano }))

    let provavel = 0
    let otimista = 0
    const porVendedorMap = new Map<string, { nome: string; fechado: number; provavel: number; otimista: number }>()

    for (const lead of leadsDoMes) {
      const prob   = probs[lead.etapaFunil] ?? 0
      const pot    = lead.potencialMensalidade ?? 0
      const pond   = pot * prob
      provavel += pond
      otimista += pot

      const vid  = lead.vendedorId ?? 'sem-vendedor'
      const vnom = lead.vendedor?.nome ?? 'Sem vendedor'
      if (!porVendedorMap.has(vid)) porVendedorMap.set(vid, { nome: vnom, fechado: 0, provavel: 0, otimista: 0 })
      const v = porVendedorMap.get(vid)!
      v.provavel += pond
      v.otimista += pot
    }

    // Merge fechado por vendedor no map
    for (const f of fechadoPorVendedor) {
      const vid = f.vendedorId!
      if (!porVendedorMap.has(vid)) {
        const user = await prisma.user.findUnique({ where: { id: vid }, select: { nome: true } })
        porVendedorMap.set(vid, { nome: user?.nome ?? '', fechado: 0, provavel: 0, otimista: 0 })
      }
      porVendedorMap.get(vid)!.fechado += f._sum.potencialMensalidade ?? 0
    }

    return {
      mes, ano,
      fechado:  fechadoAgg._sum.potencialMensalidade ?? 0,
      provavel: Math.round(provavel * 100) / 100,
      otimista: Math.round(otimista * 100) / 100,
      metaMrr,
      porVendedor: [...porVendedorMap.entries()].map(([vendedorId, v]) => ({ vendedorId, ...v }))
        .sort((a, b) => b.provavel - a.provavel),
    }
  }))
}
```

## Pipeline detalhado (tabela de leads)

```typescript
async function getPipelineDetalhado(
  mesForecast: { mes: number; ano: number },
  prisma: PrismaClient,
  probs: Record<string, number>
): Promise<PipelineLead[]> {
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
    .filter(l => mesDoLead(l as any, mesForecast))
    .map(l => ({
      id: l.id,
      nomeEmpresa: l.nomeEmpresa,
      etapaFunil: l.etapaFunil,
      vendedorNome: l.vendedor?.nome ?? 'Sem vendedor',
      potencialMensalidade: l.potencialMensalidade ?? 0,
      probabilidade: probs[l.etapaFunil] ?? 0,
      valorPonderado: Math.round((l.potencialMensalidade ?? 0) * (probs[l.etapaFunil] ?? 0) * 100) / 100,
      dataProximoContato: l.dataProximoContato,
      mesForecast,
    }))
}
```

## API endpoints

```
GET  /api/forecast                     → 3 meses de forecast
GET  /api/forecast/pipeline?mes=5&ano=2026  → leads do pipeline do mês
GET  /api/forecast/probabilidades      → configuração atual
POST /api/forecast/probabilidades      → salvar nova configuração
GET  /api/forecast/export?fmt=csv|pdf
```

## Cache

- Forecast: node-cache 5min (invalidar ao fechar lead ou atualizar probabilidades)
- Probabilidades: node-cache 30min (muda raramente)

## Decisões

- **Sem modelo ForecastSnapshot:** cálculo on-the-fly + cache 5min; para 3 vendedores o volume é insignificante
- **ProbabilidadeEtapa com @unique(etapa):** upsert simples; não precisa de mes/ano pois as probabilidades são globais
- **dataProximoContato como âncora de mês:** se nulo, lead cai no mês atual — incentiva preenchimento da data
- **Merge de dados fechado + pipeline:** query separada para fechados (status = 'fechado') e outra para ativos; union no código evita raw SQL complexo
