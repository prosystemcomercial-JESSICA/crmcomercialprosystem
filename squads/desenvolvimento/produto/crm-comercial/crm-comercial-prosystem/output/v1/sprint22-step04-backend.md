# Sprint 22 — Step 04 — Felipe Santos (Backend)
# Módulo de Serviços Contratados — Implementação API

---

## src/lib/gerar-numero-srv.ts

```typescript
import { PrismaClient } from '@prisma/client'

export async function gerarNumeroServico(prisma: PrismaClient): Promise<string> {
  const result = await prisma.$queryRaw<[{ nextval: bigint }]>`
    SELECT nextval('srv_numero_seq') as nextval
  `
  const seq = Number(result[0].nextval)
  const ano = new Date().getFullYear()
  return `SRV-${ano}-${String(seq).padStart(5, '0')}`
}
```

---

## src/lib/historico-servico.ts

```typescript
import { PrismaClient } from '@prisma/client'

type Input = {
  servicoId: string
  autorId: string
  tipo: string
  descricao: string
  campoAlterado?: string
  valorAnterior?: string
  valorNovo?: string
}

export async function registrarHistoricoServico(input: Input, prisma: PrismaClient) {
  return prisma.historicoServico.create({ data: input })
}
```

---

## src/modules/servicos/cliente-base.service.ts

```typescript
import { PrismaClient } from '@prisma/client'

export async function listarClientesBase(
  filtros: {
    q?: string
    status?: string
    segmento?: string
    plano?: string
    cidade?: string
  },
  prisma: PrismaClient
) {
  const where: any = { ativo: true }
  if (filtros.status) where.statusCliente = filtros.status
  if (filtros.segmento) where.segmento = filtros.segmento
  if (filtros.plano) where.planoAtual = filtros.plano
  if (filtros.cidade) where.cidade = { contains: filtros.cidade, mode: 'insensitive' }
  if (filtros.q) {
    where.OR = [
      { razaoSocial: { contains: filtros.q, mode: 'insensitive' } },
      { nomeFantasia: { contains: filtros.q, mode: 'insensitive' } },
      { cnpj: { contains: filtros.q } },
      { codigoProsystem: { contains: filtros.q } },
    ]
  }

  const [clientes, total] = await Promise.all([
    prisma.clienteBase.findMany({
      where,
      orderBy: { razaoSocial: 'asc' },
      include: {
        _count: { select: { servicosContratados: true } },
      },
    }),
    prisma.clienteBase.count({ where }),
  ])

  return { clientes, total }
}

export async function obterClienteBase(id: string, prisma: PrismaClient) {
  return prisma.clienteBase.findUniqueOrThrow({
    where: { id },
    include: {
      servicosContratados: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true, numero: true, statusGeral: true, prioridade: true, createdAt: true,
          tipoServico: { select: { nome: true } },
        },
      },
    },
  })
}

export async function criarClienteBase(data: any, prisma: PrismaClient) {
  return prisma.clienteBase.create({ data })
}

export async function editarClienteBase(id: string, data: any, prisma: PrismaClient) {
  return prisma.clienteBase.update({ where: { id }, data })
}

export async function importarClientesCSV(
  rows: Record<string, string>[],
  prisma: PrismaClient
) {
  let criados = 0, atualizados = 0, erros: string[] = []

  for (const row of rows) {
    const cnpj = row['cnpj']?.replace(/\D/g, '')
    if (!cnpj) { erros.push(`Linha sem CNPJ: ${JSON.stringify(row)}`); continue }

    try {
      const existing = await prisma.clienteBase.findUnique({ where: { cnpj } })
      if (existing) {
        await prisma.clienteBase.update({
          where: { cnpj },
          data: {
            razaoSocial:    row['razao_social'] || existing.razaoSocial,
            nomeFantasia:   row['nome_fantasia'] || existing.nomeFantasia,
            statusCliente:  row['status'] || existing.statusCliente,
            planoAtual:     row['plano'] || existing.planoAtual,
            segmento:       row['segmento'] || existing.segmento,
            updatedAt:      new Date(),
          },
        })
        atualizados++
      } else {
        await prisma.clienteBase.create({
          data: {
            cnpj,
            razaoSocial:  row['razao_social'] || 'Importado',
            nomeFantasia: row['nome_fantasia'],
            segmento:     row['segmento'] || 'Outro',
            statusCliente: row['status'] || 'Ativo',
            planoAtual:   row['plano'],
            codigoProsystem: row['codigo_prosystem'],
          },
        })
        criados++
      }
    } catch (e: any) {
      erros.push(`CNPJ ${cnpj}: ${e.message}`)
    }
  }

  return { criados, atualizados, erros }
}
```

---

## src/modules/servicos/tipo-servico.service.ts

```typescript
import { PrismaClient } from '@prisma/client'

export async function listarTiposServico(
  filtros: { categoria?: string; ativo?: boolean },
  prisma: PrismaClient
) {
  const where: any = {}
  if (filtros.ativo !== undefined) where.ativo = filtros.ativo
  if (filtros.categoria) where.categoria = filtros.categoria

  return prisma.tipoServico.findMany({
    where,
    orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    include: { tecnicoResponsavel: { select: { id: true, nome: true } } },
  })
}

export async function criarTipoServico(data: any, prisma: PrismaClient) {
  return prisma.tipoServico.create({ data })
}

export async function editarTipoServico(id: string, data: any, prisma: PrismaClient) {
  return prisma.tipoServico.update({ where: { id }, data })
}
```

---

## src/modules/servicos/servico.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import { gerarNumeroServico } from '../../lib/gerar-numero-srv'
import { registrarHistoricoServico } from '../../lib/historico-servico'

// ─── helpers ──────────────────────────────────────────────────────────────────

const PERFIS_TODOS  = ['VENDEDOR', 'SUPERVISAO', 'CEO', 'ADMIN', 'FINANCEIRO', 'TECNICO']
const PERFIS_GESTAO = ['SUPERVISAO', 'CEO', 'ADMIN']
const PERFIS_FIN    = ['FINANCEIRO', 'SUPERVISAO', 'CEO', 'ADMIN']
const PERFIS_TEC    = ['TECNICO', 'SUPERVISAO', 'CEO', 'ADMIN']

function calcularDataPrevista(diasUteis: number): Date {
  const data = new Date()
  let adicionados = 0
  while (adicionados < diasUteis) {
    data.setDate(data.getDate() + 1)
    const dow = data.getDay()
    if (dow !== 0 && dow !== 6) adicionados++
  }
  return data
}

// ─── listagem ─────────────────────────────────────────────────────────────────

export async function listarServicos(
  filtros: {
    statusGeral?: string
    prioridade?: string
    tipoServicoId?: string
    tecnicoDesignadoId?: string
    lancadoPorId?: string
    dataInicio?: string
    dataFim?: string
    clienteBaseId?: string
    page?: number
    limit?: number
  },
  userId: string,
  perfil: string,
  prisma: PrismaClient
) {
  const where: any = {}

  // VENDEDOR: só vê os que lançou
  if (perfil === 'VENDEDOR') where.lancadoPorId = userId
  // TECNICO: só vê os designados a ele
  if (perfil === 'TECNICO') where.tecnicoDesignadoId = userId

  if (filtros.statusGeral)       where.statusGeral = filtros.statusGeral
  if (filtros.prioridade)        where.prioridade = filtros.prioridade
  if (filtros.tipoServicoId)     where.tipoServicoId = filtros.tipoServicoId
  if (filtros.tecnicoDesignadoId) where.tecnicoDesignadoId = filtros.tecnicoDesignadoId
  if (filtros.lancadoPorId)      where.lancadoPorId = filtros.lancadoPorId
  if (filtros.clienteBaseId)     where.clienteBaseId = filtros.clienteBaseId
  if (filtros.dataInicio || filtros.dataFim) {
    where.createdAt = {}
    if (filtros.dataInicio) where.createdAt.gte = new Date(filtros.dataInicio)
    if (filtros.dataFim)    where.createdAt.lte = new Date(filtros.dataFim + 'T23:59:59Z')
  }

  const page  = filtros.page  ?? 1
  const limit = filtros.limit ?? 20
  const skip  = (page - 1) * limit

  const [servicos, total] = await Promise.all([
    prisma.servicoContratado.findMany({
      where,
      orderBy: [{ prioridade: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      include: {
        clienteBase:     { select: { razaoSocial: true, nomeFantasia: true, cnpj: true } },
        tipoServico:     { select: { nome: true, categoria: true } },
        tecnicoDesignado: { select: { id: true, nome: true } },
        lancadoPor:      { select: { id: true, nome: true } },
      },
    }),
    prisma.servicoContratado.count({ where }),
  ])

  return { servicos, total, page, totalPages: Math.ceil(total / limit) }
}

// ─── obter ────────────────────────────────────────────────────────────────────

export async function obterServico(id: string, userId: string, perfil: string, prisma: PrismaClient) {
  const servico = await prisma.servicoContratado.findUniqueOrThrow({
    where: { id },
    include: {
      clienteBase:      true,
      tipoServico:      true,
      tecnicoDesignado: { select: { id: true, nome: true, perfil: true } },
      lancadoPor:       { select: { id: true, nome: true } },
      liberadoPor:      { select: { id: true, nome: true } },
      anexos: {
        include: { uploadadoPor: { select: { id: true, nome: true } } },
        orderBy: { createdAt: 'desc' },
      },
      comunicacoes: {
        include: { remetente: { select: { id: true, nome: true } } },
        orderBy: { dataEnvio: 'asc' },
      },
      historicos: {
        include: { autor: { select: { id: true, nome: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  // filtra anexos internos para VENDEDOR
  if (perfil === 'VENDEDOR') {
    servico.anexos = servico.anexos.filter((a: any) => a.visibilidade !== 'Interno')
  }

  return servico
}

// ─── criar ────────────────────────────────────────────────────────────────────

export async function criarServico(data: any, userId: string, prisma: PrismaClient) {
  const numero = await gerarNumeroServico(prisma)
  const tipoServico = await prisma.tipoServico.findUniqueOrThrow({ where: { id: data.tipoServicoId } })

  const servico = await prisma.servicoContratado.create({
    data: {
      numero,
      clienteBaseId:   data.clienteBaseId,
      tipoServicoId:   data.tipoServicoId,
      lojaSolicitante: data.lojaSolicitante,
      origemSolicitacao: data.origemSolicitacao,
      canalEntrada:    data.canalEntrada,
      prioridade:      data.prioridade ?? 'Normal',
      statusGeral:     data.statusGeral ?? 'Lançado',
      nomeSolicitante: data.nomeSolicitante,
      cargoSolicitante: data.cargoSolicitante,
      telefoneSolicitante: data.telefoneSolicitante,
      whatsappSolicitante: data.whatsappSolicitante,
      emailSolicitante: data.emailSolicitante,
      responsavelAutorizado: data.responsavelAutorizado,
      descricaoSolicitacao: data.descricaoSolicitacao,
      problemaNecessidade: data.problemaNecessidade,
      resultadoEsperado: data.resultadoEsperado,
      lojasEnvolvidas: data.lojasEnvolvidas,
      prazoDesejadoCliente: data.prazoDesejadoCliente ? new Date(data.prazoDesejadoCliente) : null,
      observacoesGerais: data.observacoesGerais,
      valorPadrao: tipoServico.valorPadrao,
      lancadoPorId: userId,
    },
  })

  await registrarHistoricoServico({
    servicoId: servico.id,
    autorId: userId,
    tipo: 'servico_criado',
    descricao: `Serviço ${numero} criado — ${tipoServico.nome}`,
  }, prisma)

  return servico
}

// ─── atualizar status geral ───────────────────────────────────────────────────

export async function atualizarStatusGeral(
  id: string, novoStatus: string, userId: string, prisma: PrismaClient
) {
  const atual = await prisma.servicoContratado.findUniqueOrThrow({ where: { id } })
  const servico = await prisma.servicoContratado.update({
    where: { id },
    data: { statusGeral: novoStatus },
  })

  await registrarHistoricoServico({
    servicoId: id, autorId: userId,
    tipo: 'status_alterado',
    descricao: `Status alterado: ${atual.statusGeral} → ${novoStatus}`,
    campoAlterado: 'statusGeral',
    valorAnterior: atual.statusGeral,
    valorNovo: novoStatus,
  }, prisma)

  return servico
}

// ─── atualizar aba comercial ──────────────────────────────────────────────────

export async function atualizarComercial(
  id: string, data: any, userId: string, prisma: PrismaClient
) {
  const servico = await prisma.servicoContratado.update({
    where: { id },
    data: {
      valorNegociado:    data.valorNegociado,
      desconto:          data.desconto,
      motivoDesconto:    data.motivoDesconto,
      formaPagamento:    data.formaPagamento,
      aprovadoEmData:    data.aprovadoEmData ? new Date(data.aprovadoEmData) : undefined,
      aprovadoPorCliente: data.aprovadoPorCliente,
      comoAprovou:       data.comoAprovou,
      observacoesComerciais: data.observacoesComerciais,
    },
  })

  await registrarHistoricoServico({
    servicoId: id, autorId: userId,
    tipo: 'campo_editado', descricao: 'Aba Comercial atualizada',
  }, prisma)

  if (data.aprovadoPorCliente && data.aprovadoEmData) {
    await registrarHistoricoServico({
      servicoId: id, autorId: userId,
      tipo: 'aprovacao_cliente',
      descricao: `Aprovação registrada: ${data.aprovadoPorCliente} via ${data.comoAprovou}`,
    }, prisma)

    // avança status se ainda em rascunho/lançado
    const statusAtual = servico.statusGeral
    if (['Rascunho', 'Lançado', 'Aguardando análise comercial', 'Aguardando orçamento',
         'Orçamento enviado', 'Aguardando aprovação do cliente'].includes(statusAtual)) {
      await atualizarStatusGeral(id, 'Aprovado pelo cliente', userId, prisma)
    }
  }

  return servico
}

// ─── atualizar aba financeiro ─────────────────────────────────────────────────

export async function atualizarFinanceiro(
  id: string, data: any, userId: string, prisma: PrismaClient
) {
  const updates: any = {
    statusFinanceiro:   data.statusFinanceiro,
    valorCobrado:       data.valorCobrado,
    dataCobranca:       data.dataCobranca   ? new Date(data.dataCobranca)   : undefined,
    dataVencimento:     data.dataVencimento ? new Date(data.dataVencimento) : undefined,
    dataPagamento:      data.dataPagamento  ? new Date(data.dataPagamento)  : undefined,
    valorPago:          data.valorPago,
    observacoesFinanceiro: data.observacoesFinanceiro,
  }

  if (data.liberadoParaExecucao === true) {
    updates.liberadoParaExecucao = true
    updates.dataLiberacao  = new Date()
    updates.liberadoPorId  = userId

    await registrarHistoricoServico({
      servicoId: id, autorId: userId,
      tipo: 'liberado_para_execucao',
      descricao: 'Serviço liberado para execução pelo financeiro',
    }, prisma)
  }

  const servico = await prisma.servicoContratado.update({ where: { id }, data: updates })

  if (data.statusFinanceiro) {
    await registrarHistoricoServico({
      servicoId: id, autorId: userId,
      tipo: 'status_financeiro_alterado',
      descricao: `Status financeiro: ${data.statusFinanceiro}`,
      campoAlterado: 'statusFinanceiro', valorNovo: data.statusFinanceiro,
    }, prisma)
  }

  if (data.dataPagamento) {
    await registrarHistoricoServico({
      servicoId: id, autorId: userId,
      tipo: 'pagamento_registrado',
      descricao: `Pagamento registrado: R$ ${data.valorPago ?? data.valorCobrado}`,
    }, prisma)
  }

  return servico
}

// ─── atualizar aba técnica ────────────────────────────────────────────────────

export async function atualizarTecnico(
  id: string, data: any, userId: string, prisma: PrismaClient
) {
  const atual = await prisma.servicoContratado.findUniqueOrThrow({ where: { id } })
  const updates: any = {
    setorResponsavel:     data.setorResponsavel,
    complexidade:         data.complexidade,
    statusTecnico:        data.statusTecnico,
    prazoDiasUteis:       data.prazoDiasUteis,
    observacoesTecnicas:  data.observacoesTecnicas,
  }

  if (data.tecnicoDesignadoId) {
    updates.tecnicoDesignadoId = data.tecnicoDesignadoId
    if (data.prazoDiasUteis) {
      updates.dataPrevista = calcularDataPrevista(data.prazoDiasUteis)
    }
  }

  const servico = await prisma.servicoContratado.update({ where: { id }, data: updates })

  if (data.tecnicoDesignadoId && data.tecnicoDesignadoId !== atual.tecnicoDesignadoId) {
    const tecnico = await prisma.user.findUnique({
      where: { id: data.tecnicoDesignadoId }, select: { nome: true },
    })
    await registrarHistoricoServico({
      servicoId: id, autorId: userId,
      tipo: 'tecnico_designado',
      descricao: `Técnico designado: ${tecnico?.nome}`,
      campoAlterado: 'tecnicoDesignadoId',
      valorNovo: data.tecnicoDesignadoId,
    }, prisma)
  }

  if (data.statusTecnico && data.statusTecnico !== atual.statusTecnico) {
    await registrarHistoricoServico({
      servicoId: id, autorId: userId,
      tipo: 'status_tecnico_alterado',
      descricao: `Status técnico: ${atual.statusTecnico} → ${data.statusTecnico}`,
      campoAlterado: 'statusTecnico',
      valorAnterior: atual.statusTecnico,
      valorNovo: data.statusTecnico,
    }, prisma)
  }

  return servico
}

// ─── atualizar agendamento ────────────────────────────────────────────────────

export async function atualizarAgendamento(
  id: string, data: any, userId: string, prisma: PrismaClient
) {
  const servico = await prisma.servicoContratado.update({
    where: { id },
    data: {
      dataAgendamento:       data.dataAgendamento ? new Date(data.dataAgendamento) : undefined,
      canalAgendamento:      data.canalAgendamento,
      codigoAcesso:          data.codigoAcesso,
      confirmacaoCliente:    data.confirmacaoCliente,
      dataConfirmacao:       data.dataConfirmacao ? new Date(data.dataConfirmacao) : undefined,
      quemConfirmou:         data.quemConfirmou,
      observacoesAgendamento: data.observacoesAgendamento,
    },
  })

  if (data.dataAgendamento) {
    await registrarHistoricoServico({
      servicoId: id, autorId: userId,
      tipo: 'agendado',
      descricao: `Agendado para ${new Date(data.dataAgendamento).toLocaleString('pt-BR')} via ${data.canalAgendamento}`,
    }, prisma)
    await atualizarStatusGeral(id, 'Agendado', userId, prisma)
  }

  if (data.confirmacaoCliente === 'Confirmado' || data.confirmacaoCliente === 'Sim') {
    await registrarHistoricoServico({
      servicoId: id, autorId: userId,
      tipo: 'agendamento_confirmado',
      descricao: `Confirmado pelo cliente: ${data.quemConfirmou}`,
    }, prisma)
  }

  return servico
}

// ─── registrar execução ───────────────────────────────────────────────────────

export async function registrarExecucao(
  id: string, data: any, userId: string, prisma: PrismaClient
) {
  const servico = await prisma.servicoContratado.update({
    where: { id },
    data: {
      dataInicioExecucao:    data.dataInicioExecucao    ? new Date(data.dataInicioExecucao) : undefined,
      dataConclusaoExecucao: data.dataConclusaoExecucao ? new Date(data.dataConclusaoExecucao) : undefined,
      descricaoExecutado:    data.descricaoExecutado,
      pendenciasExecucao:    data.pendenciasExecucao,
      validacaoClienteData:  data.validacaoClienteData  ? new Date(data.validacaoClienteData) : undefined,
      validacaoClienteQuem:  data.validacaoClienteQuem,
      validacaoClienteComo:  data.validacaoClienteComo,
      statusFinalExecucao:   data.statusFinalExecucao,
    },
  })

  if (data.dataInicioExecucao) {
    await registrarHistoricoServico({
      servicoId: id, autorId: userId,
      tipo: 'execucao_iniciada', descricao: 'Execução iniciada',
    }, prisma)
    await atualizarStatusGeral(id, 'Em execução', userId, prisma)
  }

  if (data.statusFinalExecucao) {
    const concluido = ['Concluído com sucesso', 'Concluído com ressalvas'].includes(data.statusFinalExecucao)
    await registrarHistoricoServico({
      servicoId: id, autorId: userId,
      tipo: 'execucao_concluida',
      descricao: `Execução registrada: ${data.statusFinalExecucao}`,
    }, prisma)
    if (concluido) await atualizarStatusGeral(id, 'Concluído', userId, prisma)
  }

  return servico
}

// ─── comunicação ──────────────────────────────────────────────────────────────

export async function registrarComunicacao(
  servicoId: string, data: any, userId: string, prisma: PrismaClient
) {
  const comunicacao = await prisma.servicoComunicacao.create({
    data: {
      servicoId,
      remetenteId:      userId,
      destinatarioNome: data.destinatarioNome,
      canal:            data.canal,
      mensagem:         data.mensagem,
      dataEnvio:        data.dataEnvio ? new Date(data.dataEnvio) : new Date(),
    },
  })

  await registrarHistoricoServico({
    servicoId, autorId: userId,
    tipo: 'comunicacao_registrada',
    descricao: `Comunicação via ${data.canal} com ${data.destinatarioNome}`,
  }, prisma)

  return comunicacao
}

export async function registrarRespostaComunicacao(
  comunicacaoId: string, data: any, userId: string, prisma: PrismaClient
) {
  return prisma.servicoComunicacao.update({
    where: { id: comunicacaoId },
    data: {
      respostaRecebida: true,
      dataResposta:     data.dataResposta ? new Date(data.dataResposta) : new Date(),
      resumoResposta:   data.resumoResposta,
    },
  })
}
```

---

## src/modules/servicos/servico.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import multer from 'fastify-multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import {
  listarServicos, obterServico, criarServico,
  atualizarStatusGeral, atualizarComercial, atualizarFinanceiro,
  atualizarTecnico, atualizarAgendamento, registrarExecucao,
  registrarComunicacao, registrarRespostaComunicacao,
} from './servico.service'
import { registrarHistoricoServico } from '../../lib/historico-servico'

const PERFIS_GESTAO = ['SUPERVISAO', 'CEO', 'ADMIN']
const PERFIS_FIN    = ['FINANCEIRO', 'SUPERVISAO', 'CEO', 'ADMIN']
const PERFIS_TEC    = ['TECNICO', 'SUPERVISAO', 'CEO', 'ADMIN']
const PERFIS_TODOS  = ['VENDEDOR', 'SUPERVISAO', 'CEO', 'ADMIN', 'FINANCEIRO', 'TECNICO']

const upload = multer({ dest: '/tmp/servico-uploads' })

export async function servicoRoutes(fastify: FastifyInstance) {

  // ── Listagem ─────────────────────────────────────────────────────────────────
  fastify.get('/servicos', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const q = req.query as any
    const result = await listarServicos(q, user.id, user.perfil, prisma)
    return reply.send(result)
  })

  // ── Obter ─────────────────────────────────────────────────────────────────────
  fastify.get('/servicos/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const servico = await obterServico(id, user.id, user.perfil, prisma)
    return reply.send(servico)
  })

  // ── Criar ─────────────────────────────────────────────────────────────────────
  fastify.post('/servicos', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    if (!PERFIS_TODOS.includes(user.perfil))
      return reply.code(403).send({ error: 'Sem permissão' })
    const servico = await criarServico(req.body as any, user.id, prisma)
    return reply.code(201).send(servico)
  })

  // ── Status geral ──────────────────────────────────────────────────────────────
  fastify.patch('/servicos/:id/status', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    if (!PERFIS_GESTAO.includes(user.perfil) && user.perfil !== 'VENDEDOR')
      return reply.code(403).send({ error: 'Sem permissão' })
    const { id } = req.params as any
    const { statusGeral } = req.body as any
    return reply.send(await atualizarStatusGeral(id, statusGeral, user.id, prisma))
  })

  // ── Comercial ─────────────────────────────────────────────────────────────────
  fastify.patch('/servicos/:id/comercial', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    if (!PERFIS_GESTAO.includes(user.perfil))
      return reply.code(403).send({ error: 'Sem permissão' })
    const { id } = req.params as any
    return reply.send(await atualizarComercial(id, req.body, user.id, prisma))
  })

  // ── Financeiro ────────────────────────────────────────────────────────────────
  fastify.patch('/servicos/:id/financeiro', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    if (!PERFIS_FIN.includes(user.perfil))
      return reply.code(403).send({ error: 'Sem permissão para aba financeira' })
    const { id } = req.params as any
    return reply.send(await atualizarFinanceiro(id, req.body, user.id, prisma))
  })

  // ── Técnico ───────────────────────────────────────────────────────────────────
  fastify.patch('/servicos/:id/tecnico', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    // TECNICO pode editar somente os designados a ele
    if (user.perfil === 'TECNICO') {
      const s = await prisma.servicoContratado.findUnique({ where: { id: (req.params as any).id } })
      if (!s || s.tecnicoDesignadoId !== user.id)
        return reply.code(403).send({ error: 'Sem permissão' })
    } else if (!PERFIS_GESTAO.includes(user.perfil)) {
      return reply.code(403).send({ error: 'Sem permissão' })
    }
    const { id } = req.params as any
    return reply.send(await atualizarTecnico(id, req.body, user.id, prisma))
  })

  // ── Agendamento ───────────────────────────────────────────────────────────────
  fastify.patch('/servicos/:id/agendamento', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    if (!PERFIS_TEC.includes(user.perfil))
      return reply.code(403).send({ error: 'Sem permissão' })
    const { id } = req.params as any
    return reply.send(await atualizarAgendamento(id, req.body, user.id, prisma))
  })

  // ── Execução ──────────────────────────────────────────────────────────────────
  fastify.patch('/servicos/:id/execucao', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    if (!PERFIS_TEC.includes(user.perfil))
      return reply.code(403).send({ error: 'Sem permissão' })
    const { id } = req.params as any
    return reply.send(await registrarExecucao(id, req.body, user.id, prisma))
  })

  // ── Comunicação ───────────────────────────────────────────────────────────────
  fastify.post('/servicos/:id/comunicacao', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const com = await registrarComunicacao(id, req.body, user.id, prisma)
    return reply.code(201).send(com)
  })

  fastify.patch('/servicos/comunicacao/:comId/resposta', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const { comId } = req.params as any
    return reply.send(await registrarRespostaComunicacao(comId, req.body, user.id, prisma))
  })

  // ── Anexos ────────────────────────────────────────────────────────────────────
  fastify.post('/servicos/:id/anexos',
    { preHandler: [fastify.authenticate, upload.single('arquivo')] },
    async (req, reply) => {
      const user = (req as any).user
      const { id } = req.params as any
      const file  = (req as any).file
      const body  = (req as any).body

      if (!file) return reply.code(400).send({ error: 'Arquivo obrigatório' })

      const ALLOWED = new Set([
        'application/pdf', 'image/png', 'image/jpeg', 'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ])
      if (!ALLOWED.has(file.mimetype))
        return reply.code(400).send({ error: 'Tipo de arquivo não permitido' })

      const ext      = path.extname(file.originalname).toLowerCase()
      const uuid     = uuidv4()
      const now      = new Date()
      const dir      = `uploads/servicos/${id}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
      const nomeSafe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
      const destino  = `${dir}/${uuid}-${nomeSafe}`

      fs.mkdirSync(dir, { recursive: true })
      fs.renameSync(file.path, destino)

      const anexo = await prisma.servicoAnexo.create({
        data: {
          servicoId:     id,
          nomeOriginal:  file.originalname,
          nomeArquivo:   `${uuid}-${nomeSafe}`,
          caminho:       destino,
          mimeType:      file.mimetype,
          tamanhoBytes:  file.size,
          categoria:     body.categoria,
          visibilidade:  body.visibilidade ?? 'Todos',
          uploadadoPorId: user.id,
        },
      })

      await registrarHistoricoServico({
        servicoId: id, autorId: user.id,
        tipo: 'arquivo_anexado',
        descricao: `Arquivo anexado: ${file.originalname} (${body.categoria ?? 'Sem categoria'})`,
      }, prisma)

      return reply.code(201).send(anexo)
    }
  )

  fastify.get('/servicos/anexos/:anexoId/download', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { anexoId } = req.params as any
    const anexo = await prisma.servicoAnexo.findUniqueOrThrow({ where: { id: anexoId } })
    return reply
      .header('Content-Disposition', `attachment; filename="${encodeURIComponent(anexo.nomeOriginal)}"`)
      .header('Content-Type', anexo.mimeType)
      .send(fs.createReadStream(anexo.caminho))
  })

  fastify.delete('/servicos/anexos/:anexoId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user  = (req as any).user
    const { anexoId } = req.params as any
    const anexo = await prisma.servicoAnexo.findUniqueOrThrow({ where: { id: anexoId } })

    const podeExcluir = PERFIS_GESTAO.includes(user.perfil) || anexo.uploadadoPorId === user.id
    if (!podeExcluir) return reply.code(403).send({ error: 'Sem permissão' })

    if (fs.existsSync(anexo.caminho)) fs.unlinkSync(anexo.caminho)
    await prisma.servicoAnexo.delete({ where: { id: anexoId } })

    await registrarHistoricoServico({
      servicoId: anexo.servicoId, autorId: user.id,
      tipo: 'arquivo_excluido',
      descricao: `Arquivo excluído: ${anexo.nomeOriginal}`,
    }, prisma)

    return reply.code(204).send()
  })
}
```

---

## src/modules/servicos/cliente-base.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import multer from 'fastify-multer'
import { parse as csvParse } from 'csv-parse/sync'
import fs from 'fs'
import {
  listarClientesBase, obterClienteBase,
  criarClienteBase, editarClienteBase, importarClientesCSV,
} from './cliente-base.service'

const upload = multer({ dest: '/tmp/csv-uploads' })
const PERFIS_GESTAO = ['SUPERVISAO', 'CEO', 'ADMIN']

export async function clienteBaseRoutes(fastify: FastifyInstance) {

  fastify.get('/clientes-base', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    return reply.send(await listarClientesBase(req.query as any, prisma))
  })

  fastify.get('/clientes-base/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    return reply.send(await obterClienteBase(id, prisma))
  })

  fastify.post('/clientes-base', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    if (!PERFIS_GESTAO.includes(user.perfil))
      return reply.code(403).send({ error: 'Sem permissão' })
    return reply.code(201).send(await criarClienteBase(req.body, prisma))
  })

  fastify.put('/clientes-base/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    if (!PERFIS_GESTAO.includes(user.perfil))
      return reply.code(403).send({ error: 'Sem permissão' })
    const { id } = req.params as any
    return reply.send(await editarClienteBase(id, req.body, prisma))
  })

  fastify.post('/clientes-base/importar',
    { preHandler: [fastify.authenticate, upload.single('csv')] },
    async (req, reply) => {
      const user = (req as any).user
      if (!PERFIS_GESTAO.includes(user.perfil))
        return reply.code(403).send({ error: 'Sem permissão' })

      const file = (req as any).file
      if (!file) return reply.code(400).send({ error: 'Arquivo CSV obrigatório' })

      const content = fs.readFileSync(file.path, 'utf-8')
      fs.unlinkSync(file.path)

      const rows = csvParse(content, {
        columns: true, delimiter: ';', skip_empty_lines: true, bom: true,
      })

      const resultado = await importarClientesCSV(rows, prisma)
      return reply.send(resultado)
    }
  )
}
```

---

## src/modules/servicos/tipo-servico.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { listarTiposServico, criarTipoServico, editarTipoServico } from './tipo-servico.service'

const PERFIS_ADMIN = ['CEO', 'ADMIN']

export async function tipoServicoRoutes(fastify: FastifyInstance) {

  fastify.get('/tipos-servico', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    return reply.send(await listarTiposServico(req.query as any, prisma))
  })

  fastify.post('/tipos-servico', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    if (!PERFIS_ADMIN.includes(user.perfil))
      return reply.code(403).send({ error: 'Sem permissão' })
    return reply.code(201).send(await criarTipoServico(req.body, prisma))
  })

  fastify.put('/tipos-servico/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    if (!PERFIS_ADMIN.includes(user.perfil))
      return reply.code(403).send({ error: 'Sem permissão' })
    const { id } = req.params as any
    return reply.send(await editarTipoServico(id, req.body, prisma))
  })
}
```

---

## Registro no server.ts

```typescript
import { servicoRoutes }      from './modules/servicos/servico.routes'
import { clienteBaseRoutes }  from './modules/servicos/cliente-base.routes'
import { tipoServicoRoutes }  from './modules/servicos/tipo-servico.routes'

fastify.register(servicoRoutes)
fastify.register(clienteBaseRoutes)
fastify.register(tipoServicoRoutes)
```

---

## Sprint 22 — BACKEND PRONTO ✅
