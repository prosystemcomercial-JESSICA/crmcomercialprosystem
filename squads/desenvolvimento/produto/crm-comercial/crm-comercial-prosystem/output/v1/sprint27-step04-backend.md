# Sprint 27 — Step 04 — Felipe Santos (Backend Developer)
# Agenda Avançada + Dashboard de Dia — Implementação Backend

---

## 1. tarefa.service.ts — CRUD + Queries

```typescript
import { prisma } from '../../lib/prisma'
import NodeCache from 'node-cache'

const cache = new NodeCache({ stdTTL: 300 }) // 5 min

// ─── LISTAR ──────────────────────────────────────────────────────────────

export async function listarTarefas(
  userId: string,
  filtros: { status?: string; prioridade?: string; leadId?: string; atribuidoPara?: string }
) {
  const cacheKey = `tarefas:${atribuidoPara ?? userId}:${filtros.status ?? 'all'}:${filtros.prioridade ?? 'all'}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const where: any = {
    atribuidoParaId: filtros.atribuidoPara ?? userId,
  }
  if (filtros.status)     where.status      = filtros.status
  if (filtros.prioridade) where.prioridade  = filtros.prioridade
  if (filtros.leadId)     where.leadId      = filtros.leadId

  const tarefas = await prisma.tarefa.findMany({
    where,
    orderBy: [
      { prioridade: 'asc' }, // ALTA primeiro
      { dataVencimento: 'asc' },
      { createdAt: 'desc' },
    ],
    include: {
      lead:       { select: { id: true, nomeEmpresa: true } },
      proposta:   { select: { id: true, titulo: true } },
      criadoPor:  { select: { id: true, nome: true } },
    },
  })

  cache.set(cacheKey, tarefas)
  return tarefas
}

// ─── CRIAR ────────────────────────────────────────────────────────────────

export async function criarTarefa(userId: string, dados: any) {
  const tarefa = await prisma.tarefa.create({
    data: {
      titulo:          dados.titulo,
      descricao:       dados.descricao,
      prioridade:      dados.prioridade,
      dataVencimento:  dados.dataVencimento ? new Date(dados.dataVencimento) : null,
      leadId:          dados.leadId,
      propostaId:      dados.propostaId,
      criadoPorId:     userId,
      atribuidoParaId: dados.atribuidoParaId ?? userId,
    },
    include: {
      lead:      { select: { id: true, nomeEmpresa: true } },
      proposta:  { select: { id: true, titulo: true } },
    },
  })

  // histórico do lead
  if (dados.leadId) {
    await prisma.historicoLead.create({
      data: {
        leadId:    dados.leadId,
        usuarioId: userId,
        tipo:      'tarefa_criada',
        descricao: `✅ Tarefa criada — ${dados.titulo}\nVencimento: ${dados.dataVencimento ? new Date(dados.dataVencimento).toLocaleDateString('pt-BR') : 'sem prazo'}`,
      },
    }).catch(() => {})
  }

  _invalidateTarefasCache(dados.atribuidoParaId ?? userId)
  return tarefa
}

// ─── ATUALIZAR ────────────────────────────────────────────────────────────

export async function atualizarTarefa(id: string, userId: string, dados: any) {
  const existente = await prisma.tarefa.findUnique({ where: { id } })
  if (!existente) throw { statusCode: 404, message: 'Tarefa não encontrada' }

  const podeEditar = existente.criadoPorId === userId || existente.atribuidoParaId === userId
  if (!podeEditar) throw { statusCode: 403, message: 'Sem permissão para editar' }

  const atualizada = await prisma.tarefa.update({
    where: { id },
    data: {
      ...(dados.titulo ? { titulo: dados.titulo } : {}),
      ...(dados.descricao ? { descricao: dados.descricao } : {}),
      ...(dados.prioridade ? { prioridade: dados.prioridade } : {}),
      ...(dados.dataVencimento !== undefined ? { dataVencimento: dados.dataVencimento ? new Date(dados.dataVencimento) : null } : {}),
      ...(dados.status ? { status: dados.status } : {}),
    },
    include: { lead: { select: { id: true } } },
  })

  // se mudou status para CONCLUIDA, registra no histórico
  if (dados.status === 'CONCLUIDA' && existente.status !== 'CONCLUIDA' && atualizada.leadId) {
    await prisma.historicoLead.create({
      data: {
        leadId:    atualizada.leadId,
        usuarioId: userId,
        tipo:      'tarefa_concluida',
        descricao: `✅ Tarefa concluída — ${atualizada.titulo}`,
      },
    }).catch(() => {})
  }

  _invalidateTarefasCache(existente.atribuidoParaId)
  return atualizada
}

// ─── CANCELAR ─────────────────────────────────────────────────────────────

export async function cancelarTarefa(id: string, userId: string) {
  const existente = await prisma.tarefa.findUnique({ where: { id }, include: { lead: true } })
  if (!existente) throw { statusCode: 404, message: 'Tarefa não encontrada' }

  await prisma.tarefa.update({
    where: { id },
    data: { status: 'CANCELADA' },
  })

  if (existente.leadId) {
    await prisma.historicoLead.create({
      data: {
        leadId:    existente.leadId,
        usuarioId: userId,
        tipo:      'tarefa_cancelada',
        descricao: `❌ Tarefa cancelada — ${existente.titulo}`,
      },
    }).catch(() => {})
  }

  _invalidateTarefasCache(existente.atribuidoParaId)
  return { cancelada: true }
}

// ─── BULK UPDATE ──────────────────────────────────────────────────────────

export async function bulkAtualizarTarefas(ids: string[], novoStatus: string, userId: string) {
  const tarefas = await prisma.tarefa.findMany({
    where: { id: { in: ids } },
    include: { lead: true },
  })

  // verifica permissão em todas
  for (const t of tarefas) {
    if (t.criadoPorId !== userId && t.atribuidoParaId !== userId) {
      throw { statusCode: 403, message: 'Sem permissão para editar uma ou mais tarefas' }
    }
  }

  // atualiza todas
  await prisma.tarefa.updateMany({
    where: { id: { in: ids } },
    data: { status: novoStatus },
  })

  // registra no histórico de cada lead
  for (const t of tarefas) {
    if (t.leadId) {
      const tipoHistorico = novoStatus === 'CONCLUIDA' ? 'tarefa_concluida' : 'tarefa_cancelada'
      await prisma.historicoLead.create({
        data: {
          leadId:    t.leadId,
          usuarioId: userId,
          tipo:      tipoHistorico,
          descricao: `${novoStatus === 'CONCLUIDA' ? '✅' : '❌'} Tarefa ${novoStatus === 'CONCLUIDA' ? 'concluída' : 'cancelada'} — ${t.titulo}`,
        },
      }).catch(() => {})
    }
  }

  _invalidateTarefasCache(userId)
  return { atualizadas: ids.length }
}

function _invalidateTarefasCache(userId: string) {
  const keys = cache.keys().filter(k => k.startsWith(`tarefas:${userId}`))
  cache.del(keys)
}
```

---

## 2. agenda-status.service.ts — Status Transitions

```typescript
import { prisma } from '../../lib/prisma'
import NodeCache from 'node-cache'

const cache = new NodeCache({ stdTTL: 120 })

// ─── MARCAR COMO REALIZADA ────────────────────────────────────────────────

export async function marcarComoRealizada(
  eventoId: string,
  userId: string,
  dados: { observacoes?: string; durationRealizada?: number }
) {
  const evento = await prisma.agendaEvento.findUnique({ where: { id: eventoId } })
  if (!evento) throw { statusCode: 404, message: 'Evento não encontrado' }

  const podeEditar = evento.criadoPorId === userId || (await _isSupervisor(userId))
  if (!podeEditar) throw { statusCode: 403, message: 'Sem permissão' }

  const agora = new Date()
  const atualizado = await prisma.agendaEvento.update({
    where: { id: eventoId },
    data: {
      status:           'REALIZADO',
      dataRealizacao:   agora,
      observacoes:      dados.observacoes,
      durationRealizada: dados.durationRealizada,
    },
    include: { lead: { select: { id: true, nomeEmpresa: true } } },
  })

  if (atualizado.leadId) {
    const duracao = dados.durationRealizada
      ? `(duração: ${dados.durationRealizada}min)`
      : `(agendado: ${Math.round((evento.dataFim.getTime() - evento.dataInicio.getTime()) / 60000)}min)`
    await prisma.historicoLead.create({
      data: {
        leadId:    atualizado.leadId,
        usuarioId: userId,
        tipo:      'reuniao_realizada',
        descricao: `✅ Reunião realizada — ${evento.titulo} ${duracao}${dados.observacoes ? `\n📝 ${dados.observacoes}` : ''}`,
      },
    }).catch(() => {})
  }

  _invalidateAgendaCache(evento.criadoPorId)
  return atualizado
}

// ─── REMARCAR ─────────────────────────────────────────────────────────────

export async function remarcarReuniao(
  eventoId: string,
  userId: string,
  dados: { novaData: string; novaHora: string; motivo?: string }
) {
  const evento = await prisma.agendaEvento.findUnique({ where: { id: eventoId } })
  if (!evento) throw { statusCode: 404, message: 'Evento não encontrado' }

  const podeEditar = evento.criadoPorId === userId || (await _isSupervisor(userId))
  if (!podeEditar) throw { statusCode: 403, message: 'Sem permissão' }

  // calcula nova data
  const [hora, min] = dados.novaHora.split(':')
  const novaDataInicio = new Date(`${dados.novaData}T${hora}:${min}:00`)
  const novaDataFim = new Date(novaDataInicio.getTime() + (evento.dataFim.getTime() - evento.dataInicio.getTime()))

  // atualiza no Google se houver
  if (evento.googleEventId) {
    try {
      const authClient = await (await import('../../lib/google-token')).getAuthenticatedClient(evento.criadoPorId)
      const { calendar } = await import('googleapis')
      const cal = calendar({ version: 'v3', auth: authClient })
      await cal.events.patch({
        calendarId:  'primary',
        eventId:     evento.googleEventId,
        sendUpdates: 'all',
        requestBody: {
          start: { dateTime: novaDataInicio.toISOString(), timeZone: 'America/Sao_Paulo' },
          end:   { dateTime: novaDataFim.toISOString(),   timeZone: 'America/Sao_Paulo' },
        },
      })
    } catch (err) {
      console.error('[Agenda] Google Calendar error on reschedule:', err)
    }
  }

  const atualizado = await prisma.agendaEvento.update({
    where: { id: eventoId },
    data: {
      status:       'REAGENDADO',
      dataInicio:   novaDataInicio,
      dataFim:      novaDataFim,
      observacoes:  dados.motivo ? `Remarque motivo: ${dados.motivo}` : undefined,
    },
    include: { lead: { select: { id: true } } },
  })

  if (atualizado.leadId) {
    const dataAntiga = evento.dataInicio.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const dataNova   = novaDataInicio.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    await prisma.historicoLead.create({
      data: {
        leadId:    atualizado.leadId,
        usuarioId: userId,
        tipo:      'reuniao_remarcada',
        descricao: `📅 Reunião remarcada — ${evento.titulo}\n${dataAntiga} → ${dataNova}${dados.motivo ? `\nMotivo: ${dados.motivo}` : ''}`,
      },
    }).catch(() => {})
  }

  _invalidateAgendaCache(evento.criadoPorId)
  return atualizado
}

// ─── MARCAR NÃO COMPARECEU ────────────────────────────────────────────────

export async function marcarNaoCompareceu(
  eventoId: string,
  userId: string,
  dados: { motivo?: string; tentoouContato?: boolean }
) {
  const evento = await prisma.agendaEvento.findUnique({ where: { id: eventoId } })
  if (!evento) throw { statusCode: 404, message: 'Evento não encontrado' }

  const podeEditar = evento.criadoPorId === userId || (await _isSupervisor(userId))
  if (!podeEditar) throw { statusCode: 403, message: 'Sem permissão' }

  const atualizado = await prisma.agendaEvento.update({
    where: { id: eventoId },
    data: {
      status:       'NAO_COMPARECEU',
      observacoes:  dados.motivo ? `Não compareceu: ${dados.motivo}` : undefined,
    },
    include: { lead: { select: { id: true } } },
  })

  if (atualizado.leadId) {
    await prisma.historicoLead.create({
      data: {
        leadId:    atualizado.leadId,
        usuarioId: userId,
        tipo:      'reuniao_nao_compareceu',
        descricao: `❌ Cliente não compareceu — ${evento.titulo}${dados.tentoouContato ? '\n📞 Tentativa de contato realizada' : ''}${dados.motivo ? `\nMotivo: ${dados.motivo}` : ''}`,
      },
    }).catch(() => {})
  }

  _invalidateAgendaCache(evento.criadoPorId)
  return atualizado
}

// ─── BULK STATUS UPDATE ────────────────────────────────────────────────────

export async function bulkAtualizarStatus(ids: string[], novoStatus: string, userId: string) {
  const eventos = await prisma.agendaEvento.findMany({
    where: { id: { in: ids } },
    include: { lead: true },
  })

  // verifica permissão
  for (const e of eventos) {
    if (e.criadoPorId !== userId && !(await _isSupervisor(userId))) {
      throw { statusCode: 403, message: 'Sem permissão para editar um ou mais eventos' }
    }
  }

  const agora = new Date()
  await prisma.agendaEvento.updateMany({
    where: { id: { in: ids } },
    data: { 
      status: novoStatus,
      ...(novoStatus === 'REALIZADO' ? { dataRealizacao: agora } : {}),
    },
  })

  // registra em histórico
  for (const e of eventos) {
    if (e.leadId) {
      const tipoHistorico = novoStatus === 'REALIZADO' ? 'reuniao_realizada' : novoStatus === 'NAO_COMPARECEU' ? 'reuniao_nao_compareceu' : 'reuniao_cancelada'
      await prisma.historicoLead.create({
        data: {
          leadId:    e.leadId,
          usuarioId: userId,
          tipo:      tipoHistorico,
          descricao: `${novoStatus === 'REALIZADO' ? '✅' : '❌'} Reunião marcada como ${novoStatus} — ${e.titulo}`,
        },
      }).catch(() => {})
    }
  }

  _invalidateAgendaCache(userId)
  return { atualizados: ids.length }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function _isSupervisor(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  return ['SUPERVISAO', 'CEO', 'ADMIN'].includes(user?.role ?? '')
}

function _invalidateAgendaCache(userId: string) {
  const keys = cache.keys().filter(k => k.startsWith(`agenda:eventos:${userId}`))
  cache.del(keys)
  const badgeKeys = cache.keys().filter(k => k.startsWith(`agenda:badge:${userId}`))
  cache.del(badgeKeys)
}
```

---

## 3. dashboard.service.ts — Semáforo do Dia

```typescript
import { prisma } from '../../lib/prisma'
import { calcularSemaforoHoje } from '../../lib/semaforo'
import NodeCache from 'node-cache'

const cache = new NodeCache({ stdTTL: 600 }) // 10 min

export async function getDashboardDia(userId: string, vendedorId?: string) {
  const parId = vendedorId ?? userId
  const cacheKey = `dash:dia:${parId}:${new Date().toISOString().split('T')[0]}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  // verifica permissão
  if (vendedorId && vendedorId !== userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    if (!['SUPERVISAO', 'CEO', 'ADMIN'].includes(user?.role ?? '')) {
      throw { statusCode: 403, message: 'Sem permissão' }
    }
  }

  const { status, cor, indicadores } = await calcularSemaforoHoje(parId)

  // próximas 3 reuniões do dia
  const hoje = new Date()
  const amanha = new Date(hoje)
  amanha.setDate(amanha.getDate() + 1)

  const proximasReuniones = await prisma.agendaEvento.findMany({
    where: {
      criadoPorId: parId,
      dataInicio: { gte: hoje, lt: amanha },
      status: { notIn: ['CANCELADO'] },
    },
    orderBy: { dataInicio: 'asc' },
    take: 3,
    select: {
      id: true,
      titulo: true,
      dataInicio: true,
      dataFim: true,
      lead: { select: { id: true, nomeEmpresa: true } },
      hangoutLink: true,
    },
  })

  const dashboard = {
    vendedorId: parId,
    data: new Date().toISOString().split('T')[0],
    semaforo: {
      status,
      cor,
      ...indicadores,
    },
    proximasReuniones: proximasReuniones.map(r => ({
      ...r,
      dataInicio: r.dataInicio.toISOString(),
      dataFim: r.dataFim.toISOString(),
    })),
  }

  cache.set(cacheKey, dashboard)
  return dashboard
}
```

---

## 4. relatorio-agenda.service.ts — Relatório XLSX

```typescript
import { prisma } from '../../lib/prisma'
import { utils as xlsxUtils, write } from 'xlsx'
import NodeCache from 'node-cache'

const cache = new NodeCache({ stdTTL: 1800 }) // 30 min

export async function gerarRelatorioAgenda(
  inicio: string,
  fim: string,
  vendedorId?: string,
  userId?: string
) {
  const cacheKey = `agenda:rel:${inicio}:${fim}:${vendedorId ?? 'all'}`
  const cached = cache.get<Buffer>(cacheKey)
  if (cached) return cached

  const inicioDate = new Date(inicio)
  const fimDate    = new Date(fim)

  const where: any = {
    dataInicio: { gte: inicioDate, lte: fimDate },
  }
  if (vendedorId) where.criadoPorId = vendedorId

  const eventos = await prisma.agendaEvento.findMany({
    where,
    include: {
      criadoPor: { select: { nome: true } },
      lead:      { select: { nomeEmpresa: true } },
    },
    orderBy: { dataInicio: 'asc' },
  })

  // calcula resumo
  const totalAgendado = eventos.length
  const totalRealizado = eventos.filter(e => e.status === 'REALIZADO').length
  const naoCompareceu  = eventos.filter(e => e.status === 'NAO_COMPARECEU').length
  const remarcadas     = eventos.filter(e => e.status === 'REAGENDADO').length
  const canceladas     = eventos.filter(e => e.status === 'CANCELADO').length

  const taxaConclusao = totalAgendado > 0 ? Math.round((totalRealizado / (totalAgendado - canceladas)) * 100) : 0
  const taxaNoShow    = totalAgendado > 0 ? Math.round((naoCompareceu / totalAgendado) * 100) : 0

  // por vendedor
  const porVendedor = new Map<string, { total: number; realizado: number; noshow: number }>()
  eventos.forEach(e => {
    const vendedor = e.criadoPor.nome
    const stats = porVendedor.get(vendedor) ?? { total: 0, realizado: 0, noshow: 0 }
    stats.total++
    if (e.status === 'REALIZADO') stats.realizado++
    if (e.status === 'NAO_COMPARECEU') stats.noshow++
    porVendedor.set(vendedor, stats)
  })

  // sheet 1: resumo
  const resumoData = [
    ['RESUMO GERAL — AGENDA'],
    [`Período: ${new Date(inicio).toLocaleDateString('pt-BR')} a ${new Date(fim).toLocaleDateString('pt-BR')}`],
    [],
    ['Total agendado', totalAgendado],
    ['Total realizado', totalRealizado],
    ['Taxa conclusão (%)', taxaConclusao],
    ['Não compareceu', naoCompareceu],
    ['Taxa no-show (%)', taxaNoShow],
    ['Remarcadas', remarcadas],
    ['Canceladas', canceladas],
    [],
    ['POR VENDEDOR'],
    ['Vendedor', 'Total', 'Realizado', 'Taxa (%)', 'No-show (%)'],
  ]

  porVendedor.forEach((stats, vendedor) => {
    const taxa = stats.total > 0 ? Math.round((stats.realizado / stats.total) * 100) : 0
    const taxaNoShowVend = stats.total > 0 ? Math.round((stats.noshow / stats.total) * 100) : 0
    resumoData.push([vendedor, stats.total, stats.realizado, taxa, taxaNoShowVend])
  })

  // sheet 2: detalhe
  const detalheData = [
    ['Data', 'Hora', 'Vendedor', 'Lead', 'Tipo', 'Status', 'Duração (min)'],
  ]

  eventos.forEach(e => {
    const data = e.dataInicio.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const hora = e.dataInicio.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
    const duracao = Math.round((e.dataFim.getTime() - e.dataInicio.getTime()) / 60000)
    detalheData.push([
      data,
      hora,
      e.criadoPor.nome,
      e.lead?.nomeEmpresa ?? '—',
      e.tipo,
      e.status,
      duracao,
    ])
  })

  // cria workbook
  const wb = xlsxUtils.book_new()
  const wsResumo = xlsxUtils.aoa_to_sheet(resumoData)
  const wsDetalhe = xlsxUtils.aoa_to_sheet(detalheData)

  // auto-width
  wsResumo['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }]
  wsDetalhe['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 }]

  xlsxUtils.book_append_sheet(wb, wsResumo, 'Resumo')
  xlsxUtils.book_append_sheet(wb, wsDetalhe, 'Detalhe')

  const buffer = write(wb, { type: 'buffer', bookType: 'xlsx' })
  cache.set(cacheKey, buffer)
  return buffer
}
```

---

## 5. agenda.routes.ts — Extensão (novas rotas)

```typescript
// Adicionar ao arquivo existente:

app.patch('/agenda/eventos/:id/realizado', { preHandler: [authenticate] }, async (req: any, reply) => {
  const user = (req as any).user
  const dados = z.object({ observacoes: z.string().optional(), durationRealizada: z.number().optional() }).parse(req.body)
  const resultado = await marcarComoRealizada(req.params.id, user.id, dados)
  return reply.send(resultado)
})

app.patch('/agenda/eventos/:id/remarcar', { preHandler: [authenticate] }, async (req: any, reply) => {
  const user = (req as any).user
  const dados = z.object({ novaData: z.string(), novaHora: z.string(), motivo: z.string().optional() }).parse(req.body)
  const resultado = await remarcarReuniao(req.params.id, user.id, dados)
  return reply.send(resultado)
})

app.patch('/agenda/eventos/:id/nao-compareceu', { preHandler: [authenticate] }, async (req: any, reply) => {
  const user = (req as any).user
  const dados = z.object({ motivo: z.string().optional(), tentoouContato: z.boolean().optional() }).parse(req.body)
  const resultado = await marcarNaoCompareceu(req.params.id, user.id, dados)
  return reply.send(resultado)
})

app.patch('/agenda/eventos/bulk', { preHandler: [authenticate] }, async (req: any, reply) => {
  const user = (req as any).user
  const { ids, status } = z.object({ ids: z.array(z.string()), status: z.string() }).parse(req.body)
  const resultado = await bulkAtualizarStatus(ids, status, user.id)
  return reply.send(resultado)
})

app.get('/agenda/relatorios', { preHandler: [authenticate] }, async (req: any, reply) => {
  const user = (req as any).user
  const { tipo, inicio, fim, vendedorId } = req.query

  if (!tipo || !inicio || !fim) {
    return reply.status(400).send({ message: 'Parâmetros tipo, inicio, fim são obrigatórios' })
  }

  if (vendedorId && vendedorId !== user.id && !['SUPERVISAO','CEO','ADMIN'].includes(user.role)) {
    return reply.status(403).send({ message: 'Sem permissão' })
  }

  const buffer = await gerarRelatorioAgenda(inicio, fim, vendedorId, user.id)
  reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  reply.header('Content-Disposition', `attachment; filename="relatorio-agenda-${inicio}-${fim}.xlsx"`)
  return reply.send(buffer)
})
```

---

## 6. tarefas.routes.ts — Novas rotas

```typescript
import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/auth'
import { listarTarefas, criarTarefa, atualizarTarefa, cancelarTarefa, bulkAtualizarTarefas } from './tarefa.service'
import { criarTarefaSchema, updateTarefaSchema } from './tarefa.schema'

export async function tarefasRoutes(app: FastifyInstance) {
  app.get('/tarefas', { preHandler: [authenticate] }, async (req: any, reply) => {
    const user = (req as any).user
    const filtros = req.query
    const tarefas = await listarTarefas(user.id, filtros)
    return reply.send(tarefas)
  })

  app.post('/tarefas', { preHandler: [authenticate] }, async (req: any, reply) => {
    const user = (req as any).user
    const dados = criarTarefaSchema.parse(req.body)
    const tarefa = await criarTarefa(user.id, dados)
    return reply.status(201).send(tarefa)
  })

  app.patch('/tarefas/:id', { preHandler: [authenticate] }, async (req: any, reply) => {
    const user = (req as any).user
    const dados = updateTarefaSchema.parse(req.body)
    const tarefa = await atualizarTarefa(req.params.id, user.id, dados)
    return reply.send(tarefa)
  })

  app.delete('/tarefas/:id', { preHandler: [authenticate] }, async (req: any, reply) => {
    const user = (req as any).user
    const resultado = await cancelarTarefa(req.params.id, user.id)
    return reply.send(resultado)
  })

  app.patch('/tarefas/bulk', { preHandler: [authenticate] }, async (req: any, reply) => {
    const user = (req as any).user
    const { ids, status } = req.body
    const resultado = await bulkAtualizarTarefas(ids, status, user.id)
    return reply.send(resultado)
  })
}
```

---

## 7. dashboard.routes.ts — Nova rota

```typescript
app.get('/dashboard/dia', { preHandler: [authenticate] }, async (req: any, reply) => {
  const user = (req as any).user
  const { vendedorId } = req.query
  const dashboard = await getDashboardDia(user.id, vendedorId)
  return reply.send(dashboard)
})
```

---

## Sprint 27 — STEP 04 PRONTO ✅
