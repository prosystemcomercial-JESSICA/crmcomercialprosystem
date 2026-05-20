# Sprint 15 — Step 04 — Felipe Santos (Backend)
# Histórico Detalhado — Implementação API

## Sem migração — modelo HistoricoLead já existe desde Sprint 1

## src/lib/historico.ts (helper centralizado — novo arquivo)

```typescript
import { PrismaClient } from '@prisma/client'

type RegistrarParams = {
  leadId: string
  tipoEvento: string
  descricao: string
  valorAnterior?: string | null
  valorNovo?: string | null
  usuarioId?: string | null
}

export async function registrarHistorico(params: RegistrarParams, prisma: PrismaClient) {
  return prisma.historicoLead.create({ data: params })
}

export async function registrarHistoricoLote(
  items: RegistrarParams[],
  prisma: PrismaClient
) {
  if (items.length === 0) return
  return prisma.historicoLead.createMany({ data: items })
}
```

## Complementos nos services existentes

### atividade.service.ts — adicionar ao concluirAtividade

```typescript
import { registrarHistorico } from '../../lib/historico'

// Dentro de concluirAtividade(), após update da atividade:
const atividade = await prisma.atividade.findUnique({ where: { id: atividadeId } })
if (atividade?.leadId) {
  await registrarHistorico({
    leadId: atividade.leadId,
    tipoEvento: 'atividade_concluida',
    descricao: `${atividade.tipo} concluída — "${resultado}"`,
    usuarioId,
  }, prisma)
}
```

### leads.service.ts — adicionar ao atualizarLead (PATCH geral)

```typescript
const CAMPOS_AUDITADOS: Array<keyof typeof leadAtual> = [
  'segmento', 'origem', 'vendedorId', 'temperatura', 'contato', 'whatsapp', 'email',
  'potencialMensalidade', 'observacao',
]

const historicoItems: RegistrarParams[] = []
for (const campo of CAMPOS_AUDITADOS) {
  const antes = leadAtual[campo]
  const depois = body[campo]
  if (depois !== undefined && String(depois) !== String(antes ?? '')) {
    historicoItems.push({
      leadId,
      tipoEvento: 'campo_alterado',
      descricao: `Campo "${campo}" alterado`,
      valorAnterior: String(antes ?? ''),
      valorNovo: String(depois ?? ''),
      usuarioId,
    })
  }
}
if (historicoItems.length > 0) {
  await registrarHistoricoLote(historicoItems, prisma)
}
```

### importacao.job.ts — após createMany dos leads

```typescript
// Após criar cada chunk de leads, registrar histórico em batch:
const leadsCriados = await prisma.lead.findMany({
  where: { importacaoId, createdAt: { gte: chunkStart } },
  select: { id: true },
})
await registrarHistoricoLote(
  leadsCriados.map(l => ({
    leadId: l.id,
    tipoEvento: 'importacao',
    descricao: `Lead importado via arquivo "${nomeArquivo}"`,
    valorNovo: importacaoId,
    usuarioId: null, // Sistema
  })),
  prisma
)
```

## historico.routes.ts (novo arquivo em leads/historico)

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { registrarHistorico } from '../../lib/historico'
import { z } from 'zod'
import { gerarPdfHistorico } from './historico.pdf'

const TIPOS_VALIDOS = [
  'lead_criado', 'etapa_alterada', 'status_alterado',
  'proposta_criada', 'proposta_aprovada',
  'atividade_criada', 'atividade_concluida',
  'anotacao', 'importacao', 'campo_alterado',
]

const anotacaoSchema = z.object({
  texto: z.string().min(1).max(1000),
})

export async function historicoRoutes(fastify: FastifyInstance) {
  // GET /api/leads/:id/historico
  fastify.get('/:id/historico', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const { tipos } = req.query as { tipos?: string }

    const tiposFiltro = tipos
      ? tipos.split(',').filter(t => TIPOS_VALIDOS.includes(t))
      : undefined

    const historico = await prisma.historicoLead.findMany({
      where: {
        leadId: id,
        ...(tiposFiltro?.length ? { tipoEvento: { in: tiposFiltro } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { usuario: { select: { nome: true } } },
    })

    return reply.send(historico)
  })

  // POST /api/leads/:id/historico/anotacao
  fastify.post('/:id/historico/anotacao', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as any
    const { texto } = anotacaoSchema.parse(req.body)
    const usuarioId = (req as any).user.id

    // Verifica que o lead existe e o usuário tem acesso
    const lead = await prisma.lead.findUnique({ where: { id }, select: { vendedorId: true } })
    if (!lead) return reply.code(404).send({ error: 'Lead não encontrado' })

    const perfil = (req as any).user.perfil
    if (perfil === 'VENDEDOR' && lead.vendedorId !== usuarioId) {
      return reply.code(403).send({ error: 'Acesso negado' })
    }

    const item = await registrarHistorico({
      leadId: id,
      tipoEvento: 'anotacao',
      descricao: texto,
      usuarioId,
    }, prisma)

    return reply.code(201).send(item)
  })

  // GET /api/leads/:id/historico/export-pdf
  fastify.get('/:id/historico/export-pdf', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as any

    const [lead, historico] = await Promise.all([
      prisma.lead.findUnique({
        where: { id },
        select: { nomeEmpresa: true, etapaFunil: true, vendedor: { select: { nome: true } } },
      }),
      prisma.historicoLead.findMany({
        where: { leadId: id },
        orderBy: { createdAt: 'asc' },
        include: { usuario: { select: { nome: true } } },
      }),
    ])

    if (!lead) return reply.code(404).send({ error: 'Lead não encontrado' })

    const pdf = await gerarPdfHistorico(lead, historico)
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="historico-${id}.pdf"`)
      .send(pdf)
  })
}
```

## historico.pdf.ts

```typescript
import ReactPDF, { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'; import { ptBR } from 'date-fns/locale'

const styles = StyleSheet.create({
  page:    { padding: 32, fontFamily: 'Helvetica', fontSize: 10 },
  title:   { fontSize: 16, marginBottom: 4, fontWeight: 'bold' },
  sub:     { fontSize: 10, color: '#6b7280', marginBottom: 16 },
  item:    { marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#e5e7eb' },
  date:    { color: '#6b7280', fontSize: 9 },
  desc:    { marginTop: 2 },
  change:  { color: '#2563eb', marginTop: 2 },
  autor:   { color: '#9ca3af', fontSize: 9, marginTop: 2 },
})

export async function gerarPdfHistorico(lead: any, historico: any[]) {
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{lead.nomeEmpresa}</Text>
        <Text style={styles.sub}>
          Etapa: {lead.etapaFunil} · Vendedor: {lead.vendedor?.nome ?? 'Sem vendedor'}
        </Text>
        {historico.map((h, i) => (
          <View key={i} style={styles.item}>
            <Text style={styles.date}>
              {format(new Date(h.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} — {h.tipoEvento.replace(/_/g, ' ')}
            </Text>
            <Text style={styles.desc}>{h.descricao}</Text>
            {h.valorAnterior && h.valorNovo && (
              <Text style={styles.change}>De: {h.valorAnterior} → Para: {h.valorNovo}</Text>
            )}
            <Text style={styles.autor}>por {h.usuario?.nome ?? 'Sistema'}</Text>
          </View>
        ))}
      </Page>
    </Document>
  )
  return ReactPDF.renderToBuffer(doc)
}
```

## Registro das rotas (integrado ao leads routes existente)

```typescript
// No leads.routes.ts existente, adicionar:
import { historicoRoutes } from './historico.routes'

// Dentro do plugin de leads:
fastify.register(historicoRoutes, { prefix: '/api/leads' })
// Isso expõe: /api/leads/:id/historico, /api/leads/:id/historico/anotacao, etc.
```
