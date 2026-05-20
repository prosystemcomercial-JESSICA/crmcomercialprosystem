# Sprint 13 — Step 03 — Daniel Mendes (Tech Lead)
# Ranking Comercial Avançado — Arquitetura

## Novo modelo Prisma

```prisma
model MetaVendedor {
  id           String @id @default(cuid())
  vendedorId   String
  vendedor     User   @relation(fields: [vendedorId], references: [id])
  mes          Int    // 1-12
  ano          Int
  fechamentos  Int    @default(0)
  mrr          Float  @default(0)
  propostas    Int    @default(0)
  abordados    Int    @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([vendedorId, mes, ano])
  @@map("metas_vendedor")
}
```

Nenhum campo novo no modelo Lead — ranking é 100% calculado via queries agregadas.

## Queries de ranking

```typescript
// Ranking do período — query principal
async function calcularRanking(
  periodo: PeriodoInput,
  prisma: PrismaClient
): Promise<RankingRow[]> {
  const { inicio, fim } = resolverPeriodo(periodo)

  // Fechamentos e MRR do período
  const fechamentos = await prisma.lead.groupBy({
    by: ['vendedorId'],
    where: {
      status: 'fechado',
      updatedAt: { gte: inicio, lte: fim },
      vendedorId: { not: null },
    },
    _count: { id: true },
    _sum: { potencialMensalidade: true },
  })

  // Propostas enviadas no período
  const propostas = await prisma.proposta.groupBy({
    by: ['vendedorId'],
    where: { createdAt: { gte: inicio, lte: fim } },
    _count: { id: true },
  })

  // Leads abordados (dataUltimoContato no período)
  const abordados = await prisma.lead.groupBy({
    by: ['vendedorId'],
    where: {
      dataUltimoContato: { gte: inicio, lte: fim },
      vendedorId: { not: null },
    },
    _count: { id: true },
  })

  // Busca todos os vendedores para incluir zeros
  const vendedores = await prisma.user.findMany({
    where: { perfil: { in: ['VENDEDOR', 'SUPERVISAO'] }, status: 'ATIVO' },
    select: { id: true, nome: true },
  })

  // Merge
  const mapFech   = new Map(fechamentos.map(r => [r.vendedorId!, r]))
  const mapProp   = new Map(propostas.map(r => [r.vendedorId!, r]))
  const mapAbord  = new Map(abordados.map(r => [r.vendedorId!, r]))

  return vendedores.map(v => {
    const f  = mapFech.get(v.id)
    const p  = mapProp.get(v.id)
    const ab = mapAbord.get(v.id)
    const totalFech = f?._count.id ?? 0
    const totalMrr  = f?._sum.potencialMensalidade ?? 0
    const totalProp = p?._count.id ?? 0
    const totalAbord = ab?._count.id ?? 0
    const conversao = totalProp > 0 ? (totalFech / totalProp) * 100 : 0
    const ticket     = totalFech > 0 ? totalMrr / totalFech : 0
    return { vendedorId: v.id, nome: v.nome, fechamentos: totalFech, mrr: totalMrr, propostas: totalProp, abordados: totalAbord, taxaConversao: conversao, ticketMedio: ticket }
  }).sort((a, b) => b.mrr - a.mrr)
    .map((row, i) => ({ ...row, posicao: i + 1 }))
}
```

## Resolução de período

```typescript
type PeriodoInput = 'mes-atual' | 'mes-anterior' | 'trimestre' | 'ano'

function resolverPeriodo(periodo: PeriodoInput): { inicio: Date; fim: Date } {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth() // 0-based

  if (periodo === 'mes-atual') {
    return { inicio: new Date(ano, mes, 1), fim: new Date(ano, mes + 1, 0, 23, 59, 59) }
  }
  if (periodo === 'mes-anterior') {
    return { inicio: new Date(ano, mes - 1, 1), fim: new Date(ano, mes, 0, 23, 59, 59) }
  }
  if (periodo === 'trimestre') {
    const trimestre = Math.floor(mes / 3)
    return { inicio: new Date(ano, trimestre * 3, 1), fim: new Date(ano, trimestre * 3 + 3, 0, 23, 59, 59) }
  }
  // ano
  return { inicio: new Date(ano, 0, 1), fim: new Date(ano, 11, 31, 23, 59, 59) }
}
```

## Cálculo de badges

```typescript
type Badge = 'campiao' | 'meta-batida' | 'maior-deal' | 'em-chamas' | 'crescimento'

async function calcularBadges(
  vendedorId: string,
  ranking: RankingRow[],
  metas: MetaVendedor | null,
  prisma: PrismaClient,
  mes: number,
  ano: number
): Promise<Badge[]> {
  const badges: Badge[] = []
  const row = ranking.find(r => r.vendedorId === vendedorId)
  if (!row) return badges

  // 🥇 1º lugar em MRR
  if (ranking[0]?.vendedorId === vendedorId) badges.push('campiao')

  // 🎯 Meta de fechamentos batida
  if (metas && row.fechamentos >= metas.fechamentos) badges.push('meta-batida')

  // 📈 MRR > mês anterior
  const { inicio: inicioAnt, fim: fimAnt } = resolverPeriodo('mes-anterior')
  const mrrAnterior = await prisma.lead.aggregate({
    where: { vendedorId, status: 'fechado', updatedAt: { gte: inicioAnt, lte: fimAnt } },
    _sum: { potencialMensalidade: true },
  })
  if (row.mrr > (mrrAnterior._sum.potencialMensalidade ?? 0)) badges.push('crescimento')

  // 💎 Maior deal do mês
  const { inicio, fim } = resolverPeriodo('mes-atual')
  const maiorDeal = await prisma.lead.findFirst({
    where: { status: 'fechado', updatedAt: { gte: inicio, lte: fim } },
    orderBy: { potencialMensalidade: 'desc' },
    select: { vendedorId: true },
  })
  if (maiorDeal?.vendedorId === vendedorId) badges.push('maior-deal')

  // 🔥 3 fechamentos na semana
  const semana = new Date()
  semana.setDate(semana.getDate() - 7)
  const fechSemana = await prisma.lead.count({
    where: { vendedorId, status: 'fechado', updatedAt: { gte: semana } },
  })
  if (fechSemana >= 3) badges.push('em-chamas')

  return badges
}
```

## Histórico 6 meses (sparkline)

```typescript
async function historico6Meses(vendedorId: string, prisma: PrismaClient) {
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    return { mes: d.getMonth() + 1, ano: d.getFullYear() }
  })

  return Promise.all(meses.map(async ({ mes, ano }) => {
    const { inicio, fim } = { inicio: new Date(ano, mes - 1, 1), fim: new Date(ano, mes, 0, 23, 59, 59) }
    const agg = await prisma.lead.aggregate({
      where: { vendedorId, status: 'fechado', updatedAt: { gte: inicio, lte: fim } },
      _sum: { potencialMensalidade: true },
    })
    return { mes, ano, mrr: agg._sum.potencialMensalidade ?? 0 }
  }))
}
```

## API endpoints

```
GET  /api/ranking?periodo=mes-atual            → ranking completo do período
GET  /api/ranking/meu-desempenho               → dados do vendedor logado
GET  /api/ranking/:vendedorId/historico        → array 6 meses
GET  /api/ranking/metas?mes=5&ano=2026         → metas do mês
POST /api/ranking/metas                         → salvar/atualizar metas
GET  /api/ranking/export?periodo=mes-atual&fmt=csv|pdf
```

## Cache

- Ranking: node-cache 5min (dados mudam com fechamentos; aceitável)
- Histórico 6 meses: node-cache 10min
- Metas: node-cache 5min; invalidar ao salvar novas metas

## Decisões

- **Sem tabela de snapshot:** ranking sempre calculado em tempo real via groupBy — evita sincronização e complexidade de job. 5min de cache é suficiente para o volume atual (3 vendedores).
- **groupBy nativo do Prisma:** mais legível que raw SQL, suporte a tipagem completa.
- **Badges calculadas no request:** não persistidas em banco — o estado pode mudar a qualquer momento. Sem overhead pois são 4-5 queries leves.
- **MetaVendedor unique([vendedorId, mes, ano]):** upsert seguro; meses futuros podem ser pré-configurados.
