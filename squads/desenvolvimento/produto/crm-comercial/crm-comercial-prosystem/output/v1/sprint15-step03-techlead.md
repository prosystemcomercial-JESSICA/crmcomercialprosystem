# Sprint 15 — Step 03 — Daniel Mendes (Tech Lead)
# Histórico Detalhado — Arquitetura

## Modelo HistoricoLead (já existe — sem alterações)

```prisma
// Já definido desde Sprint 1 — nenhuma migração necessária
model HistoricoLead {
  id             String   @id @default(cuid())
  leadId         String
  lead           Lead     @relation(fields: [leadId], references: [id])
  tipoEvento     String
  descricao      String
  valorAnterior  String?
  valorNovo      String?
  usuarioId      String?
  usuario        User?    @relation(fields: [usuarioId], references: [id])
  createdAt      DateTime @default(now())

  @@map("historico_lead")
}
```

**Decisão:** nenhuma migração. O modelo é suficiente para todos os tipos de evento.

## Utilitário de registro (helper centralizado)

```typescript
// src/lib/historico.ts
import { PrismaClient } from '@prisma/client'

type RegistrarParams = {
  leadId: string
  tipoEvento: string
  descricao: string
  valorAnterior?: string
  valorNovo?: string
  usuarioId?: string
}

export async function registrarHistorico(params: RegistrarParams, prisma: PrismaClient) {
  return prisma.historicoLead.create({ data: params })
}
```

## Eventos a completar/adicionar nos services existentes

### 1. atividade.service.ts — concluirAtividade

```typescript
// Adicionar ao concluirAtividade:
await registrarHistorico({
  leadId: atividade.leadId,
  tipoEvento: 'atividade_concluida',
  descricao: `${atividade.tipo} concluída — "${resultado}"`,
  usuarioId,
}, prisma)
```

### 2. importacao.job.ts — ao criar cada lead

```typescript
// Após prisma.lead.createMany, para cada lead criado:
// (em lote separado para não impactar performance)
await prisma.historicoLead.createMany({
  data: leadsImportados.map(l => ({
    leadId: l.id,
    tipoEvento: 'importacao',
    descricao: `Lead importado via arquivo "${nomeArquivo}"`,
    valorNovo: importacaoId,
    // usuarioId null = Sistema
  }))
})
```

### 3. leads.service.ts — atualizarCampos (PATCH geral)

```typescript
// Ao salvar alterações em campos relevantes:
const CAMPOS_AUDITADOS = ['segmento', 'origem', 'vendedorId', 'temperatura', 'contato', 'whatsapp', 'email']

for (const campo of CAMPOS_AUDITADOS) {
  if (novoValor[campo] !== undefined && novoValor[campo] !== leadAtual[campo]) {
    await registrarHistorico({
      leadId,
      tipoEvento: 'campo_alterado',
      descricao: `Campo "${campo}" alterado`,
      valorAnterior: String(leadAtual[campo] ?? ''),
      valorNovo: String(novoValor[campo] ?? ''),
      usuarioId,
    }, prisma)
  }
}
```

## Novo endpoint: POST /api/leads/:id/historico/anotacao

```typescript
// Body: { texto: string }
// Validação: texto não vazio, máx 1000 chars
// Cria HistoricoLead { tipoEvento: 'anotacao', descricao: texto, usuarioId }
```

## Query de histórico (GET)

```typescript
async function getHistorico(
  leadId: string,
  tipos: string[] | undefined,
  prisma: PrismaClient
) {
  return prisma.historicoLead.findMany({
    where: {
      leadId,
      ...(tipos?.length ? { tipoEvento: { in: tipos } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      usuario: { select: { nome: true } },
    },
  })
}
```

## PDF de histórico (geração server-side)

```typescript
// Estrutura: cabeçalho com dados do lead + lista cronológica de eventos
// @react-pdf/renderer — mesmo padrão dos outros módulos
```

## API endpoints

```
GET  /api/leads/:id/historico?tipos=etapa_alterada,proposta_criada
POST /api/leads/:id/historico/anotacao   { texto }
GET  /api/leads/:id/historico/export-pdf
```

## Decisões

- **Sem nova tabela:** HistoricoLead já serve todos os casos com tipoEvento como discriminador
- **createMany para importação:** registra histórico em batch para não bloquear o job (setImmediate antes)
- **usuarioId null = Sistema:** no frontend, renderiza "Sistema" se usuarioId é null
- **Campos auditados filtrados:** apenas campos com valor semântico para o vendedor — não audita campos técnicos internos
- **Sem paginação no GET:** volume máximo esperado ~500 eventos por lead em 2 anos; resposta < 50KB
