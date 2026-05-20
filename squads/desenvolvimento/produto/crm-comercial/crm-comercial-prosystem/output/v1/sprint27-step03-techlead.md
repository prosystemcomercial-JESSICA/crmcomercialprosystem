# Sprint 27 — Step 03 — Daniel Mendes (Tech Lead)
# Agenda Avançada + Dashboard de Dia — Arquitetura Técnica

---

## 1. Novas Tabelas — Schema Prisma + SQL

### 1.1 Enum: StatusTarefa

```prisma
enum StatusTarefa {
  ABERTA
  CONCLUIDA
  CANCELADA
}
```

### 1.2 Enum: PrioridadeTarefa

```prisma
enum PrioridadeTarefa {
  ALTA
  MEDIA
  BAIXA
}
```

### 1.3 Enum: StatusSemaforoHoje

```prisma
enum StatusSemaforoHoje {
  VERDE    // tudo ok
  AMARELO  // atenção
  VERMELHO // crítico
}
```

### 1.4 Tabela: Tarefa

```prisma
model Tarefa {
  id              String             @id @default(cuid())
  titulo          String
  descricao       String?
  status          StatusTarefa       @default(ABERTA)
  prioridade      PrioridadeTarefa   @default(MEDIA)
  dataVencimento  DateTime?
  leadId          String?
  propostaId      String?
  criadoPorId     String
  atribuidoParaId String
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  lead           Lead?            @relation(fields: [leadId], references: [id], onDelete: SetNull)
  proposta       Proposta?        @relation(fields: [propostaId], references: [id], onDelete: SetNull)
  criadoPor      User             @relation("TarefasCriadas", fields: [criadoPorId], references: [id])
  atribuidoPara  User             @relation("TarefasAtribuidas", fields: [atribuidoParaId], references: [id])

  @@index([criadoPorId])
  @@index([atribuidoParaId])
  @@index([leadId])
  @@index([propostaId])
  @@index([dataVencimento])
  @@index([status])
}
```

```sql
CREATE TYPE "StatusTarefa"      AS ENUM ('ABERTA','CONCLUIDA','CANCELADA');
CREATE TYPE "PrioridadeTarefa"  AS ENUM ('ALTA','MEDIA','BAIXA');
CREATE TYPE "StatusSemaforoHoje" AS ENUM ('VERDE','AMARELO','VERMELHO');

CREATE TABLE "Tarefa" (
  "id"              TEXT                 NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "titulo"          TEXT                 NOT NULL,
  "descricao"       TEXT,
  "status"          "StatusTarefa"       NOT NULL DEFAULT 'ABERTA',
  "prioridade"      "PrioridadeTarefa"   NOT NULL DEFAULT 'MEDIA',
  "dataVencimento"  TIMESTAMPTZ,
  "leadId"          TEXT,
  "propostaId"      TEXT,
  "criadoPorId"     TEXT                 NOT NULL,
  "atribuidoParaId" TEXT                 NOT NULL,
  "createdAt"       TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  CONSTRAINT "Tarefa_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Tarefa_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL,
  CONSTRAINT "Tarefa_propostaId_fkey"
    FOREIGN KEY ("propostaId") REFERENCES "Proposta"("id") ON DELETE SET NULL,
  CONSTRAINT "Tarefa_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId") REFERENCES "User"("id"),
  CONSTRAINT "Tarefa_atribuidoParaId_fkey"
    FOREIGN KEY ("atribuidoParaId") REFERENCES "User"("id")
);

CREATE INDEX "Tarefa_criadoPorId_idx"    ON "Tarefa"("criadoPorId");
CREATE INDEX "Tarefa_atribuidoParaId_idx" ON "Tarefa"("atribuidoParaId");
CREATE INDEX "Tarefa_leadId_idx"         ON "Tarefa"("leadId");
CREATE INDEX "Tarefa_propostaId_idx"     ON "Tarefa"("propostaId");
CREATE INDEX "Tarefa_dataVencimento_idx" ON "Tarefa"("dataVencimento");
CREATE INDEX "Tarefa_status_idx"         ON "Tarefa"("status");
```

### 1.5 Extensão: AgendaEvento — novos campos

```prisma
model AgendaEvento {
  // campos existentes ...
  
  // novos campos Sprint 27
  dataRealizacao   DateTime?   // preenchido quando status = REALIZADO
  motivoCancelamento String?   // preenchido quando cancelado
  duracaoEstimada  Int?        // minutos entre dataFim - dataInicio
  durationRealizada Int?       // minutos registrados pelo usuário
  observacoes      String?     // notas da realização
}
```

```sql
ALTER TABLE "AgendaEvento" ADD COLUMN IF NOT EXISTS "dataRealizacao" TIMESTAMPTZ;
ALTER TABLE "AgendaEvento" ADD COLUMN IF NOT EXISTS "motivoCancelamento" TEXT;
ALTER TABLE "AgendaEvento" ADD COLUMN IF NOT EXISTS "durationRealizada" INTEGER;
ALTER TABLE "AgendaEvento" ADD COLUMN IF NOT EXISTS "observacoes" TEXT;
```

---

## 2. Relacionamentos no Prisma — alterações

```prisma
// Lead
model Lead {
  // ... existentes ...
  tarefas Tarefa[]
}

// User — adicionar relações
model User {
  // ... existentes ...
  tarefasCriadas    Tarefa[] @relation("TarefasCriadas")
  tarefasAtribuidas Tarefa[] @relation("TarefasAtribuidas")
}

// Proposta — adicionar relação
model Proposta {
  // ... existentes ...
  tarefas Tarefa[]
}
```

---

## 3. Lógica do Semáforo — Cálculo de Status do Dia

```typescript
// lib/semaforo.ts
import { prisma } from './prisma'

export async function calcularSemaforoHoje(userId: string): Promise<{
  status: 'VERDE' | 'AMARELO' | 'VERMELHO'
  indicadores: {
    reunioesHoje: number
    reunioesRealizadas: number
    reunioesNaoCompareceu: number
    leadsAtivos: number
    leadsSemMovimentoMais3d: number
    leadsEmRisco: number
    propostasAtivas: number
    propostasVencendo7d: number
    propostasVencidas: number
    tarefasAbiertas: number
    tarefasVencidas: number
  }
  cor: 'green' | 'yellow' | 'red'
}> {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const amanha = new Date(hoje)
  amanha.setDate(amanha.getDate() + 1)

  // ─── Reuniões de hoje ─────────────────────────────────────────────────
  const reunioesHoje = await prisma.agendaEvento.count({
    where: {
      criadoPorId: userId,
      dataInicio: { gte: hoje, lt: amanha },
      status: { notIn: ['CANCELADO'] },
    },
  })

  const reunioesRealizadas = await prisma.agendaEvento.count({
    where: {
      criadoPorId: userId,
      dataInicio: { gte: hoje, lt: amanha },
      status: 'REALIZADO',
    },
  })

  const reunioesNaoCompareceu = await prisma.agendaEvento.count({
    where: {
      criadoPorId: userId,
      dataInicio: { gte: hoje, lt: amanha },
      status: 'NAO_COMPARECEU',
    },
  })

  // ─── Leads ────────────────────────────────────────────────────────────
  const leadsAtivos = await prisma.lead.count({
    where: {
      vendedorId: userId,
      status: { notIn: ['PERDIDO', 'CANCELADO'] },
    },
  })

  // leads sem movimento nos últimos 3 dias
  const tres_dias_atras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  const leadsSemMovimento3d = await prisma.lead.count({
    where: {
      vendedorId: userId,
      status: { notIn: ['PERDIDO', 'CANCELADO'] },
      updatedAt: { lt: tres_dias_atras },
    },
  })

  // leads em risco (sem movimento > 7 dias)
  const sete_dias_atras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const leadsEmRisco = await prisma.lead.count({
    where: {
      vendedorId: userId,
      status: { notIn: ['PERDIDO', 'CANCELADO'] },
      updatedAt: { lt: sete_dias_atras },
    },
  })

  // ─── Propostas ────────────────────────────────────────────────────────
  const propostasAtivas = await prisma.proposta.count({
    where: {
      lead: { vendedorId: userId },
      status: { notIn: ['PERDIDA', 'CANCELADA'] },
    },
  })

  // propostas vencendo em < 7 dias
  const proximo_7dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const propostasVencendo7d = await prisma.proposta.count({
    where: {
      lead: { vendedorId: userId },
      dataPrazoDecisao: { gt: hoje, lte: proximo_7dias },
      status: { notIn: ['PERDIDA', 'CANCELADA'] },
    },
  })

  // propostas vencidas
  const propostasVencidas = await prisma.proposta.count({
    where: {
      lead: { vendedorId: userId },
      dataPrazoDecisao: { lt: hoje },
      status: { notIn: ['PERDIDA', 'CANCELADA', 'GANHA'] },
    },
  })

  // ─── Tarefas ──────────────────────────────────────────────────────────
  const tarefasAbertas = await prisma.tarefa.count({
    where: {
      atribuidoParaId: userId,
      status: 'ABERTA',
    },
  })

  const tarefasVencidas = await prisma.tarefa.count({
    where: {
      atribuidoParaId: userId,
      status: 'ABERTA',
      dataVencimento: { lt: hoje },
    },
  })

  // ─── Lógica do Semáforo ───────────────────────────────────────────────
  let status: 'VERDE' | 'AMARELO' | 'VERMELHO' = 'VERDE'

  // VERMELHO: crítico
  if (
    reunioesNaoCompareceu > 0 ||
    propostasVencidas > 0 ||
    leadsEmRisco > 0 ||
    tarefasVencidas > 0
  ) {
    status = 'VERMELHO'
  }
  // AMARELO: atenção
  else if (
    (reunioesHoje > 0 && reunioesRealizadas < reunioesHoje) ||
    leadsSemMovimento3d > 0 ||
    propostasVencendo7d > 0 ||
    tarefasAbertas > 5
  ) {
    status = 'AMARELO'
  }
  // VERDE: tudo ok (default)

  return {
    status,
    indicadores: {
      reunioesHoje,
      reunioesRealizadas,
      reunioesNaoCompareceu,
      leadsAtivos,
      leadsSemMovimentoMais3d: leadsSemMovimento3d,
      leadsEmRisco,
      propostasAtivas,
      propostasVencendo7d,
      propostasVencidas,
      tarefasAbiertas: tarefasAbertas,
      tarefasVencidas,
    },
    cor: status === 'VERDE' ? 'green' : status === 'AMARELO' ? 'yellow' : 'red',
  }
}
```

---

## 4. Tipos novos no HistoricoLead — extensão do enum

```typescript
// Adicionar ao enum TipoHistorico:
// reuniao_realizada
// reuniao_remarcada
// reuniao_nao_compareceu
// tarefa_criada
// tarefa_concluida
// tarefa_cancelada
```

```sql
ALTER TYPE "TipoHistorico" ADD VALUE IF NOT EXISTS 'reuniao_realizada';
ALTER TYPE "TipoHistorico" ADD VALUE IF NOT EXISTS 'reuniao_remarcada';
ALTER TYPE "TipoHistorico" ADD VALUE IF NOT EXISTS 'reuniao_nao_compareceu';
ALTER TYPE "TipoHistorico" ADD VALUE IF NOT EXISTS 'tarefa_criada';
ALTER TYPE "TipoHistorico" ADD VALUE IF NOT EXISTS 'tarefa_concluida';
ALTER TYPE "TipoHistorico" ADD VALUE IF NOT EXISTS 'tarefa_cancelada';
```

---

## 5. Rotas — Visão Geral

### 5.1 Dashboard

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | /dashboard/dia | Todos | Semáforo + indicadores para homepage |
| GET | /dashboard/dia?vendedorId=:id | SUPERVISAO+ | Semáforo de outro vendedor |

### 5.2 Tarefas

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | /tarefas | Todos | Lista (filtros: status, prioridade, leadId, atribuidoPara) |
| POST | /tarefas | VENDEDOR+ | Criar tarefa |
| PATCH | /tarefas/:id | Criador/SUPV+ | Atualizar tarefa |
| DELETE | /tarefas/:id | Criador/SUPV+ | Cancelar tarefa |
| PATCH | /tarefas/bulk | VENDEDOR+ | Bulk update (status, múltiplas IDs) |

### 5.3 Agenda (extensão Sprint 26)

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| PATCH | /agenda/eventos/:id/realizado | Criador/SUPV+ | Marca como realizado + observações |
| PATCH | /agenda/eventos/:id/remarcar | Criador/SUPV+ | Transição para remarcado + nova data |
| PATCH | /agenda/eventos/:id/nao-compareceu | Criador/SUPV+ | Marca não compareceu |
| PATCH | /agenda/eventos/bulk | VENDEDOR+ | Bulk status update |
| GET | /agenda/relatorios?tipo=agenda&inicio&fim | SUPERVISAO+ | Relatório XLSX |

---

## 6. Estratégia de Cache

| Endpoint | Cache Key | TTL |
|----------|-----------|-----|
| GET /dashboard/dia | `dash:dia:${userId}:${date}` | 10 min |
| GET /tarefas | `tarefas:${atribuidoParaId}:${status}` | 5 min |
| GET /agenda/relatorios | `agenda:rel:${tipo}:${inicio}:${fim}:${vendedorId}` | 30 min |

---

## 7. Notificações — Cron Jobs Novos

```typescript
// cron: a cada hora +05 min (08:05, 09:05, 10:05, ..., 23:05)
// Gatilho: reunião em 10 minutos não realizada/não marcada
// Ação: emit WebSocket para usuário conectado + toast notification

// cron: a cada hora +55 min (08:55, 09:55, 10:55, ..., 22:55)
// Gatilho: reunião que deveria ter sido realizada 1h atrás (status=AGENDADO)
// Ação: emit WebSocket + toast com botões rápidos [✅ Realizada] [❌ Não apareceu]

// cron: 08:00 diariamente
// Gatilho: tarefas vencidas (dataVencimento < hoje && status=ABERTA)
// Ação: emit WebSocket + marca como crítica

Nota: WebSocket permite notificações em tempo real sem polling;
toast no frontend é gerado por evento ao invés de cron tradicional
```

---

## 8. Validações no Schema

```typescript
// Tarefa schema
export const criarTarefaSchema = z.object({
  titulo:           z.string().min(3).max(200),
  descricao:        z.string().max(2000).optional(),
  prioridade:       z.enum(['ALTA','MEDIA','BAIXA']).default('MEDIA'),
  dataVencimento:   z.string().datetime().optional(),
  leadId:           z.string().optional(),
  propostaId:       z.string().optional(),
  atribuidoParaId:  z.string().min(1),
}).refine(d => d.leadId || d.propostaId || true, { // opcional vínculo
  message: 'Tarefa deve ter contexto (lead ou proposta recomendado)',
})

export const updateTarefaSchema = criarTarefaSchema.partial()

// Event transition schema
export const marcarComoRealizadoSchema = z.object({
  observacoes:       z.string().max(500).optional(),
  durationRealizada: z.number().int().min(0).optional(),
})

export const remarcarSchema = z.object({
  novaData:   z.string().datetime(),
  novaHora:   z.string().regex(/^\d{2}:\d{2}$/),
  motivo:     z.string().max(200).optional(),
})
```

---

## 9. Índices e Performance

- `Tarefa(atribuidoParaId, status)` — lista tarefas do usuário
- `Tarefa(dataVencimento)` — encontrar vencidas rapidamente
- `AgendaEvento(criadoPorId, dataInicio)` — reuniões de um vendedor
- `AgendaEvento(status)` — countAgendado/Realizado para KPIs

---

## Sprint 27 — STEP 03 PRONTO ✅
