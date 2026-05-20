# Sprint 23 — Step 04 — Felipe Santos (Backend)
# Serviços Contratados Avançado — Implementação API

---

## src/lib/calcular-data-prevista.ts

```typescript
import { PrismaClient } from '@prisma/client'

export async function calcularDataPrevista(
  diasUteis: number,
  prisma: PrismaClient,
  inicio: Date = new Date()
): Promise<Date> {
  const limite = new Date(inicio)
  limite.setDate(limite.getDate() + 90)

  const feriados = await prisma.feriadoNacional.findMany({
    where: { ativo: true, data: { gte: inicio, lte: limite } },
    select: { data: true },
  })

  const feriadoSet = new Set(feriados.map((f) => f.data.toISOString().slice(0, 10)))
  const data = new Date(inicio)
  let adicionados = 0

  while (adicionados < diasUteis) {
    data.setDate(data.getDate() + 1)
    const dow = data.getDay()
    const iso = data.toISOString().slice(0, 10)
    if (dow !== 0 && dow !== 6 && !feriadoSet.has(iso)) adicionados++
  }

  return data
}
```

---

## src/lib/snapshot-checklist.ts

```typescript
import { PrismaClient } from '@prisma/client'

export async function criarSnapshotChecklist(
  servicoId: string,
  tipoServicoId: string,
  prisma: PrismaClient
) {
  const itens = await prisma.checklistPadrao.findMany({
    where: { tipoServicoId, ativo: true },
    orderBy: { ordem: 'asc' },
  })
  if (itens.length === 0) return

  await prisma.checklistItemServico.createMany({
    data: itens.map((item) => ({
      servicoId,
      checklistPadraoId: item.id,
      ordem:       item.ordem,
      descricao:   item.descricao,
      obrigatorio: item.obrigatorio,
    })),
  })
}
```

---

## src/modules/servicos/servico-dashboard.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import NodeCache from 'node-cache'

const cache = new NodeCache({ stdTTL: 600 })

function dashKey(params: object) {
  return `srv-dash:${JSON.stringify(params)}`
}

function parsePeriodo(inicio: string, fim: string) {
  return {
    gte: new Date(inicio),
    lte: new Date(fim + 'T23:59:59.999Z'),
  }
}

export async function getDashboardServicos(
  inicio: string, fim: string,
  tecnicoId: string | null, setor: string | null,
  userId: string, perfil: string,
  prisma: PrismaClient
) {
  // TECNICO filtra automaticamente
  const tecnicoFiltro = perfil === 'TECNICO' ? userId : (tecnicoId ?? undefined)
  const key = dashKey({ inicio, fim, tecnicoFiltro, setor, perfil })
  if (cache.has(key)) return cache.get(key)

  const createdAt = parsePeriodo(inicio, fim)
  const where: any = { createdAt }
  if (tecnicoFiltro) where.tecnicoDesignadoId = tecnicoFiltro
  if (setor) where.setorResponsavel = setor

  const STATUS_CONCLUIDO  = 'Concluído'
  const STATUS_CANCELADO  = 'Cancelado'
  const STATUS_ABERTO     = { notIn: [STATUS_CONCLUIDO, STATUS_CANCELADO, 'Reprovado pelo cliente'] }

  const [
    total, abertos, concluidos, cancelados,
    receitaGeradaAgg, receitaPendenteAgg, receitaAbertoAgg,
    emAtrasoCount, totalCobradoAgg,
    porCategoria, porStatus,
    execucoes,
    produtividade,
  ] = await Promise.all([
    prisma.servicoContratado.count({ where }),
    prisma.servicoContratado.count({ where: { ...where, statusGeral: STATUS_ABERTO } }),
    prisma.servicoContratado.count({ where: { ...where, statusGeral: STATUS_CONCLUIDO } }),
    prisma.servicoContratado.count({ where: { ...where, statusGeral: STATUS_CANCELADO } }),

    // Financeiro
    prisma.servicoContratado.aggregate({ where: { ...where, statusGeral: STATUS_CONCLUIDO }, _sum: { valorNegociado: true } }),
    prisma.servicoContratado.aggregate({ where: { ...where, statusFinanceiro: 'Aguardando pagamento' }, _sum: { valorCobrado: true } }),
    prisma.servicoContratado.aggregate({ where: { ...where, statusGeral: STATUS_ABERTO }, _sum: { valorNegociado: true } }),
    prisma.servicoContratado.count({ where: { ...where, statusFinanceiro: 'Em atraso' } }),
    prisma.servicoContratado.aggregate({ where: { ...where }, _sum: { valorCobrado: true } }),

    // Por categoria
    prisma.servicoContratado.groupBy({
      by: ['tipoServicoId'],
      where,
      _count: true,
    }),

    // Por status
    prisma.servicoContratado.groupBy({ by: ['statusGeral'], where, _count: true }),

    // Tempo médio de conclusão
    prisma.servicoContratado.findMany({
      where: { ...where, statusGeral: STATUS_CONCLUIDO, dataConclusaoExecucao: { not: null } },
      select: { createdAt: true, dataConclusaoExecucao: true },
    }),

    // Produtividade por técnico
    prisma.servicoContratado.groupBy({
      by: ['tecnicoDesignadoId'],
      where: { ...where, tecnicoDesignadoId: { not: null } },
      _count: true,
    }),
  ])

  // Enriquecer por categoria
  const tiposIds = [...new Set(porCategoria.map((p) => p.tipoServicoId))]
  const tipos = await prisma.tipoServico.findMany({
    where: { id: { in: tiposIds } },
    select: { id: true, categoria: true, nome: true },
  })
  const tipoMap = Object.fromEntries(tipos.map((t) => [t.id, t]))
  const categoriaAgrupada = new Map<string, number>()
  for (const p of porCategoria) {
    const cat = tipoMap[p.tipoServicoId]?.categoria ?? 'Outro'
    categoriaAgrupada.set(cat, (categoriaAgrupada.get(cat) ?? 0) + p._count)
  }

  // Tempo médio
  const tempoMedioDias = execucoes.length > 0
    ? execucoes.reduce((acc, e) => {
        const dias = (e.dataConclusaoExecucao!.getTime() - e.createdAt.getTime()) / 86_400_000
        return acc + dias
      }, 0) / execucoes.length
    : 0

  // Inadimplência
  const totalCobrado = totalCobradoAgg._sum.valorCobrado ?? 0
  const inadimplencia = totalCobrado > 0 ? (emAtrasoCount / total) * 100 : 0

  // Produtividade técnicos — enriquecer com nomes
  const tecnicoIds = produtividade.map((p) => p.tecnicoDesignadoId).filter(Boolean) as string[]
  const tecnicos = await prisma.user.findMany({
    where: { id: { in: tecnicoIds } },
    select: { id: true, nome: true },
  })
  const tecnicoMap = Object.fromEntries(tecnicos.map((t) => [t.id, t.nome]))

  // Volume diário (últimos 30 dias) — via raw query por data
  const trintaDiasAtras = new Date()
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)
  const volumeDiario: Array<{ dia: string; total: number }> = await prisma.$queryRaw`
    SELECT DATE("createdAt")::TEXT as dia, COUNT(*)::INT as total
    FROM "ServicoContratado"
    WHERE "createdAt" >= ${trintaDiasAtras}
    GROUP BY DATE("createdAt")
    ORDER BY dia ASC
  `

  const result = {
    // Operacional
    total,
    abertos,
    concluidos,
    cancelados,
    taxaConclusao: total > 0 ? Math.round((concluidos / total) * 100) : 0,
    tempoMedioDias: Math.round(tempoMedioDias * 10) / 10,

    // Financeiro
    receitaGerada:   receitaGeradaAgg._sum.valorNegociado  ?? 0,
    receitaPendente: receitaPendenteAgg._sum.valorCobrado  ?? 0,
    receitaAberto:   receitaAbertoAgg._sum.valorNegociado  ?? 0,
    inadimplencia:   Math.round(inadimplencia * 10) / 10,

    // Gráficos
    porCategoria: [...categoriaAgrupada.entries()].map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total),
    porStatus:    porStatus.map((p) => ({ status: p.statusGeral, total: p._count })).sort((a, b) => b.total - a.total),
    volumeDiario,
    produtividade: produtividade.map((p) => ({
      tecnicoId:   p.tecnicoDesignadoId,
      nome:        tecnicoMap[p.tecnicoDesignadoId!] ?? 'Sem técnico',
      concluidos:  p._count,
    })).sort((a, b) => b.concluidos - a.concluidos),
  }

  cache.set(key, result)
  return result
}
```

---

## src/modules/servicos/servico-dashboard.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { getDashboardServicos } from './servico-dashboard.service'

const PERFIS_DASH = ['SUPERVISAO', 'CEO', 'ADMIN', 'FINANCEIRO', 'TECNICO']

function defaultPeriodo() {
  const agora = new Date()
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().slice(0, 10)
  const fim    = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { inicio, fim }
}

export async function servicoDashboardRoutes(fastify: FastifyInstance) {
  fastify.get('/servicos/dashboard', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    if (!PERFIS_DASH.includes(user.perfil)) return reply.code(403).send({ error: 'Acesso restrito' })

    const { inicio, fim, tecnicoId, setor } = { ...defaultPeriodo(), ...(req.query as any) }
    return reply.send(await getDashboardServicos(inicio, fim, tecnicoId ?? null, setor ?? null, user.id, user.perfil, prisma))
  })
}
```

---

## src/modules/servicos/servico-relatorio.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import NodeCache from 'node-cache'

const cache = new NodeCache({ stdTTL: 300 }) // 5min

function parsePeriodo(inicio: string, fim: string) {
  return { gte: new Date(inicio), lte: new Date(fim + 'T23:59:59.999Z') }
}

export async function gerarRelatorioServico(
  tipo: string, inicio: string, fim: string,
  tecnicoId: string | null, setor: string | null, diasParado: number,
  prisma: PrismaClient
): Promise<Buffer> {
  const key = `srv-rel:${tipo}:${inicio}:${fim}:${tecnicoId}:${setor}:${diasParado}`
  if (cache.has(key)) return cache.get(key) as Buffer

  const XLSX = await import('xlsx')
  const createdAt = parsePeriodo(inicio, fim)
  const where: any = { createdAt }
  if (tecnicoId) where.tecnicoDesignadoId = tecnicoId
  if (setor)     where.setorResponsavel   = setor

  let dados: any[] = []

  // ─── Lançados ──────────────────────────────────────────────────
  if (tipo === 'lancados') {
    const servicos = await prisma.servicoContratado.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        clienteBase:     { select: { razaoSocial: true, cnpj: true } },
        tipoServico:     { select: { nome: true, categoria: true } },
        tecnicoDesignado: { select: { nome: true } },
        lancadoPor:       { select: { nome: true } },
      },
    })
    dados = servicos.map((s) => ({
      'Número':      s.numero,
      'Cliente':     s.clienteBase.razaoSocial,
      'CNPJ':        s.clienteBase.cnpj,
      'Serviço':     s.tipoServico.nome,
      'Categoria':   s.tipoServico.categoria,
      'Prioridade':  s.prioridade,
      'Status':      s.statusGeral,
      'Lançado por': s.lancadoPor.nome,
      'Data':        s.createdAt.toLocaleDateString('pt-BR'),
      'Técnico':     s.tecnicoDesignado?.nome ?? '',
    }))
  }

  // ─── Financeiro ────────────────────────────────────────────────
  if (tipo === 'financeiro') {
    const servicos = await prisma.servicoContratado.findMany({
      where,
      include: {
        clienteBase: { select: { razaoSocial: true, cnpj: true } },
        tipoServico: { select: { nome: true } },
      },
    })
    dados = servicos.map((s) => ({
      'Número':            s.numero,
      'Cliente':           s.clienteBase.razaoSocial,
      'Serviço':           s.tipoServico.nome,
      'Valor padrão':      s.valorPadrao?.toFixed(2) ?? '',
      'Valor negociado':   s.valorNegociado?.toFixed(2) ?? '',
      'Desconto':          s.desconto?.toFixed(2) ?? '',
      'Forma pagamento':   s.formaPagamento ?? '',
      'Status financeiro': s.statusFinanceiro ?? '',
      'Valor cobrado':     s.valorCobrado?.toFixed(2) ?? '',
      'Valor pago':        s.valorPago?.toFixed(2) ?? '',
      'Data pagamento':    s.dataPagamento?.toLocaleDateString('pt-BR') ?? '',
      'Liberado':          s.liberadoParaExecucao ? 'Sim' : 'Não',
    }))
  }

  // ─── Técnico ───────────────────────────────────────────────────
  if (tipo === 'tecnico') {
    const servicos = await prisma.servicoContratado.findMany({
      where,
      include: {
        clienteBase:      { select: { razaoSocial: true } },
        tipoServico:      { select: { nome: true } },
        tecnicoDesignado: { select: { nome: true } },
      },
    })
    dados = servicos.map((s) => ({
      'Número':         s.numero,
      'Cliente':        s.clienteBase.razaoSocial,
      'Serviço':        s.tipoServico.nome,
      'Técnico':        s.tecnicoDesignado?.nome ?? 'Não designado',
      'Setor':          s.setorResponsavel ?? '',
      'Complexidade':   s.complexidade ?? '',
      'Status técnico': s.statusTecnico ?? '',
      'Prazo (dias úteis)': s.prazoDiasUteis ?? '',
      'Data prevista':  s.dataPrevista?.toLocaleDateString('pt-BR') ?? '',
      'Início execução': s.dataInicioExecucao?.toLocaleDateString('pt-BR') ?? '',
      'Conclusão':      s.dataConclusaoExecucao?.toLocaleDateString('pt-BR') ?? '',
      'Status final':   s.statusFinalExecucao ?? '',
    }))
  }

  // ─── Produtividade ─────────────────────────────────────────────
  if (tipo === 'produtividade') {
    const servicos = await prisma.servicoContratado.findMany({
      where: { ...where, tecnicoDesignadoId: { not: null } },
      include: {
        tecnicoDesignado: { select: { id: true, nome: true } },
      },
    })

    const mapa = new Map<string, { nome: string; total: number; concluidos: number; cancelados: number; tempos: number[]; receita: number }>()

    for (const s of servicos) {
      const tid = s.tecnicoDesignadoId!
      if (!mapa.has(tid)) mapa.set(tid, { nome: s.tecnicoDesignado!.nome, total: 0, concluidos: 0, cancelados: 0, tempos: [], receita: 0 })
      const r = mapa.get(tid)!
      r.total++
      if (s.statusGeral === 'Concluído') {
        r.concluidos++
        r.receita += Number(s.valorNegociado ?? 0)
        if (s.dataConclusaoExecucao) {
          r.tempos.push((s.dataConclusaoExecucao.getTime() - s.createdAt.getTime()) / 86_400_000)
        }
      }
      if (s.statusGeral === 'Cancelado') r.cancelados++
    }

    dados = [...mapa.values()].map((r) => ({
      'Técnico':          r.nome,
      'Total':            r.total,
      'Concluídos':       r.concluidos,
      'Cancelados':       r.cancelados,
      'Tempo médio (d)':  r.tempos.length > 0 ? (r.tempos.reduce((a, b) => a + b, 0) / r.tempos.length).toFixed(1) : '',
      'Receita gerada':   r.receita.toFixed(2),
    })).sort((a, b) => (b['Concluídos'] as number) - (a['Concluídos'] as number))
  }

  // ─── Gargalos ──────────────────────────────────────────────────
  if (tipo === 'gargalos') {
    const limite = new Date()
    limite.setDate(limite.getDate() - diasParado)

    const servicos = await prisma.servicoContratado.findMany({
      where: {
        statusGeral: { notIn: ['Concluído', 'Cancelado', 'Reprovado pelo cliente'] },
        updatedAt: { lte: limite },
      },
      include: {
        clienteBase:      { select: { razaoSocial: true } },
        tipoServico:      { select: { nome: true } },
        tecnicoDesignado: { select: { nome: true } },
      },
      orderBy: { updatedAt: 'asc' },
    })

    dados = servicos.map((s) => ({
      'Número':        s.numero,
      'Cliente':       s.clienteBase.razaoSocial,
      'Serviço':       s.tipoServico.nome,
      'Status':        s.statusGeral,
      'Dias parado':   Math.floor((Date.now() - s.updatedAt.getTime()) / 86_400_000),
      'Técnico':       s.tecnicoDesignado?.nome ?? 'Não designado',
      'Última atualiz.': s.updatedAt.toLocaleDateString('pt-BR'),
    }))
  }

  const ws = XLSX.utils.json_to_sheet(dados)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, tipo)
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  cache.set(key, buffer)
  return buffer
}
```

---

## src/modules/servicos/servico-relatorio.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { gerarRelatorioServico } from './servico-relatorio.service'

const PERFIS = ['SUPERVISAO', 'CEO', 'ADMIN', 'FINANCEIRO']

export async function servicoRelatorioRoutes(fastify: FastifyInstance) {
  fastify.get('/servicos/relatorios', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    if (!PERFIS.includes(user.perfil)) return reply.code(403).send({ error: 'Acesso restrito' })

    const {
      tipo = 'lancados', inicio, fim, tecnicoId, setor, diasParado = '7',
    } = req.query as any

    if (!inicio || !fim) return reply.code(400).send({ error: 'Parâmetros inicio e fim são obrigatórios' })

    const buffer = await gerarRelatorioServico(
      tipo, inicio, fim, tecnicoId ?? null, setor ?? null, Number(diasParado), prisma
    )

    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="relatorio-${tipo}-${inicio}-${fim}.xlsx"`)
      .send(buffer)
  })
}
```

---

## src/modules/servicos/checklist.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { registrarHistoricoServico } from '../../lib/historico-servico'

const PERFIS_GESTAO = ['SUPERVISAO', 'CEO', 'ADMIN']

export async function checklistRoutes(fastify: FastifyInstance) {

  // Listar checklist padrão por TipoServico
  fastify.get('/tipos-servico/:id/checklist', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    return reply.send(await prisma.checklistPadrao.findMany({
      where: { tipoServicoId: id, ativo: true },
      orderBy: { ordem: 'asc' },
    }))
  })

  // CRUD de ChecklistPadrao (ADMIN/CEO apenas)
  fastify.post('/tipos-servico/:id/checklist', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    if (!['CEO', 'ADMIN'].includes(user.perfil)) return reply.code(403).send({ error: 'Sem permissão' })
    const { id } = req.params as any
    const { descricao, ordem, obrigatorio = true } = req.body as any
    return reply.code(201).send(await prisma.checklistPadrao.create({
      data: { tipoServicoId: id, descricao, ordem, obrigatorio },
    }))
  })

  fastify.delete('/tipos-servico/checklist/:itemId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    if (!['CEO', 'ADMIN'].includes(user.perfil)) return reply.code(403).send({ error: 'Sem permissão' })
    const { itemId } = req.params as any
    await prisma.checklistPadrao.update({ where: { id: itemId }, data: { ativo: false } })
    return reply.code(204).send()
  })

  // Marcar item de checklist de um serviço
  fastify.patch('/servicos/:id/checklist/:itemId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const PODE = ['TECNICO', 'SUPERVISAO', 'CEO', 'ADMIN']
    if (!PODE.includes(user.perfil)) return reply.code(403).send({ error: 'Sem permissão' })

    const { id, itemId } = req.params as any
    const { concluido, observacao } = req.body as any

    const item = await prisma.checklistItemServico.update({
      where: { id: itemId },
      data: {
        concluido,
        concluidoEm:     concluido ? new Date() : null,
        concluidoPorId:  concluido ? user.id : null,
        observacao,
      },
    })

    await registrarHistoricoServico({
      servicoId: id,
      autorId: user.id,
      tipo: 'checklist_item_marcado',
      descricao: `Checklist: "${item.descricao}" marcado como ${concluido ? 'concluído' : 'pendente'}`,
    }, prisma)

    return reply.send(item)
  })

  // Dados extras (subtipo específico)
  fastify.patch('/servicos/:id/dados-extras', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const PODE = ['TECNICO', 'SUPERVISAO', 'CEO', 'ADMIN', 'FINANCEIRO']
    if (!PODE.includes(user.perfil)) return reply.code(403).send({ error: 'Sem permissão' })

    const { id } = req.params as any
    const dados = req.body as Record<string, any>

    const servico = await prisma.servicoContratado.update({
      where: { id },
      data: { dadosExtras: JSON.stringify(dados) },
    })

    await registrarHistoricoServico({
      servicoId: id, autorId: user.id,
      tipo: 'campo_editado',
      descricao: 'Detalhes específicos do serviço atualizados',
    }, prisma)

    return reply.send(servico)
  })
}
```

---

## src/modules/servicos/feriado.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'

export async function feriadoRoutes(fastify: FastifyInstance) {

  fastify.get('/feriados', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { ano } = req.query as any
    const where: any = { ativo: true }
    if (ano) {
      where.data = {
        gte: new Date(`${ano}-01-01`),
        lte: new Date(`${ano}-12-31`),
      }
    }
    return reply.send(await prisma.feriadoNacional.findMany({ where, orderBy: { data: 'asc' } }))
  })

  fastify.post('/feriados', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    if (user.perfil !== 'ADMIN') return reply.code(403).send({ error: 'Somente ADMIN pode cadastrar feriados' })
    const { data, descricao, tipo = 'Nacional', estado, cidade } = req.body as any
    return reply.code(201).send(
      await prisma.feriadoNacional.create({ data: { data: new Date(data), descricao, tipo, estado, cidade } })
    )
  })

  fastify.delete('/feriados/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    if (user.perfil !== 'ADMIN') return reply.code(403).send({ error: 'Somente ADMIN pode remover feriados' })
    const { id } = req.params as any
    await prisma.feriadoNacional.update({ where: { id }, data: { ativo: false } })
    return reply.code(204).send()
  })
}
```

---

## Registro no server.ts (adições Sprint 23)

```typescript
import { servicoDashboardRoutes } from './modules/servicos/servico-dashboard.routes'
import { servicoRelatorioRoutes } from './modules/servicos/servico-relatorio.routes'
import { checklistRoutes }        from './modules/servicos/checklist.routes'
import { feriadoRoutes }          from './modules/servicos/feriado.routes'

fastify.register(servicoDashboardRoutes)
fastify.register(servicoRelatorioRoutes)
fastify.register(checklistRoutes)
fastify.register(feriadoRoutes)
```

---

## Atualizar obterServico para incluir checklist e dadosExtras

```typescript
// Adicionar ao include do obterServico em servico.service.ts:
checklist: {
  include: { concluidoPor: { select: { id: true, nome: true } } },
  orderBy: { ordem: 'asc' },
},
// dadosExtras já está em ServicoContratado — transformar no retorno:
// servico.dadosExtrasObj = servico.dadosExtras ? JSON.parse(servico.dadosExtras) : {}
```

---

## Sprint 23 — BACKEND PRONTO ✅
