# Sprint 25 — Step 04 — Felipe Santos (Backend Developer)
# Metas e Comissões Avançado — Services e Routes

---

## dashboard.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import NodeCache from 'node-cache'

const cache = new NodeCache({ stdTTL: 300 }) // 5min

function periodoMes(mes: number, ano: number) {
  return {
    inicio: new Date(ano, mes - 1, 1),
    fim: new Date(ano, mes, 0, 23, 59, 59, 999)
  }
}

// ─── Dashboard do Vendedor ────────────────────────────────────────────────
export async function dashboardVendedor(
  userId: string,
  mes: number,
  ano: number,
  prisma: PrismaClient
) {
  const key = `dash:vend:${userId}:${mes}:${ano}`
  const cached = cache.get(key)
  if (cached) return cached

  const { inicio, fim } = periodoMes(mes, ano)
  const anoInicio = new Date(ano, 0, 1)
  const anoFim = new Date(ano, 11, 31, 23, 59, 59)

  // ── Cards de resumo ──
  const [comissoesMes, contratosCount, indicacoesCount, metasMes] = await Promise.all([
    prisma.comissao.groupBy({
      by: ['status'],
      where: { vendedorId: userId, createdAt: { gte: inicio, lte: fim } },
      _sum: { valorComissao: true }
    }),
    prisma.contrato.count({
      where: { vendedorId: userId, createdAt: { gte: inicio, lte: fim } }
    }),
    prisma.indicacaoParceiro.count({
      where: { vendedorId: userId, createdAt: { gte: inicio, lte: fim } }
    }),
    prisma.meta.findMany({
      where: { vendedorId: userId, mes, ano, status: 'ATIVA' },
      include: { vendedor: { select: { id: true, name: true } } }
    })
  ])

  const comissaoPagoAno = await prisma.comissao.aggregate({
    where: { vendedorId: userId, status: 'PAGA', dataPagamento: { gte: anoInicio, lte: anoFim } },
    _sum: { valorComissao: true }
  })

  const comissaoMap = Object.fromEntries(
    comissoesMes.map(c => [c.status, Number(c._sum.valorComissao ?? 0)])
  )
  const metaPrincipal = metasMes.find(m => m.metaPrincipal)

  // ── Gráfico 1: Evolução comissão (6 meses) ──
  const evolucao6m = await Promise.all(
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date(ano, mes - 1 - (5 - i), 1)
      const mRef = d.getMonth() + 1
      const aRef = d.getFullYear()
      const { inicio: ini, fim: fi } = periodoMes(mRef, aRef)
      return prisma.comissao.groupBy({
        by: ['status'],
        where: { vendedorId: userId, createdAt: { gte: ini, lte: fi }, status: { in: ['PREVISTA','LIBERADA','PAGA'] } },
        _sum: { valorComissao: true }
      }).then(rows => {
        const map = Object.fromEntries(rows.map(r => [r.status, Number(r._sum.valorComissao ?? 0)]))
        return { mes: mRef, ano: aRef, prevista: map.PREVISTA ?? 0, liberada: (map.LIBERADA ?? 0) + (map.PAGA ?? 0) }
      })
    })
  )

  // ── Gráfico 3: Recebimentos por tipo (PieChart) ──
  const recebimentosPorTipo = await prisma.recebimento.groupBy({
    by: ['tipoReceita'],
    where: { vendedorId: userId, createdAt: { gte: inicio, lte: fim } },
    _sum: { valorRecebido: true }
  })

  // ── Gráfico 4: Comissão acumulada dia a dia ──
  const comissoesDia = await prisma.comissao.findMany({
    where: { vendedorId: userId, createdAt: { gte: inicio, lte: fim } },
    select: { createdAt: true, valorComissao: true }
  })
  const porDia: Record<number, number> = {}
  comissoesDia.forEach(c => {
    const dia = c.createdAt.getDate()
    porDia[dia] = (porDia[dia] ?? 0) + Number(c.valorComissao)
  })
  let acumulado = 0
  const serieTemporal = Array.from({ length: new Date(ano, mes, 0).getDate() }, (_, i) => {
    acumulado += porDia[i + 1] ?? 0
    return { dia: i + 1, acumulado }
  })

  // ── Tabelas ──
  const [ultimasComissoes, ultimasIndicacoes, recebimentosPendentes] = await Promise.all([
    prisma.comissao.findMany({
      where: { vendedorId: userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { regra: { select: { nome: true } } }
    }),
    prisma.indicacaoParceiro.findMany({
      where: { vendedorId: userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { parceiro: { select: { nome: true } } }
    }),
    prisma.recebimento.findMany({
      where: {
        vendedorId: userId,
        statusRecebimento: { in: ['PENDENTE', 'VENCIDO', 'PARCIALMENTE_RECEBIDO'] }
      },
      orderBy: { proximoVencimento: 'asc' },
      take: 5
    })
  ])

  const result = {
    cards: {
      comissaoPrevista: comissaoMap.PREVISTA ?? 0,
      comissaoLiberada: comissaoMap.LIBERADA ?? 0,
      comissaoPagaAno: Number(comissaoPagoAno._sum.valorComissao ?? 0),
      percentualMetaPrincipal: metaPrincipal ? Number(metaPrincipal.percentualAtingido) : null,
      contratosNoMes: contratosCount,
      indicacoesNoMes: indicacoesCount
    },
    graficos: {
      evolucaoComissao: evolucao6m,
      atingimentoMetas: metasMes.map(m => ({
        tipo: m.tipoMeta,
        percentual: Number(m.percentualAtingido),
        meta: Number(m.valorMeta ?? m.quantidadeMeta ?? 0),
        realizado: Number(m.valorRealizado ?? m.quantidadeRealizada ?? 0)
      })),
      recebimentosPorTipo: recebimentosPorTipo.map(r => ({
        tipo: r.tipoReceita,
        valor: Number(r._sum.valorRecebido ?? 0)
      })),
      serieTemporal
    },
    tabelas: {
      ultimasComissoes,
      metas: metasMes,
      ultimasIndicacoes,
      recebimentosPendentes
    }
  }

  cache.set(key, result)
  return result
}

// ─── Dashboard do Supervisor ──────────────────────────────────────────────
export async function dashboardSupervisor(
  mes: number,
  ano: number,
  vendedorId: string | undefined,
  prisma: PrismaClient
) {
  const key = `dash:sup:${mes}:${ano}:${vendedorId ?? 'all'}`
  const cached = cache.get<any>(key)
  if (cached) return cached

  cache.options.stdTTL = 600 // 10min para supervisor
  const { inicio, fim } = periodoMes(mes, ano)
  const filtroVendedor = vendedorId ? { vendedorId } : {}

  const [
    comissoesAgrupadas, metasAtivas, metas100, metasAbaixo50,
    receitaTotal, inadimplencia, indicacoesMes, indicacoesConvertidas,
    parceirosAtivos, ticketMedio, comissaoBloqueada
  ] = await Promise.all([
    prisma.comissao.groupBy({
      by: ['status'],
      where: { ...filtroVendedor, createdAt: { gte: inicio, lte: fim } },
      _sum: { valorComissao: true }
    }),
    prisma.meta.count({ where: { ...filtroVendedor, mes, ano, status: 'ATIVA' } }),
    prisma.meta.count({ where: { ...filtroVendedor, mes, ano, percentualAtingido: { gte: 100 } } }),
    prisma.meta.count({ where: { ...filtroVendedor, mes, ano, percentualAtingido: { lt: 50 } } }),
    prisma.recebimento.aggregate({
      where: { ...filtroVendedor, statusRecebimento: 'RECEBIDO', createdAt: { gte: inicio, lte: fim } },
      _sum: { valorRecebido: true }
    }),
    prisma.recebimento.aggregate({
      where: { ...filtroVendedor, statusRecebimento: 'VENCIDO' },
      _sum: { saldoPendente: true }
    }),
    prisma.indicacaoParceiro.count({ where: { ...filtroVendedor, createdAt: { gte: inicio, lte: fim } } }),
    prisma.indicacaoParceiro.count({ where: { ...filtroVendedor, status: 'CONVERTIDA', dataConversao: { gte: inicio, lte: fim } } }),
    prisma.parceiro.count({ where: { status: 'ATIVO' } }),
    prisma.comissao.groupBy({
      by: ['vendedorId'],
      where: { ...filtroVendedor, status: 'LIBERADA', createdAt: { gte: inicio, lte: fim } },
      _sum: { valorComissao: true }
    }),
    prisma.comissao.aggregate({
      where: { ...filtroVendedor, status: 'BLOQUEADA' },
      _sum: { valorComissao: true }
    })
  ])

  const cmMap = Object.fromEntries(comissoesAgrupadas.map(c => [c.status, Number(c._sum.valorComissao ?? 0)]))
  const taxaConversao = indicacoesMes > 0 ? Math.round((indicacoesConvertidas / indicacoesMes) * 100 * 10) / 10 : 0
  const ticketMedioValor = ticketMedio.length > 0
    ? Math.round(ticketMedio.reduce((s, t) => s + Number(t._sum.valorComissao ?? 0), 0) / ticketMedio.length * 100) / 100
    : 0

  // ── Comissão por vendedor (top 10) ──
  const comissaoPorVendedor = await prisma.comissao.groupBy({
    by: ['vendedorId'],
    where: { ...filtroVendedor, status: { in: ['LIBERADA','PAGA'] }, createdAt: { gte: inicio, lte: fim } },
    _sum: { valorComissao: true },
    orderBy: { _sum: { valorComissao: 'desc' } },
    take: 10
  })
  const vendedoresIds = comissaoPorVendedor.map(c => c.vendedorId)
  const vendedores = await prisma.user.findMany({
    where: { id: { in: vendedoresIds } },
    select: { id: true, name: true }
  })
  const vendedorMap = Object.fromEntries(vendedores.map(v => [v.id, v.name]))

  // ── Evolução mensal (12 meses) ──
  const evolucao12m = await Promise.all(
    Array.from({ length: 12 }, (_, i) => {
      const d = new Date(ano, mes - 1 - (11 - i), 1)
      const mRef = d.getMonth() + 1
      const aRef = d.getFullYear()
      const { inicio: ini, fim: fi } = periodoMes(mRef, aRef)
      return prisma.comissao.aggregate({
        where: { ...filtroVendedor, status: { in: ['LIBERADA','PAGA'] }, createdAt: { gte: ini, lte: fi } },
        _sum: { valorComissao: true }
      }).then(r => ({ mes: mRef, ano: aRef, valor: Number(r._sum.valorComissao ?? 0) }))
    })
  )

  // ── Indicações por parceiro (top 8) ──
  const indicacoesPorParceiro = await prisma.indicacaoParceiro.groupBy({
    by: ['parceiroId'],
    where: { ...filtroVendedor, createdAt: { gte: inicio, lte: fim } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 8
  })
  const parceirosIds = indicacoesPorParceiro.map(i => i.parceiroId)
  const parceiros = await prisma.parceiro.findMany({
    where: { id: { in: parceirosIds } },
    select: { id: true, nome: true }
  })
  const parceiroMap = Object.fromEntries(parceiros.map(p => [p.id, p.nome]))

  const result = {
    kpis: {
      comissaoPrevista: cmMap.PREVISTA ?? 0,
      comissaoLiberada: cmMap.LIBERADA ?? 0,
      comissaoPaga: cmMap.PAGA ?? 0,
      comissaoBloqueada: Number(comissaoBloqueada._sum.valorComissao ?? 0),
      receitaRecebida: Number(receitaTotal._sum.valorRecebido ?? 0),
      inadimplencia: Number(inadimplencia._sum.saldoPendente ?? 0),
      metasAtivas,
      metas100,
      metasAbaixo50,
      indicacoesMes,
      indicacoesConvertidas,
      taxaConversao,
      parceirosAtivos,
      ticketMedio: ticketMedioValor
    },
    graficos: {
      comissaoPorVendedor: comissaoPorVendedor.map(c => ({
        vendedorId: c.vendedorId,
        nome: vendedorMap[c.vendedorId] ?? '—',
        valor: Number(c._sum.valorComissao ?? 0)
      })),
      distribuicaoStatus: comissoesAgrupadas.map(c => ({
        status: c.status,
        valor: Number(c._sum.valorComissao ?? 0)
      })),
      evolucao12m,
      indicacoesPorParceiro: indicacoesPorParceiro.map(i => ({
        parceiroId: i.parceiroId,
        nome: parceiroMap[i.parceiroId] ?? '—',
        total: i._count.id
      }))
    }
  }

  cache.set(key, result, 600)
  return result
}
```

---

## ranking.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import NodeCache from 'node-cache'

const cache = new NodeCache({ stdTTL: 600 })

export async function calcularRanking(mes: number, ano: number, prisma: PrismaClient) {
  const key = `rank:${mes}:${ano}`
  const cached = cache.get<any[]>(key)
  if (cached) return cached

  const { inicio, fim } = periodoMes(mes, ano)

  // Busca todos os vendedores com atividade no período
  const vendedores = await prisma.user.findMany({
    where: { role: 'VENDEDOR' },
    select: { id: true, name: true }
  })

  const ranking = await Promise.all(vendedores.map(async v => {
    const [contratos, mrrAgr, indicacoesConvertidas, metasBônus, comissaoLib] = await Promise.all([
      prisma.contrato.count({ where: { vendedorId: v.id, createdAt: { gte: inicio, lte: fim } } }),
      prisma.contrato.aggregate({
        where: { vendedorId: v.id, createdAt: { gte: inicio, lte: fim } },
        _sum: { mrr: true }
      }),
      prisma.indicacaoParceiro.count({
        where: { vendedorId: v.id, status: 'CONVERTIDA', dataConversao: { gte: inicio, lte: fim } }
      }),
      prisma.meta.count({
        where: { vendedorId: v.id, mes, ano, percentualAtingido: { gte: 100 } }
      }),
      prisma.comissao.aggregate({
        where: { vendedorId: v.id, status: { in: ['LIBERADA','PAGA'] }, createdAt: { gte: inicio, lte: fim } },
        _sum: { valorComissao: true }
      })
    ])

    const mrrValor = Number(mrrAgr._sum.mrr ?? 0)
    const comissaoLiberada = Number(comissaoLib._sum.valorComissao ?? 0)

    const totalPontos =
      (contratos * 3) +
      Math.floor(mrrValor / 100) +
      (indicacoesConvertidas * 2) +
      (metasBônus * 5)

    return {
      vendedorId: v.id,
      nomeVendedor: v.name,
      totalPontos,
      contratosNoMes: contratos,
      mrrNoMes: mrrValor,
      indicacoesConvertidas,
      metasAtingidas100: metasBônus,
      comissaoLiberada,
      posicao: 0
    }
  }))

  // Ordena por pontos DESC, desempate por comissaoLiberada DESC
  ranking.sort((a, b) =>
    b.totalPontos !== a.totalPontos
      ? b.totalPontos - a.totalPontos
      : b.comissaoLiberada - a.comissaoLiberada
  )

  // Filtra apenas quem tem pelo menos alguma atividade
  const ativos = ranking
    .filter(v => v.totalPontos > 0 || v.comissaoLiberada > 0)
    .map((v, i) => ({ ...v, posicao: i + 1 }))

  cache.set(key, ativos)
  return ativos
}

function periodoMes(mes: number, ano: number) {
  return {
    inicio: new Date(ano, mes - 1, 1),
    fim: new Date(ano, mes, 0, 23, 59, 59, 999)
  }
}
```

---

## fechamento-mensal.service.ts

```typescript
import { PrismaClient } from '@prisma/client'

export async function listarFechamentos(
  filters: { mes?: number; ano?: number; status?: string },
  prisma: PrismaClient
) {
  return prisma.fechamentoMensal.findMany({
    where: {
      ...(filters.mes ? { mes: filters.mes } : {}),
      ...(filters.ano ? { ano: filters.ano } : {}),
      ...(filters.status ? { status: filters.status as any } : {})
    },
    include: { criadoPor: { select: { id: true, name: true } } },
    orderBy: [{ ano: 'desc' }, { mes: 'desc' }]
  })
}

export async function criarFechamento(mes: number, ano: number, criadoPorId: string, prisma: PrismaClient) {
  // Verifica se já existe
  const existente = await prisma.fechamentoMensal.findUnique({ where: { mes_ano: { mes, ano } } })
  if (existente) throw { statusCode: 409, message: 'Já existe um fechamento para este mês/ano' }

  // Calcula totais das comissões LIBERADAS do período
  const { inicio, fim } = periodoMes(mes, ano)
  const agr = await prisma.comissao.aggregate({
    where: { status: 'LIBERADA', createdAt: { gte: inicio, lte: fim } },
    _sum: { valorComissao: true },
    _count: { vendedorId: true }
  })
  const vendedoresUnicos = await prisma.comissao.groupBy({
    by: ['vendedorId'],
    where: { status: 'LIBERADA', createdAt: { gte: inicio, lte: fim } }
  })

  return prisma.fechamentoMensal.create({
    data: {
      mes, ano,
      totalComissoesLiberadas: Number(agr._sum.valorComissao ?? 0),
      totalVendedores: vendedoresUnicos.length,
      criadoPorId,
      status: 'ABERTO'
    }
  })
}

export async function previewFechamento(id: string, prisma: PrismaClient) {
  const fechamento = await prisma.fechamentoMensal.findUnique({ where: { id } })
  if (!fechamento) throw { statusCode: 404, message: 'Fechamento não encontrado' }

  const { inicio, fim } = periodoMes(fechamento.mes, fechamento.ano)

  // Comissões LIBERADAS do mês agrupadas por vendedor
  const comissoesPorVendedor = await prisma.comissao.groupBy({
    by: ['vendedorId'],
    where: { status: 'LIBERADA', createdAt: { gte: inicio, lte: fim } },
    _sum: { valorComissao: true },
    _count: { id: true }
  })

  const vendedoresIds = comissoesPorVendedor.map(c => c.vendedorId)
  const vendedores = await prisma.user.findMany({
    where: { id: { in: vendedoresIds } },
    select: { id: true, name: true }
  })
  const vendedorMap = Object.fromEntries(vendedores.map(v => [v.id, v.name]))

  return {
    fechamento,
    preview: comissoesPorVendedor.map(c => ({
      vendedorId: c.vendedorId,
      nomeVendedor: vendedorMap[c.vendedorId] ?? '—',
      totalComissoes: c._count.id,
      totalValor: Number(c._sum.valorComissao ?? 0)
    })),
    totalGeral: Number(fechamento.totalComissoesLiberadas)
  }
}

export async function aprovarFechamento(id: string, aprovadoPorId: string, obs: string | undefined, prisma: PrismaClient) {
  const f = await prisma.fechamentoMensal.findUnique({ where: { id } })
  if (!f) throw { statusCode: 404, message: 'Fechamento não encontrado' }
  if (f.status !== 'ABERTO' && f.status !== 'EM_REVISAO') {
    throw { statusCode: 400, message: `Fechamento em status ${f.status} não pode ser aprovado` }
  }
  return prisma.fechamentoMensal.update({
    where: { id },
    data: { status: 'APROVADO', aprovadoPorId, dataAprovacao: new Date(), observacoes: obs, updatedAt: new Date() }
  })
}

export async function pagarFechamento(id: string, paidById: string, prisma: PrismaClient) {
  const f = await prisma.fechamentoMensal.findUnique({ where: { id } })
  if (!f) throw { statusCode: 404, message: 'Fechamento não encontrado' }
  if (f.status !== 'APROVADO') throw { statusCode: 400, message: 'Fechamento precisa estar APROVADO antes de ser pago' }

  const { inicio, fim } = periodoMes(f.mes, f.ano)
  const agora = new Date()

  // Marca todas as comissões LIBERADAS do período como PAGA e vincula ao fechamento
  await prisma.comissao.updateMany({
    where: { status: 'LIBERADA', createdAt: { gte: inicio, lte: fim } },
    data: { status: 'PAGA', dataPagamento: agora, fechamentoId: id, updatedAt: agora }
  })

  return prisma.fechamentoMensal.update({
    where: { id },
    data: { status: 'PAGO', paidById, dataPagamento: agora, updatedAt: agora }
  })
}

function periodoMes(mes: number, ano: number) {
  return {
    inicio: new Date(ano, mes - 1, 1),
    fim: new Date(ano, mes, 0, 23, 59, 59, 999)
  }
}
```

---

## relatorios-mc.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import NodeCache from 'node-cache'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const cache = new NodeCache({ stdTTL: 300 })

const fmtDate = (d: Date | null | undefined) =>
  d ? format(d, 'dd/MM/yyyy', { locale: ptBR }) : '—'
const fmtBRL = (v: number | null | undefined) =>
  v != null ? `R$ ${Number(v).toFixed(2).replace('.', ',')}` : '—'
const fmtPct = (v: number | null | undefined) =>
  v != null ? `${Number(v).toFixed(1)}%` : '—'

const TIPO_META_PT: Record<string, string> = {
  CONTRATOS_FECHADOS: 'Contratos', MRR_NOVO: 'MRR', RECEITA_INSTALACAO: 'Instalação',
  RECEITA_TOTAL_RECEBIDA: 'Receita total', PROPOSTAS_ENVIADAS: 'Propostas',
  SERVICOS_VENDIDOS: 'Serviços', INDICACOES_REALIZADAS: 'Indicações',
  INDICACOES_CONVERTIDAS: 'Indicações conv.', RECEITA_INDICACOES: 'Receita indicações',
  META_PERSONALIZADA: 'Personalizada'
}

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export async function gerarRelatorioMetasComissoes(
  tipo: string,
  inicio: string,
  fim: string,
  vendedorId: string | undefined,
  prisma: PrismaClient
): Promise<Buffer> {
  const key = `rel:mc:${tipo}:${inicio}:${fim}:${vendedorId ?? 'all'}`
  const cached = cache.get<Buffer>(key)
  if (cached) return cached

  const ini = new Date(inicio)
  const fi = new Date(fim + 'T23:59:59')
  const filtroVendedor = vendedorId ? { vendedorId } : {}

  let rows: any[] = []
  let headers: string[] = []

  switch (tipo) {
    case 'metas': {
      const metas = await prisma.meta.findMany({
        where: { ...filtroVendedor, createdAt: { gte: ini, lte: fi } },
        include: { vendedor: { select: { name: true } } },
        orderBy: [{ ano: 'desc' }, { mes: 'desc' }]
      })
      headers = ['Vendedor','Tipo','Mês/Ano','Meta','Realizado','% Atingido','Status']
      rows = metas.map(m => {
        const isMon = ['MRR_NOVO','RECEITA_INSTALACAO','RECEITA_TOTAL_RECEBIDA','RECEITA_INDICACOES'].includes(m.tipoMeta)
        return [
          m.vendedor?.name ?? '—',
          TIPO_META_PT[m.tipoMeta] ?? m.tipoMeta,
          `${MESES_PT[m.mes - 1]}/${m.ano}`,
          isMon ? fmtBRL(Number(m.valorMeta)) : (m.quantidadeMeta ?? '—'),
          isMon ? fmtBRL(Number(m.valorRealizado)) : (m.quantidadeRealizada ?? 0),
          fmtPct(Number(m.percentualAtingido)),
          m.status
        ]
      })
      break
    }

    case 'comissoes': {
      const comissoes = await prisma.comissao.findMany({
        where: { ...filtroVendedor, createdAt: { gte: ini, lte: fi } },
        include: {
          vendedor: { select: { name: true } },
          regra: { select: { nome: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
      headers = ['Data','Vendedor','Origem','Regra','Valor Base','% Aplicado','Valor Comissão','Status']
      rows = comissoes.map(c => [
        fmtDate(c.createdAt),
        c.vendedor?.name ?? '—',
        c.contratoId ? 'Contrato' : c.servicoId ? 'Serviço' : 'Indicação',
        c.regra?.nome ?? 'Manual',
        fmtBRL(Number(c.valorBase)),
        c.percentualAplicado ? `${(Number(c.percentualAplicado) * 100).toFixed(1)}%` : '—',
        fmtBRL(Number(c.valorComissao)),
        c.status
      ])
      break
    }

    case 'recebimentos': {
      const recebimentos = await prisma.recebimento.findMany({
        where: { ...filtroVendedor, createdAt: { gte: ini, lte: fi } },
        include: { vendedor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      })
      headers = ['Data','Cliente','CNPJ','Vendedor','Tipo','Vendido','Recebido','Saldo','Status','Com. Prevista','Com. Liberada']
      rows = recebimentos.map(r => [
        fmtDate(r.createdAt),
        r.clienteNome,
        r.clienteCNPJ ?? '—',
        r.vendedor?.name ?? '—',
        r.tipoReceita,
        fmtBRL(Number(r.valorVendido)),
        fmtBRL(Number(r.valorRecebido)),
        fmtBRL(Number(r.saldoPendente)),
        r.statusRecebimento,
        fmtBRL(Number(r.comissaoPrevista)),
        fmtBRL(Number(r.comissaoLiberada))
      ])
      break
    }

    case 'indicacoes': {
      const indicacoes = await prisma.indicacaoParceiro.findMany({
        where: { ...filtroVendedor, createdAt: { gte: ini, lte: fi } },
        include: {
          vendedor: { select: { name: true } },
          parceiro: { select: { nome: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
      headers = ['Data','Vendedor','Cliente','CNPJ','Parceiro','Produto/Serviço','Valor Estimado','Valor Confirmado','Comissão','Status']
      rows = indicacoes.map(i => [
        fmtDate(i.createdAt),
        i.vendedor?.name ?? '—',
        i.clienteNome,
        i.clienteCNPJ ?? '—',
        i.parceiro?.nome ?? '—',
        i.produtoServico,
        fmtBRL(Number(i.valorEstimado ?? 0)),
        fmtBRL(Number(i.valorConfirmado ?? 0)),
        fmtBRL(Number(i.comissaoPrevista ?? 0)),
        i.status
      ])
      break
    }

    default:
      throw { statusCode: 400, message: `Tipo de relatório inválido: ${tipo}` }
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // Largura automática por coluna
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length), 12)
  }))

  XLSX.utils.book_append_sheet(wb, ws, tipo.charAt(0).toUpperCase() + tipo.slice(1))
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  cache.set(key, buffer)
  return buffer
}
```

---

## dashboard.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { requireRole } from '../middleware/auth'
import { dashboardVendedor, dashboardSupervisor } from './dashboard.service'

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/dashboard/vendedor', {
    preHandler: requireRole(['VENDEDOR','SUPERVISAO','CEO','ADMIN'])
  }, async (req) => {
    const user = req.user as any
    const { mes, ano } = req.query as any
    const mesN = mes ? parseInt(mes) : new Date().getMonth() + 1
    const anoN = ano ? parseInt(ano) : new Date().getFullYear()

    // Supervisor pode ver dashboard de vendedor específico
    const userId = (req.query as any).vendedorId && user.role !== 'VENDEDOR'
      ? (req.query as any).vendedorId
      : user.id

    return dashboardVendedor(userId, mesN, anoN, app.prisma)
  })

  app.get('/dashboard/supervisor', {
    preHandler: requireRole(['SUPERVISAO','CEO','ADMIN'])
  }, async (req) => {
    const { mes, ano, vendedorId } = req.query as any
    const mesN = mes ? parseInt(mes) : new Date().getMonth() + 1
    const anoN = ano ? parseInt(ano) : new Date().getFullYear()
    return dashboardSupervisor(mesN, anoN, vendedorId, app.prisma)
  })
}
```

---

## ranking.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { requireRole } from '../middleware/auth'
import { calcularRanking } from './ranking.service'

export async function rankingRoutes(app: FastifyInstance) {
  app.get('/ranking', {
    preHandler: requireRole(['VENDEDOR','SUPERVISAO','CEO','ADMIN','FINANCEIRO'])
  }, async (req) => {
    const { mes, ano } = req.query as any
    const mesN = mes ? parseInt(mes) : new Date().getMonth() + 1
    const anoN = ano ? parseInt(ano) : new Date().getFullYear()
    const user = req.user as any

    const ranking = await calcularRanking(mesN, anoN, app.prisma)

    // VENDEDOR vê ranking completo mas sem comissão dos colegas
    if (user.role === 'VENDEDOR') {
      return ranking.map(r => ({
        ...r,
        comissaoLiberada: r.vendedorId === user.id ? r.comissaoLiberada : null
      }))
    }
    return ranking
  })
}
```

---

## fechamento-mensal.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { requireRole } from '../middleware/auth'
import * as fechService from './fechamento-mensal.service'

export async function fechamentoMensalRoutes(app: FastifyInstance) {
  app.get('/fechamentos', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req) => {
      const { mes, ano, status } = req.query as any
      return fechService.listarFechamentos(
        { mes: mes ? parseInt(mes) : undefined, ano: ano ? parseInt(ano) : undefined, status },
        app.prisma
      )
    }
  )

  app.post('/fechamentos', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req, reply) => {
      const { mes, ano } = req.body as any
      const user = req.user as any
      const f = await fechService.criarFechamento(mes, ano, user.id, app.prisma)
      reply.code(201).send(f)
    }
  )

  app.get('/fechamentos/:id', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req) => app.prisma.fechamentoMensal.findUniqueOrThrow({ where: { id: (req.params as any).id } })
  )

  app.get('/fechamentos/:id/preview', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req) => fechService.previewFechamento((req.params as any).id, app.prisma)
  )

  app.patch('/fechamentos/:id/aprovar', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req) => {
      const user = req.user as any
      const { observacoes } = req.body as any
      return fechService.aprovarFechamento((req.params as any).id, user.id, observacoes, app.prisma)
    }
  )

  app.patch('/fechamentos/:id/pagar', { preHandler: requireRole(['CEO','ADMIN']) },
    async (req) => {
      const user = req.user as any
      return fechService.pagarFechamento((req.params as any).id, user.id, app.prisma)
    }
  )
}
```

---

## relatorios-mc.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { requireRole } from '../middleware/auth'
import { gerarRelatorioMetasComissoes } from './relatorios-mc.service'

export async function relatoriosMCRoutes(app: FastifyInstance) {
  app.get('/metas-comissoes/relatorios', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN','FINANCEIRO']) },
    async (req, reply) => {
      const { tipo, inicio, fim, vendedorId } = req.query as any
      if (!tipo) return reply.code(400).send({ message: 'Parâmetro tipo é obrigatório' })
      if (!inicio || !fim) return reply.code(400).send({ message: 'Parâmetros inicio e fim são obrigatórios' })

      const buffer = await gerarRelatorioMetasComissoes(tipo, inicio, fim, vendedorId, app.prisma)
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="relatorio-${tipo}-${inicio}-${fim}.xlsx"`)
        .send(buffer)
    }
  )
}
```

---

## Crons adicionais (cron.ts — adições)

```typescript
// 00:15 — liberar comissões que ficaram presas (recebimento já RECEBIDO mas comissão ainda AGUARDANDO)
cron.schedule('15 0 * * *', async () => {
  const comissoesAguardando = await prisma.comissao.findMany({
    where: { status: 'AGUARDANDO_RECEBIMENTO' },
    select: { id: true, contratoId: true, servicoId: true }
  })

  for (const comissao of comissoesAguardando) {
    const recebimento = await prisma.recebimento.findFirst({
      where: {
        statusRecebimento: 'RECEBIDO',
        OR: [
          { contratoId: comissao.contratoId ?? undefined },
          { servicoId: comissao.servicoId ?? undefined }
        ]
      }
    })
    if (recebimento) {
      await prisma.comissao.update({
        where: { id: comissao.id },
        data: { status: 'LIBERADA', dataLiberacao: new Date(), recebimentoId: recebimento.id }
      })
    }
  }
})

// 00:20 — atualiza totais de FechamentoMensal ABERTO do mês anterior
cron.schedule('20 0 * * *', async () => {
  const hoje = new Date()
  const mesAnterior = hoje.getMonth() === 0 ? 12 : hoje.getMonth()
  const anoRef = hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear()

  const fechamento = await prisma.fechamentoMensal.findUnique({
    where: { mes_ano: { mes: mesAnterior, ano: anoRef } }
  })
  if (!fechamento || !['ABERTO','EM_REVISAO'].includes(fechamento.status)) return

  const { inicio, fim } = periodoMes(mesAnterior, anoRef)
  const agr = await prisma.comissao.aggregate({
    where: { status: 'LIBERADA', createdAt: { gte: inicio, lte: fim } },
    _sum: { valorComissao: true }
  })
  const vendedoresUnicos = await prisma.comissao.groupBy({
    by: ['vendedorId'],
    where: { status: 'LIBERADA', createdAt: { gte: inicio, lte: fim } }
  })

  await prisma.fechamentoMensal.update({
    where: { id: fechamento.id },
    data: {
      totalComissoesLiberadas: Number(agr._sum.valorComissao ?? 0),
      totalVendedores: vendedoresUnicos.length,
      updatedAt: new Date()
    }
  })
})

function periodoMes(mes: number, ano: number) {
  return {
    inicio: new Date(ano, mes - 1, 1),
    fim: new Date(ano, mes, 0, 23, 59, 59, 999)
  }
}
```

---

## Registro de rotas em app.ts (adições)

```typescript
import { dashboardRoutes } from './modules/metas-comissoes/dashboard/dashboard.routes'
import { rankingRoutes } from './modules/metas-comissoes/ranking/ranking.routes'
import { fechamentoMensalRoutes } from './modules/metas-comissoes/fechamento-mensal/fechamento-mensal.routes'
import { relatoriosMCRoutes } from './modules/metas-comissoes/relatorios/relatorios-mc.routes'

app.register(dashboardRoutes)
app.register(rankingRoutes)
app.register(fechamentoMensalRoutes)
app.register(relatoriosMCRoutes)
```

---

## Sprint 25 — BACKEND PRONTO ✅
