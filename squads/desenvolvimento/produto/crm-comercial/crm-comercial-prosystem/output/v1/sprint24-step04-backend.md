# Sprint 24 — Step 04 — Felipe Santos (Backend Developer)
# Módulo de Metas e Comissões — Services e Routes

---

## comissao.service.ts — Motor Central

```typescript
import { PrismaClient, Comissao, RegraComissao, StatusComissao } from '@prisma/client'

// ─── Busca a regra ativa mais específica para um vendedor e base de cálculo ───
async function buscarRegraAtiva(
  vendedorId: string,
  baseCalculo: string,
  prisma: PrismaClient
): Promise<RegraComissao | null> {
  const hoje = new Date()

  // Tenta primeiro regra específica do vendedor
  const regraEspecifica = await prisma.regraComissao.findFirst({
    where: {
      vendedorId,
      baseCalculo: baseCalculo as any,
      status: 'ATIVA',
      dataInicio: { lte: hoje },
      OR: [{ dataFim: null }, { dataFim: { gte: hoje } }]
    }
  })
  if (regraEspecifica) return regraEspecifica

  // Fallback: regra global
  return prisma.regraComissao.findFirst({
    where: {
      aplicarParaTodos: true,
      baseCalculo: baseCalculo as any,
      status: 'ATIVA',
      dataInicio: { lte: hoje },
      OR: [{ dataFim: null }, { dataFim: { gte: hoje } }]
    }
  })
}

function calcularValorComissao(regra: RegraComissao, valorBase: number): number {
  if (regra.tipoComissao === 'SEM_COMISSAO') return 0
  if (regra.tipoComissao === 'MANUAL') return 0

  let valor = 0
  if (regra.tipoComissao === 'PERCENTUAL' || regra.tipoComissao === 'PERCENTUAL_POR_FAIXA') {
    valor = valorBase * Number(regra.percentual ?? 0)
  } else {
    valor = Number(regra.valorFixo ?? 0)
  }

  if (regra.comissaoMinima && valor < Number(regra.comissaoMinima)) {
    valor = Number(regra.comissaoMinima)
  }
  if (regra.comissaoMaxima && valor > Number(regra.comissaoMaxima)) {
    valor = Number(regra.comissaoMaxima)
  }
  return Math.round(valor * 100) / 100
}

function resolverStatusInicial(regra: RegraComissao): StatusComissao {
  if (regra.dependeAprovacaoSupervisao) return 'AGUARDANDO_APROVACAO'
  if (regra.dependeRecebimento !== 'NAO') return 'AGUARDANDO_RECEBIMENTO'
  return 'LIBERADA'
}

// ─── Calcula comissão ao criar Contrato ───────────────────────────────────────
export async function calcularComissaoContrato(
  contratoId: string,
  prisma: PrismaClient
): Promise<void> {
  const contrato = await prisma.contrato.findUnique({
    where: { id: contratoId },
    select: { id: true, vendedorId: true, mrr: true, valorInstalacao: true }
  })
  if (!contrato?.vendedorId) return

  const bases = [
    { base: 'MRR_FECHADO', valor: Number(contrato.mrr ?? 0) },
    { base: 'VALOR_INSTALACAO_VENDIDA', valor: Number(contrato.valorInstalacao ?? 0) },
    { base: 'VALOR_FIXO_POR_CONTRATO', valor: 1 }
  ]

  for (const { base, valor } of bases) {
    if (valor <= 0 && base !== 'VALOR_FIXO_POR_CONTRATO') continue
    const regra = await buscarRegraAtiva(contrato.vendedorId, base, prisma)
    if (!regra || regra.tipoComissao === 'SEM_COMISSAO') continue

    const valorBase = regra.calculaSobreValorBruto ? valor : valor
    const valorComissao = calcularValorComissao(regra, valorBase)
    if (valorComissao <= 0 && regra.tipoComissao !== 'MANUAL') continue

    await prisma.comissao.create({
      data: {
        vendedorId: contrato.vendedorId,
        regraId: regra.id,
        contratoId,
        valorBase,
        percentualAplicado: regra.percentual,
        valorFixoAplicado: regra.valorFixo,
        valorComissao,
        status: resolverStatusInicial(regra)
      }
    })
  }
}

// ─── Calcula comissão ao criar ServicoContratado ──────────────────────────────
export async function calcularComissaoServico(
  servicoId: string,
  prisma: PrismaClient
): Promise<void> {
  const servico = await prisma.servicoContratado.findUnique({
    where: { id: servicoId },
    select: { id: true, lancadoPorId: true, valorVendido: true }
  })
  if (!servico?.lancadoPorId) return

  const bases = [
    { base: 'VALOR_SERVICO_VENDIDO', valor: Number(servico.valorVendido ?? 0) },
    { base: 'VALOR_FIXO_POR_SERVICO', valor: 1 }
  ]

  for (const { base, valor } of bases) {
    if (valor <= 0 && base !== 'VALOR_FIXO_POR_SERVICO') continue
    const regra = await buscarRegraAtiva(servico.lancadoPorId, base, prisma)
    if (!regra || regra.tipoComissao === 'SEM_COMISSAO') continue

    const valorComissao = calcularValorComissao(regra, valor)
    if (valorComissao <= 0 && regra.tipoComissao !== 'MANUAL') continue

    await prisma.comissao.create({
      data: {
        vendedorId: servico.lancadoPorId,
        regraId: regra.id,
        servicoId,
        valorBase: valor,
        percentualAplicado: regra.percentual,
        valorFixoAplicado: regra.valorFixo,
        valorComissao,
        status: resolverStatusInicial(regra)
      }
    })
  }
}

// ─── Calcula comissão ao converter IndicacaoParceiro ─────────────────────────
export async function calcularComissaoIndicacao(
  indicacaoId: string,
  prisma: PrismaClient
): Promise<void> {
  const indicacao = await prisma.indicacaoParceiro.findUnique({
    where: { id: indicacaoId },
    include: { parceiro: true }
  })
  if (!indicacao) return

  // Comissão da indicação vem da configuração do parceiro ou da regra geral
  let valorComissao = 0
  let percentualAplicado: any = null
  let valorFixoAplicado: any = null
  let regraId: string | undefined = undefined

  const base = 'VALOR_FIXO_POR_INDICACAO'
  const regra = await buscarRegraAtiva(indicacao.vendedorId, base, prisma)

  if (regra) {
    regraId = regra.id
    const valorBase = Number(indicacao.valorConfirmado ?? indicacao.valorEstimado ?? 0)
    valorComissao = calcularValorComissao(regra, valorBase)
    percentualAplicado = regra.percentual
    valorFixoAplicado = regra.valorFixo
  } else if (indicacao.parceiro.comissaoPadrao) {
    // Fallback: comissão padrão do parceiro
    if (indicacao.parceiro.tipoComissaoPadrao === 'PERCENTUAL') {
      valorComissao = Number(indicacao.valorConfirmado ?? 0) * Number(indicacao.parceiro.comissaoPadrao)
      percentualAplicado = indicacao.parceiro.comissaoPadrao
    } else {
      valorComissao = Number(indicacao.parceiro.comissaoPadrao)
      valorFixoAplicado = indicacao.parceiro.comissaoPadrao
    }
  }

  if (valorComissao <= 0) return

  // Atualiza comissaoPrevista na indicação
  await prisma.indicacaoParceiro.update({
    where: { id: indicacaoId },
    data: { comissaoPrevista: valorComissao, comissaoConfirmada: valorComissao }
  })

  await prisma.comissao.create({
    data: {
      vendedorId: indicacao.vendedorId,
      regraId: regraId ?? null,
      indicacaoId,
      valorBase: Number(indicacao.valorConfirmado ?? indicacao.valorEstimado ?? 0),
      percentualAplicado,
      valorFixoAplicado,
      valorComissao,
      status: 'AGUARDANDO_APROVACAO'
    }
  })
}

// ─── Libera comissões quando Recebimento é confirmado ────────────────────────
export async function verificarLiberacaoComissoes(
  recebimentoId: string,
  prisma: PrismaClient
): Promise<void> {
  const recebimento = await prisma.recebimento.findUnique({
    where: { id: recebimentoId },
    select: { id: true, contratoId: true, servicoId: true, statusRecebimento: true, entradaRecebida: true }
  })
  if (!recebimento) return

  // Busca comissões pendentes vinculadas ao contrato ou serviço deste recebimento
  const comissoesPendentes = await prisma.comissao.findMany({
    where: {
      status: 'AGUARDANDO_RECEBIMENTO',
      OR: [
        { contratoId: recebimento.contratoId ?? undefined },
        { servicoId: recebimento.servicoId ?? undefined }
      ]
    },
    include: { regra: true }
  })

  for (const comissao of comissoesPendentes) {
    if (!comissao.regra) continue

    const podeLiberar = verificarCondicoes(comissao.regra, recebimento)
    if (podeLiberar) {
      await prisma.comissao.update({
        where: { id: comissao.id },
        data: {
          status: comissao.regra.dependeAprovacaoSupervisao
            ? 'AGUARDANDO_APROVACAO'
            : 'LIBERADA',
          recebimentoId,
          dataLiberacao: comissao.regra.dependeAprovacaoSupervisao ? null : new Date()
        }
      })
    }
  }

  // Atualiza statusComissao no recebimento
  await prisma.recebimento.update({
    where: { id: recebimentoId },
    data: {
      statusComissao: recebimento.statusRecebimento === 'RECEBIDO' ? 'LIBERADA' : 'AGUARDANDO',
      dataLiberacaoComissao: recebimento.statusRecebimento === 'RECEBIDO' ? new Date() : null
    }
  })
}

function verificarCondicoes(regra: RegraComissao, recebimento: any): boolean {
  if (regra.dependeRecebimento === 'NAO') return true
  if (regra.dependeRecebimento === 'SIM' && recebimento.statusRecebimento !== 'RECEBIDO') return false
  if (regra.dependeRecebimento === 'APENAS_ENTRADA' && !recebimento.entradaRecebida) return false
  if (regra.dependeRecebimento === 'PARCIALMENTE_RECEBIDO' &&
      !['PARCIALMENTE_RECEBIDO', 'RECEBIDO'].includes(recebimento.statusRecebimento)) return false
  return true
}
```

---

## parceiro.service.ts

```typescript
import { PrismaClient } from '@prisma/client'

export async function listarParceiros(
  filters: { categoria?: string; status?: string; perfil: string },
  prisma: PrismaClient
) {
  const where: any = {}
  if (filters.perfil === 'VENDEDOR') where.status = 'ATIVO'
  else if (filters.status) where.status = filters.status
  if (filters.categoria) where.categoria = filters.categoria

  return prisma.parceiro.findMany({
    where,
    orderBy: { nome: 'asc' }
  })
}

export async function obterParceiro(id: string, prisma: PrismaClient) {
  const parceiro = await prisma.parceiro.findUnique({ where: { id } })
  if (!parceiro) throw { statusCode: 404, message: 'Parceiro não encontrado' }
  return parceiro
}

export async function criarParceiro(data: any, criadoPorId: string, prisma: PrismaClient) {
  return prisma.parceiro.create({
    data: { ...data, criadoPorId }
  })
}

export async function atualizarParceiro(id: string, data: any, prisma: PrismaClient) {
  await obterParceiro(id, prisma)
  return prisma.parceiro.update({
    where: { id },
    data: { ...data, updatedAt: new Date() }
  })
}

export async function excluirParceiro(id: string, prisma: PrismaClient) {
  const indicacoes = await prisma.indicacaoParceiro.count({ where: { parceiroId: id } })
  if (indicacoes > 0) throw { statusCode: 409, message: 'Parceiro possui indicações vinculadas' }
  await prisma.parceiro.delete({ where: { id } })
}
```

---

## meta.service.ts

```typescript
import { PrismaClient } from '@prisma/client'

export async function listarMetas(
  filters: { mes?: number; ano?: number; vendedorId?: string; status?: string; userId: string; perfil: string },
  prisma: PrismaClient
) {
  const where: any = {}
  if (filters.perfil === 'VENDEDOR') where.vendedorId = filters.userId
  else if (filters.vendedorId) where.vendedorId = filters.vendedorId
  if (filters.mes) where.mes = filters.mes
  if (filters.ano) where.ano = filters.ano
  if (filters.status) where.status = filters.status

  return prisma.meta.findMany({
    where,
    include: { vendedor: { select: { id: true, name: true } } },
    orderBy: [{ ano: 'desc' }, { mes: 'desc' }, { tipoMeta: 'asc' }]
  })
}

export async function obterMeta(id: string, userId: string, perfil: string, prisma: PrismaClient) {
  const meta = await prisma.meta.findUnique({
    where: { id },
    include: {
      vendedor: { select: { id: true, name: true } },
      supervisor: { select: { id: true, name: true } }
    }
  })
  if (!meta) throw { statusCode: 404, message: 'Meta não encontrada' }
  if (perfil === 'VENDEDOR' && meta.vendedorId !== userId) {
    throw { statusCode: 403, message: 'Acesso negado' }
  }
  return meta
}

export async function criarMeta(data: any, criadoPorId: string, prisma: PrismaClient) {
  const meta = await prisma.meta.create({ data: { ...data, criadoPorId } })
  // Já calcula o realizado ao criar
  return recalcularRealizadoMeta(meta.id, prisma)
}

export async function atualizarMeta(id: string, data: any, prisma: PrismaClient) {
  await prisma.meta.update({ where: { id }, data: { ...data, updatedAt: new Date() } })
  return recalcularRealizadoMeta(id, prisma)
}

export async function recalcularRealizadoMeta(id: string, prisma: PrismaClient) {
  const meta = await prisma.meta.findUnique({ where: { id } })
  if (!meta) return null

  const inicio = new Date(meta.ano, meta.mes - 1, 1)
  const fim = new Date(meta.ano, meta.mes, 0, 23, 59, 59)

  let valorRealizado = 0
  let quantidadeRealizada = 0

  switch (meta.tipoMeta) {
    case 'CONTRATOS_FECHADOS': {
      quantidadeRealizada = await prisma.contrato.count({
        where: { vendedorId: meta.vendedorId, createdAt: { gte: inicio, lte: fim } }
      })
      break
    }
    case 'MRR_NOVO': {
      const result = await prisma.contrato.aggregate({
        where: { vendedorId: meta.vendedorId, createdAt: { gte: inicio, lte: fim } },
        _sum: { mrr: true }
      })
      valorRealizado = Number(result._sum.mrr ?? 0)
      break
    }
    case 'RECEITA_INSTALACAO': {
      const result = await prisma.contrato.aggregate({
        where: { vendedorId: meta.vendedorId, createdAt: { gte: inicio, lte: fim } },
        _sum: { valorInstalacao: true }
      })
      valorRealizado = Number(result._sum.valorInstalacao ?? 0)
      break
    }
    case 'RECEITA_TOTAL_RECEBIDA': {
      const result = await prisma.recebimento.aggregate({
        where: {
          vendedorId: meta.vendedorId,
          createdAt: { gte: inicio, lte: fim },
          statusRecebimento: 'RECEBIDO'
        },
        _sum: { valorRecebido: true }
      })
      valorRealizado = Number(result._sum.valorRecebido ?? 0)
      break
    }
    case 'SERVICOS_VENDIDOS': {
      quantidadeRealizada = await prisma.servicoContratado.count({
        where: { lancadoPorId: meta.vendedorId, createdAt: { gte: inicio, lte: fim } }
      })
      break
    }
    case 'INDICACOES_REALIZADAS': {
      quantidadeRealizada = await prisma.indicacaoParceiro.count({
        where: { vendedorId: meta.vendedorId, createdAt: { gte: inicio, lte: fim } }
      })
      break
    }
    case 'INDICACOES_CONVERTIDAS': {
      quantidadeRealizada = await prisma.indicacaoParceiro.count({
        where: {
          vendedorId: meta.vendedorId,
          status: 'CONVERTIDA',
          dataConversao: { gte: inicio, lte: fim }
        }
      })
      break
    }
    case 'RECEITA_INDICACOES': {
      const result = await prisma.indicacaoParceiro.aggregate({
        where: {
          vendedorId: meta.vendedorId,
          status: 'CONVERTIDA',
          dataConversao: { gte: inicio, lte: fim }
        },
        _sum: { valorConfirmado: true }
      })
      valorRealizado = Number(result._sum.valorConfirmado ?? 0)
      break
    }
    default:
      // Tipos sem cálculo automático (ex: PROPOSTAS_ENVIADAS, LEADS_TRABALHADOS)
      break
  }

  const metaValor = Number(meta.valorMeta ?? meta.quantidadeMeta ?? 1)
  const realizado = valorRealizado || quantidadeRealizada
  const percentualAtingido = metaValor > 0 ? Math.min((realizado / metaValor) * 100, 999.99) : 0

  return prisma.meta.update({
    where: { id },
    data: { valorRealizado, quantidadeRealizada, percentualAtingido, updatedAt: new Date() },
    include: { vendedor: { select: { id: true, name: true } } }
  })
}
```

---

## regra-comissao.service.ts

```typescript
import { PrismaClient } from '@prisma/client'

export async function listarRegras(
  filters: { vendedorId?: string; status?: string; baseCalculo?: string },
  prisma: PrismaClient
) {
  const where: any = {}
  if (filters.vendedorId) where.vendedorId = filters.vendedorId
  if (filters.status) where.status = filters.status
  if (filters.baseCalculo) where.baseCalculo = filters.baseCalculo

  return prisma.regraComissao.findMany({
    where,
    include: { vendedor: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' }
  })
}

export async function criarRegra(data: any, criadoPorId: string, prisma: PrismaClient) {
  // Verificar unicidade: 1 regra ativa por vendedor+base
  if (data.status === 'ATIVA' || !data.status) {
    const existente = await prisma.regraComissao.findFirst({
      where: {
        vendedorId: data.vendedorId ?? null,
        baseCalculo: data.baseCalculo,
        status: 'ATIVA'
      }
    })
    if (existente) {
      throw {
        statusCode: 409,
        message: 'Já existe uma regra ativa para este vendedor e base de cálculo. Inative a regra existente antes de criar uma nova.'
      }
    }
  }
  return prisma.regraComissao.create({ data: { ...data, criadoPorId } })
}

export async function atualizarRegra(id: string, data: any, prisma: PrismaClient) {
  return prisma.regraComissao.update({
    where: { id },
    data: { ...data, updatedAt: new Date() }
  })
}
```

---

## recebimento.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import { verificarLiberacaoComissoes } from './comissao.service'

export async function listarRecebimentos(
  filters: { vendedorId?: string; status?: string; tipo?: string; userId: string; perfil: string },
  prisma: PrismaClient
) {
  const where: any = {}
  if (filters.perfil === 'VENDEDOR') where.vendedorId = filters.userId
  else if (filters.vendedorId) where.vendedorId = filters.vendedorId
  if (filters.status) where.statusRecebimento = filters.status
  if (filters.tipo) where.tipoReceita = filters.tipo

  return prisma.recebimento.findMany({
    where,
    include: {
      vendedor: { select: { id: true, name: true } },
      comissoes: { select: { id: true, valorComissao: true, status: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
}

export async function criarRecebimento(data: any, criadoPorId: string, userId: string, prisma: PrismaClient) {
  // Calcula saldo pendente automaticamente
  const saldoPendente = Number(data.valorVendido ?? 0) - Number(data.valorDesconto ?? 0) - Number(data.valorRecebido ?? 0)

  const recebimento = await prisma.recebimento.create({
    data: {
      ...data,
      saldoPendente: Math.max(0, saldoPendente),
      criadoPorId
    }
  })

  // Se criado já como RECEBIDO → dispara liberação de comissões
  if (recebimento.statusRecebimento === 'RECEBIDO') {
    await verificarLiberacaoComissoes(recebimento.id, prisma)
  }

  return recebimento
}

export async function atualizarRecebimento(id: string, data: any, prisma: PrismaClient) {
  const anterior = await prisma.recebimento.findUnique({ where: { id } })
  if (!anterior) throw { statusCode: 404, message: 'Recebimento não encontrado' }

  const saldoPendente = Number(data.valorVendido ?? anterior.valorVendido)
    - Number(data.valorDesconto ?? anterior.valorDesconto)
    - Number(data.valorRecebido ?? anterior.valorRecebido)

  const atualizado = await prisma.recebimento.update({
    where: { id },
    data: { ...data, saldoPendente: Math.max(0, saldoPendente), updatedAt: new Date() }
  })

  // Dispara liberação se status mudou para RECEBIDO
  const statusAnterior = anterior.statusRecebimento
  const novoStatus = data.statusRecebimento ?? anterior.statusRecebimento
  if (statusAnterior !== 'RECEBIDO' && novoStatus === 'RECEBIDO') {
    await verificarLiberacaoComissoes(id, prisma)
  }

  // Dispara liberação se entrada foi recebida
  if (!anterior.entradaRecebida && data.entradaRecebida) {
    await verificarLiberacaoComissoes(id, prisma)
  }

  return atualizado
}
```

---

## indicacao-parceiro.service.ts

```typescript
import { PrismaClient } from '@prisma/client'
import { calcularComissaoIndicacao } from './comissao.service'

export async function listarIndicacoes(
  filters: { parceiroId?: string; status?: string; vendedorId?: string; userId: string; perfil: string },
  prisma: PrismaClient
) {
  const where: any = {}
  if (filters.perfil === 'VENDEDOR') where.vendedorId = filters.userId
  else if (filters.vendedorId) where.vendedorId = filters.vendedorId
  if (filters.parceiroId) where.parceiroId = filters.parceiroId
  if (filters.status) where.status = filters.status

  return prisma.indicacaoParceiro.findMany({
    where,
    include: {
      vendedor: { select: { id: true, name: true } },
      parceiro: { select: { id: true, nome: true, categoria: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
}

export async function criarIndicacao(data: any, vendedorId: string, prisma: PrismaClient) {
  // Herda comissão padrão do parceiro se não especificado
  const parceiro = await prisma.parceiro.findUnique({ where: { id: data.parceiroId } })
  if (!parceiro) throw { statusCode: 404, message: 'Parceiro não encontrado' }
  if (parceiro.status !== 'ATIVO') throw { statusCode: 400, message: 'Parceiro inativo' }

  const tipoComissao = data.tipoComissao ?? parceiro.tipoComissaoPadrao
  const valorFixoComissao = data.valorFixoComissao ?? (
    parceiro.tipoComissaoPadrao === 'VALOR_FIXO' ? parceiro.comissaoPadrao : null
  )
  const percentualComissao = data.percentualComissao ?? (
    parceiro.tipoComissaoPadrao === 'PERCENTUAL' ? parceiro.comissaoPadrao : null
  )

  return prisma.indicacaoParceiro.create({
    data: {
      ...data,
      vendedorId,
      tipoComissao,
      valorFixoComissao,
      percentualComissao,
      status: 'LANCADA'
    },
    include: {
      parceiro: { select: { id: true, nome: true } }
    }
  })
}

export async function atualizarStatusIndicacao(
  id: string,
  novoStatus: string,
  userId: string,
  extra: any,
  prisma: PrismaClient
) {
  const indicacao = await prisma.indicacaoParceiro.findUnique({ where: { id } })
  if (!indicacao) throw { statusCode: 404, message: 'Indicação não encontrada' }

  const data: any = { status: novoStatus, updatedAt: new Date(), ...extra }

  if (novoStatus === 'CONVERTIDA') {
    data.dataConversao = extra?.dataConversao ?? new Date()
    data.clienteFechouComParceiro = 'SIM'
  }

  const atualizada = await prisma.indicacaoParceiro.update({ where: { id }, data })

  // Ao converter → calcula comissão automaticamente
  if (novoStatus === 'CONVERTIDA') {
    await calcularComissaoIndicacao(id, prisma)
  }

  return atualizada
}

export async function aprovarIndicacao(id: string, aprovadoPorId: string, prisma: PrismaClient) {
  const indicacao = await prisma.indicacaoParceiro.findUnique({ where: { id } })
  if (!indicacao) throw { statusCode: 404, message: 'Indicação não encontrada' }

  return prisma.indicacaoParceiro.update({
    where: { id },
    data: {
      aprovadoPorSupervisao: 'SIM',
      aprovadoPorId,
      dataAprovacao: new Date(),
      updatedAt: new Date()
    }
  })
}
```

---

## parceiro.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { requireRole } from '../middleware/auth'
import * as parceiroService from './parceiro.service'

export async function parceiroRoutes(app: FastifyInstance) {
  app.get('/parceiros', { preHandler: requireRole(['VENDEDOR','SUPERVISAO','CEO','ADMIN','FINANCEIRO','TECNICO']) },
    async (req, reply) => {
      const { categoria, status } = req.query as any
      const perfil = (req.user as any).role
      return parceiroService.listarParceiros({ categoria, status, perfil }, app.prisma)
    }
  )

  app.get('/parceiros/:id', { preHandler: requireRole(['VENDEDOR','SUPERVISAO','CEO','ADMIN','FINANCEIRO']) },
    async (req) => parceiroService.obterParceiro((req.params as any).id, app.prisma)
  )

  app.post('/parceiros', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req, reply) => {
      const user = req.user as any
      const parceiro = await parceiroService.criarParceiro(req.body, user.id, app.prisma)
      reply.code(201).send(parceiro)
    }
  )

  app.patch('/parceiros/:id', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req) => parceiroService.atualizarParceiro((req.params as any).id, req.body, app.prisma)
  )

  app.delete('/parceiros/:id', { preHandler: requireRole(['ADMIN']) },
    async (req, reply) => {
      await parceiroService.excluirParceiro((req.params as any).id, app.prisma)
      reply.code(204).send()
    }
  )
}
```

---

## meta.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { requireRole } from '../middleware/auth'
import * as metaService from './meta.service'

export async function metaRoutes(app: FastifyInstance) {
  app.get('/metas', { preHandler: requireRole(['VENDEDOR','SUPERVISAO','CEO','ADMIN','FINANCEIRO']) },
    async (req) => {
      const { mes, ano, vendedorId, status } = req.query as any
      const user = req.user as any
      return metaService.listarMetas({
        mes: mes ? parseInt(mes) : undefined,
        ano: ano ? parseInt(ano) : undefined,
        vendedorId, status,
        userId: user.id, perfil: user.role
      }, app.prisma)
    }
  )

  app.get('/metas/:id', { preHandler: requireRole(['VENDEDOR','SUPERVISAO','CEO','ADMIN','FINANCEIRO']) },
    async (req) => {
      const user = req.user as any
      return metaService.obterMeta((req.params as any).id, user.id, user.role, app.prisma)
    }
  )

  app.post('/metas', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req, reply) => {
      const user = req.user as any
      const meta = await metaService.criarMeta(req.body, user.id, app.prisma)
      reply.code(201).send(meta)
    }
  )

  app.patch('/metas/:id', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req) => metaService.atualizarMeta((req.params as any).id, req.body, app.prisma)
  )

  app.post('/metas/recalcular', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req) => {
      const { mes, ano } = req.body as any
      const metas = await app.prisma.meta.findMany({
        where: { mes, ano, status: 'ATIVA' }
      })
      const resultados = await Promise.all(
        metas.map(m => metaService.recalcularRealizadoMeta(m.id, app.prisma))
      )
      return { recalculadas: resultados.length, metas: resultados }
    }
  )
}
```

---

## regra-comissao.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { requireRole } from '../middleware/auth'
import * as regraService from './regra-comissao.service'

export async function regraComissaoRoutes(app: FastifyInstance) {
  app.get('/regras-comissao', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN','FINANCEIRO']) },
    async (req) => {
      const { vendedorId, status, baseCalculo } = req.query as any
      return regraService.listarRegras({ vendedorId, status, baseCalculo }, app.prisma)
    }
  )

  app.post('/regras-comissao', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req, reply) => {
      const user = req.user as any
      const regra = await regraService.criarRegra(req.body, user.id, app.prisma)
      reply.code(201).send(regra)
    }
  )

  app.patch('/regras-comissao/:id', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req) => regraService.atualizarRegra((req.params as any).id, req.body, app.prisma)
  )

  app.delete('/regras-comissao/:id', { preHandler: requireRole(['ADMIN']) },
    async (req, reply) => {
      await app.prisma.regraComissao.delete({ where: { id: (req.params as any).id } })
      reply.code(204).send()
    }
  )
}
```

---

## comissao.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { requireRole } from '../middleware/auth'

export async function comissaoRoutes(app: FastifyInstance) {
  app.get('/comissoes', { preHandler: requireRole(['VENDEDOR','SUPERVISAO','CEO','ADMIN','FINANCEIRO']) },
    async (req) => {
      const user = req.user as any
      const { status, vendedorId } = req.query as any
      const where: any = {}
      if (user.role === 'VENDEDOR') where.vendedorId = user.id
      else if (vendedorId) where.vendedorId = vendedorId
      if (status) where.status = status

      return app.prisma.comissao.findMany({
        where,
        include: {
          vendedor: { select: { id: true, name: true } },
          regra: { select: { id: true, nome: true, tipoComissao: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
    }
  )

  app.patch('/comissoes/:id/liberar', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req) => {
      return app.prisma.comissao.update({
        where: { id: (req.params as any).id },
        data: { status: 'LIBERADA', dataLiberacao: new Date(), updatedAt: new Date() }
      })
    }
  )

  app.patch('/comissoes/:id/bloquear', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req) => {
      const { motivoBloqueio } = req.body as any
      return app.prisma.comissao.update({
        where: { id: (req.params as any).id },
        data: { status: 'BLOQUEADA', motivoBloqueio, updatedAt: new Date() }
      })
    }
  )

  app.patch('/comissoes/:id/aprovar', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req) => {
      const user = req.user as any
      return app.prisma.comissao.update({
        where: { id: (req.params as any).id },
        data: {
          status: 'LIBERADA',
          aprovadoPorId: user.id,
          dataAprovacao: new Date(),
          dataLiberacao: new Date(),
          updatedAt: new Date()
        }
      })
    }
  )
}
```

---

## recebimento.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { requireRole } from '../middleware/auth'
import * as recebimentoService from './recebimento.service'

export async function recebimentoRoutes(app: FastifyInstance) {
  app.get('/recebimentos', { preHandler: requireRole(['VENDEDOR','FINANCEIRO','SUPERVISAO','CEO','ADMIN']) },
    async (req) => {
      const user = req.user as any
      const { vendedorId, status, tipo } = req.query as any
      return recebimentoService.listarRecebimentos(
        { vendedorId, status, tipo, userId: user.id, perfil: user.role },
        app.prisma
      )
    }
  )

  app.post('/recebimentos', { preHandler: requireRole(['FINANCEIRO','SUPERVISAO','CEO','ADMIN']) },
    async (req, reply) => {
      const user = req.user as any
      const rec = await recebimentoService.criarRecebimento(req.body, user.id, user.id, app.prisma)
      reply.code(201).send(rec)
    }
  )

  app.patch('/recebimentos/:id', { preHandler: requireRole(['FINANCEIRO','SUPERVISAO','CEO','ADMIN']) },
    async (req) => recebimentoService.atualizarRecebimento(
      (req.params as any).id, req.body, app.prisma
    )
  )
}
```

---

## indicacao-parceiro.routes.ts

```typescript
import { FastifyInstance } from 'fastify'
import { requireRole } from '../middleware/auth'
import * as indicacaoService from './indicacao-parceiro.service'

export async function indicacaoParceiroRoutes(app: FastifyInstance) {
  app.get('/indicacoes', { preHandler: requireRole(['VENDEDOR','SUPERVISAO','CEO','ADMIN','FINANCEIRO']) },
    async (req) => {
      const user = req.user as any
      const { parceiroId, status, vendedorId } = req.query as any
      return indicacaoService.listarIndicacoes(
        { parceiroId, status, vendedorId, userId: user.id, perfil: user.role },
        app.prisma
      )
    }
  )

  app.post('/indicacoes', { preHandler: requireRole(['VENDEDOR','SUPERVISAO','CEO','ADMIN']) },
    async (req, reply) => {
      const user = req.user as any
      const indicacao = await indicacaoService.criarIndicacao(req.body, user.id, app.prisma)
      reply.code(201).send(indicacao)
    }
  )

  app.patch('/indicacoes/:id/status', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req) => {
      const user = req.user as any
      const { status, ...extra } = req.body as any
      return indicacaoService.atualizarStatusIndicacao(
        (req.params as any).id, status, user.id, extra, app.prisma
      )
    }
  )

  app.patch('/indicacoes/:id/aprovar', { preHandler: requireRole(['SUPERVISAO','CEO','ADMIN']) },
    async (req) => {
      const user = req.user as any
      return indicacaoService.aprovarIndicacao((req.params as any).id, user.id, app.prisma)
    }
  )
}
```

---

## Registro das rotas em app.ts

```typescript
import { parceiroRoutes } from './modules/metas-comissoes/parceiro/parceiro.routes'
import { metaRoutes } from './modules/metas-comissoes/meta/meta.routes'
import { regraComissaoRoutes } from './modules/metas-comissoes/regra-comissao/regra-comissao.routes'
import { comissaoRoutes } from './modules/metas-comissoes/comissao/comissao.routes'
import { recebimentoRoutes } from './modules/metas-comissoes/recebimento/recebimento.routes'
import { indicacaoParceiroRoutes } from './modules/metas-comissoes/indicacao-parceiro/indicacao-parceiro.routes'

// No bloco de registro de plugins:
app.register(parceiroRoutes)
app.register(metaRoutes)
app.register(regraComissaoRoutes)
app.register(comissaoRoutes)
app.register(recebimentoRoutes)
app.register(indicacaoParceiroRoutes)
```

---

## Hook em contrato.service.ts (adição)

```typescript
// Após criar o contrato (criarContrato):
import { calcularComissaoContrato } from '../metas-comissoes/comissao/comissao.service'

// ao final do criarContrato():
await calcularComissaoContrato(contrato.id, prisma).catch(() => {
  // não bloqueia criação do contrato em caso de falha no motor
})
```

## Hook em servico-contratado.service.ts (adição)

```typescript
import { calcularComissaoServico } from '../metas-comissoes/comissao/comissao.service'

// ao final do criarServico():
if (servico.lancadoPorId) {
  await calcularComissaoServico(servico.id, prisma).catch(() => {})
}
```

---

## Sprint 24 — BACKEND PRONTO ✅
