# Sprint 16 — Step 03 — Daniel Mendes (Tech Lead)
# Nutrição / Recontato Futuro — Arquitetura

## Sem novos modelos Prisma

O modelo Lead já possui todos os campos necessários:
- `status` (enum: ativo/perdido)
- `motivoPerda`
- `podeRecontatar` (string: 'sim'/'nao')
- `dataRecontato` (DateTime?)
- `etapaFunil`
- `vendedorId`

Nenhuma migração necessária.

## Queries de nutrição

```typescript
type FiltroNutricao = {
  vendedorId?: string
  perfil: string
  userId: string
}

type NutricaoSection = {
  vencidos:  NutricaoLead[]
  hoje:      NutricaoLead[]
  proximos:  NutricaoLead[]
  totalAlerta: number  // vencidos.length + hoje.length
}

type NutricaoLead = {
  id: string
  nomeEmpresa: string
  motivoPerda: string | null
  dataRecontato: Date
  diasAtraso: number  // negativo = futuro
  vendedorId: string
  vendedorNome: string
  segmento: string | null
  whatsapp: string | null
}

async function getNutricao(filtro: FiltroNutricao, prisma: PrismaClient): Promise<NutricaoSection> {
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1)
  const em7dias = new Date(hoje); em7dias.setDate(em7dias.getDate() + 8)

  const where: any = {
    status: 'perdido',
    podeRecontatar: 'sim',
    dataRecontato: { not: null, lte: em7dias },
  }

  if (filtro.perfil === 'VENDEDOR') {
    where.vendedorId = filtro.userId
  } else if (filtro.vendedorId) {
    where.vendedorId = filtro.vendedorId
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { dataRecontato: 'asc' },
    select: {
      id: true, nomeEmpresa: true, motivoPerda: true, dataRecontato: true,
      vendedorId: true, segmento: true, whatsapp: true,
      vendedor: { select: { nome: true } },
    },
  })

  const mapper = (l: typeof leads[0]): NutricaoLead => {
    const dr = l.dataRecontato!
    const drDay = new Date(dr); drDay.setHours(0,0,0,0)
    const diff = Math.floor((drDay.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
    return {
      id: l.id,
      nomeEmpresa: l.nomeEmpresa,
      motivoPerda: l.motivoPerda,
      dataRecontato: dr,
      diasAtraso: diff, // negativo = atrasado, 0 = hoje, positivo = futuro
      vendedorId: l.vendedorId ?? '',
      vendedorNome: l.vendedor?.nome ?? 'Sem vendedor',
      segmento: l.segmento,
      whatsapp: l.whatsapp,
    }
  }

  const vencidos = leads.filter(l => { const d = new Date(l.dataRecontato!); d.setHours(0,0,0,0); return d < hoje }).map(mapper)
  const hojeArr  = leads.filter(l => { const d = new Date(l.dataRecontato!); d.setHours(0,0,0,0); return d.getTime() === hoje.getTime() }).map(mapper)
  const proximos = leads.filter(l => { const d = new Date(l.dataRecontato!); d.setHours(0,0,0,0); return d > hoje }).map(mapper)

  return {
    vencidos,
    hoje: hojeArr,
    proximos,
    totalAlerta: vencidos.length + hojeArr.length,
  }
}
```

## Operação: reativar lead

```typescript
async function reativarLead(leadId: string, usuarioId: string, prisma: PrismaClient) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  if (!lead || lead.status !== 'perdido') throw new Error('Lead não está na fila de nutrição')

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: 'ativo',
      etapaFunil: 'qualificacao',
      motivoPerda: null,
      podeRecontatar: null,
      dataRecontato: null,
      concorrenteEscolhido: null,
    },
  })

  await registrarHistorico({
    leadId,
    tipoEvento: 'status_alterado',
    descricao: 'Reativado da fila de nutrição',
    valorAnterior: 'perdido',
    valorNovo: 'ativo',
    usuarioId,
  }, prisma)
}
```

## Operação: reagendar

```typescript
async function reagendarRecontato(leadId: string, novaData: Date, usuarioId: string, prisma: PrismaClient) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { dataRecontato: true } })

  await prisma.lead.update({
    where: { id: leadId },
    data: { dataRecontato: novaData },
  })

  await registrarHistorico({
    leadId,
    tipoEvento: 'campo_alterado',
    descricao: 'Recontato reagendado',
    valorAnterior: lead?.dataRecontato?.toISOString() ?? '',
    valorNovo: novaData.toISOString(),
    usuarioId,
  }, prisma)
}
```

## Alerta: extensão do cron job existente

```typescript
// src/jobs/alertas.ts — já existe; adicionar verificação de nutrição:

async function verificarNutricao(prisma: PrismaClient) {
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1)

  const urgentes = await prisma.lead.findMany({
    where: {
      status: 'perdido',
      podeRecontatar: 'sim',
      dataRecontato: { lte: amanha }, // vencidos + hoje
      vendedorId: { not: null },
    },
    select: { nomeEmpresa: true, vendedorId: true, dataRecontato: true },
  })

  // Agrupa por vendedor e emite alerta (mesmo mecanismo de alertas existente)
  const porVendedor = groupBy(urgentes, u => u.vendedorId!)
  for (const [vendedorId, leads] of Object.entries(porVendedor)) {
    alertaEmitter.emit(`alerta:${vendedorId}`, {
      tipo: 'nutricao',
      count: leads.length,
      leads: leads.slice(0, 5).map(l => l.nomeEmpresa),
    })
  }
}

// Adicionar ao cron job existente:
cron.schedule('0 * * * *', async () => {
  await verificarPropostasVencendo(prisma)
  await verificarLeadsSemContato(prisma)
  await verificarNutricao(prisma)    // NOVO
})
```

## API endpoints

```
GET  /api/nutricao?vendedorId=xxx       → NutricaoSection (3 grupos + totalAlerta)
GET  /api/nutricao/alerta               → { total: n, leads: ['...'] } para o sino
POST /api/nutricao/:leadId/reativar     → reativa lead
PATCH /api/nutricao/:leadId/reagendar  → { dataRecontato: ISO }
GET  /api/nutricao/export-csv           → CSV
```

## CSV export

```
nomeEmpresa,motivoPerda,dataRecontato,vendedor,diasAtraso
Farmácia Bom Saúde,Sem orçamento,2026-05-12,Ana Lima,-6
```

## Decisões

- **Sem nova tabela:** todos os dados já existem em Lead
- **Query única com range até +7 dias:** simples e eficiente; filtros por seção feitos em memória no serviço
- **Reativar zera 4 campos:** motivoPerda, podeRecontatar, dataRecontato, concorrenteEscolhido — estado limpo para o novo ciclo
- **Alerta via EventEmitter existente:** reutiliza o mesmo mecanismo dos outros alertas; não adiciona WebSocket novo
- **Cron job extend:** adição de uma função ao job existente; sem novo cron
