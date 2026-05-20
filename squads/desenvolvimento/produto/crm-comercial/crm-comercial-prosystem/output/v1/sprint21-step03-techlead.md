# Sprint 21 — Step 03 — Daniel Mendes (Tech Lead)
# BI Avançado — Arquitetura

## Zero migrações de schema

Todas as queries usam modelos existentes:
- `Lead` — etapa, status, origem, vendedorId, createdAt, motivoPerda, concorrenteEscolhido
- `Proposta` — leadId, valor, status (enviada/aprovada/rejeitada), createdAt
- `Contrato` — leadId, propostaId, valorMensal, createdAt
- `HistoricoLead` — leadId, tipoEvento, createdAt (âncora de cohort)

## Tipos TypeScript

```typescript
export interface PeriodoFiltro {
  inicio: Date
  fim: Date
}

export interface KpiCard {
  label: string
  valor: number | string
  delta: number        // percentual vs mês anterior (ex: 12 = +12%)
  tipo: 'numero' | 'moeda' | 'percentual'
}

export interface EtapaFunil {
  etapa: string
  total: number
  conversaoProximaEtapa: number | null  // percentual, null se última etapa
}

export interface LinhaCohort {
  mes: string      // "Jan/26"
  leadsCriados: number
  pctProposta: number
  pctFechado: number
  pctContrato: number
}

export interface AnalisePerdas {
  porMotivo:      { motivo: string; total: number }[]
  porEtapa:       { etapa: string; total: number }[]
  porConcorrente: { concorrente: string; total: number }[]
}

export interface LinhaOrigem {
  origem: string
  total: number
  convertidos: number
  taxaConversao: number
  receitaGerada: number
}
```

## Estratégia de cache

```typescript
import NodeCache from 'node-cache'
const biCache = new NodeCache({ stdTTL: 600 }) // 10min

function cacheKey(endpoint: string, params: object): string {
  return `${endpoint}:${JSON.stringify(params)}`
}
```

## Queries principais

### KPIs

```typescript
async function getKpis(periodo: PeriodoFiltro, vendedorId: string | null, prisma: PrismaClient) {
  const where = vendedorId ? { vendedorId } : {}
  const wherePeriodo = { ...where, createdAt: { gte: periodo.inicio, lte: periodo.fim } }

  // Mês anterior para delta
  const duracao = periodo.fim.getTime() - periodo.inicio.getTime()
  const periodoAnterior = {
    inicio: new Date(periodo.inicio.getTime() - duracao),
    fim:    new Date(periodo.fim.getTime() - duracao),
  }
  const whereAnterior = { ...where, createdAt: { gte: periodoAnterior.inicio, lte: periodoAnterior.fim } }

  const [
    leadsAtivos, leadsAnt,
    propostas,   propostasAnt,
    contratos,   contratosAnt,
  ] = await Promise.all([
    prisma.lead.count({ where: { ...where, status: 'ativo' } }),
    prisma.lead.count({ where: { ...where, status: 'ativo', createdAt: { lte: periodoAnterior.fim } } }),
    prisma.proposta.count({ where: wherePeriodo }),
    prisma.proposta.count({ where: whereAnterior }),
    prisma.contrato.count({ where: wherePeriodo }),
    prisma.contrato.count({ where: whereAnterior }),
  ])

  const [receitaAgg, receitaAntAgg] = await Promise.all([
    prisma.contrato.aggregate({ where: wherePeriodo, _sum: { valorMensal: true } }),
    prisma.contrato.aggregate({ where: whereAnterior, _sum: { valorMensal: true } }),
  ])

  const receita    = receitaAgg._sum.valorMensal ?? 0
  const receitaAnt = receitaAntAgg._sum.valorMensal ?? 0

  const totalLeadsPeriodo = await prisma.lead.count({ where: wherePeriodo })
  const taxaConv  = totalLeadsPeriodo > 0 ? (contratos / totalLeadsPeriodo) * 100 : 0
  const taxaAnt   = totalLeadsPeriodo > 0 ? (contratosAnt / totalLeadsPeriodo) * 100 : 0

  const ticketMedio    = contratos > 0 ? receita / contratos : 0
  const ticketAnt      = contratosAnt > 0 ? receitaAnt / contratosAnt : 0

  const delta = (atual: number, anterior: number) =>
    anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0

  return [
    { label: 'Leads Ativos',       valor: leadsAtivos,  delta: delta(leadsAtivos, leadsAnt),    tipo: 'numero' },
    { label: 'Propostas Enviadas',  valor: propostas,    delta: delta(propostas, propostasAnt),   tipo: 'numero' },
    { label: 'Contratos Fechados',  valor: contratos,    delta: delta(contratos, contratosAnt),   tipo: 'numero' },
    { label: 'Receita Mensal',      valor: receita,      delta: delta(receita, receitaAnt),       tipo: 'moeda' },
    { label: 'Taxa de Conversão',   valor: taxaConv,     delta: taxaConv - taxaAnt,               tipo: 'percentual' },
    { label: 'Ticket Médio',        valor: ticketMedio,  delta: delta(ticketMedio, ticketAnt),    tipo: 'moeda' },
  ] satisfies KpiCard[]
}
```

### Funil

```typescript
const ETAPAS_ORDEM = ['qualificacao', 'proposta', 'negociacao', 'fechado']

async function getFunil(periodo: PeriodoFiltro, vendedorId: string | null, prisma: PrismaClient) {
  const where: any = {}
  if (vendedorId) where.vendedorId = vendedorId

  const contagens = await prisma.lead.groupBy({
    by: ['etapa'],
    where: { ...where, createdAt: { gte: periodo.inicio, lte: periodo.fim } },
    _count: true,
  })

  const mapa = Object.fromEntries(contagens.map((c) => [c.etapa, c._count]))
  const etapas = ETAPAS_ORDEM.map((e) => ({ etapa: e, total: mapa[e] ?? 0 }))

  return etapas.map((e, i) => ({
    ...e,
    conversaoProximaEtapa: i < etapas.length - 1 && etapas[i].total > 0
      ? (etapas[i + 1].total / etapas[i].total) * 100
      : null,
  })) satisfies EtapaFunil[]
}
```

### Cohort

```typescript
async function getCohort(meses: number, prisma: PrismaClient): Promise<LinhaCohort[]> {
  const resultado: LinhaCohort[] = []
  const agora = new Date()

  for (let m = meses - 1; m >= 0; m--) {
    const inicio = new Date(agora.getFullYear(), agora.getMonth() - m, 1)
    const fim    = new Date(agora.getFullYear(), agora.getMonth() - m + 1, 0, 23, 59, 59)

    const leads = await prisma.lead.findMany({
      where: { createdAt: { gte: inicio, lte: fim } },
      select: { id: true },
    })
    const ids = leads.map((l) => l.id)
    const total = ids.length

    if (total === 0) {
      resultado.push({ mes: formatMes(inicio), leadsCriados: 0, pctProposta: 0, pctFechado: 0, pctContrato: 0 })
      continue
    }

    const [comProposta, comFechado, comContrato] = await Promise.all([
      prisma.proposta.count({ where: { leadId: { in: ids } } }),
      prisma.lead.count({ where: { id: { in: ids }, etapa: 'fechado' } }),
      prisma.contrato.count({ where: { leadId: { in: ids } } }),
    ])

    resultado.push({
      mes: formatMes(inicio),
      leadsCriados: total,
      pctProposta:  Math.round((comProposta / total) * 100),
      pctFechado:   Math.round((comFechado  / total) * 100),
      pctContrato:  Math.round((comContrato / total) * 100),
    })
  }

  return resultado
}

function formatMes(d: Date): string {
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}
```

### Perdas

```typescript
async function getPerdas(periodo: PeriodoFiltro, vendedorId: string | null, prisma: PrismaClient) {
  const where: any = {
    status: 'perdido',
    updatedAt: { gte: periodo.inicio, lte: periodo.fim },
  }
  if (vendedorId) where.vendedorId = vendedorId

  const leads = await prisma.lead.findMany({
    where,
    select: { motivoPerda: true, etapa: true, concorrenteEscolhido: true },
  })

  return {
    porMotivo:      agrupar(leads, 'motivoPerda',        'Não informado'),
    porEtapa:       agrupar(leads, 'etapa',              'Não informado'),
    porConcorrente: agrupar(leads, 'concorrenteEscolhido','Não informado'),
  } satisfies AnalisePerdas
}

function agrupar(arr: any[], campo: string, fallback: string) {
  const mapa = new Map<string, number>()
  for (const item of arr) {
    const key = item[campo] ?? fallback
    mapa.set(key, (mapa.get(key) ?? 0) + 1)
  }
  return Array.from(mapa.entries())
    .map(([k, v]) => ({ [campo === 'etapa' ? 'etapa' : campo === 'motivoPerda' ? 'motivo' : 'concorrente']: k, total: v }))
    .sort((a, b) => b.total - a.total)
}
```

### Origens

```typescript
async function getOrigens(periodo: PeriodoFiltro, prisma: PrismaClient): Promise<LinhaOrigem[]> {
  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: periodo.inicio, lte: periodo.fim } },
    select: { id: true, origem: true },
  })

  const origemIds = new Map<string, string[]>()
  for (const l of leads) {
    const o = l.origem ?? 'Sem origem'
    if (!origemIds.has(o)) origemIds.set(o, [])
    origemIds.get(o)!.push(l.id)
  }

  const resultado: LinhaOrigem[] = []
  for (const [origem, ids] of origemIds.entries()) {
    const [contratos, receitaAgg] = await Promise.all([
      prisma.contrato.count({ where: { leadId: { in: ids } } }),
      prisma.contrato.aggregate({ where: { leadId: { in: ids } }, _sum: { valorMensal: true } }),
    ])
    resultado.push({
      origem,
      total:          ids.length,
      convertidos:    contratos,
      taxaConversao:  ids.length > 0 ? (contratos / ids.length) * 100 : 0,
      receitaGerada:  receitaAgg._sum.valorMensal ?? 0,
    })
  }

  return resultado.sort((a, b) => b.total - a.total)
}
```

## API Endpoints

```
GET /api/bi/kpis        ?inicio&fim&vendedorId
GET /api/bi/funil       ?inicio&fim&vendedorId
GET /api/bi/cohort      ?meses (default 6)
GET /api/bi/perdas      ?inicio&fim&vendedorId
GET /api/bi/origens     ?inicio&fim
GET /api/bi/exportar    ?secao&inicio&fim&vendedorId&formato (xlsx|pdf)
```

## Decisões

- **Zero migrations:** todos os dados já existem no schema atual; BI é puramente analítico
- **Cache 10min por combinação de filtros:** chave = endpoint + JSON dos params; evita re-query a cada troca de aba
- **Cohort com queries por mês em loop:** N = 6 iterações; cada iteração faz 4 queries (leads + proposta + fechado + contrato) em Promise.all → aceitável para volume atual
- **Campo `origem` em Lead:** verificado no schema (Sprint 1); se não existir, todas as linhas retornam "Sem origem" — sem breaking change
- **Exportação server-side:** Excel via `xlsx`, PDF via `@react-pdf/renderer` com componentes próprios; ambos já instalados
- **Delta vs mês anterior:** calculado dinamicamente usando o mesmo período deslocado para trás; sem tabela de snapshots mensais
