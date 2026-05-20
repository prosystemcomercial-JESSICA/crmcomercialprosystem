# Sprint 25 — Step 03 — Daniel Mendes (Tech Lead)
# Metas e Comissões Avançado — Arquitetura

---

## Decisões de Arquitetura

Esta sprint é majoritariamente de **leitura e agregação** — todas as tabelas já existem da Sprint 24. A única adição estrutural é `FechamentoMensal`.

```
src/
  modules/
    metas-comissoes/
      dashboard/
        dashboard.service.ts      ← GET /dashboard/vendedor e /dashboard/supervisor
        dashboard.routes.ts
      ranking/
        ranking.service.ts        ← GET /ranking
        ranking.routes.ts
      fechamento-mensal/
        fechamento-mensal.service.ts
        fechamento-mensal.routes.ts
      relatorios/
        relatorios-mc.service.ts  ← 4 tipos XLSX
        relatorios-mc.routes.ts
```

---

## Schema — nova tabela

```sql
-- ────────────────────────────────────────────────
-- ENUM
-- ────────────────────────────────────────────────
CREATE TYPE "StatusFechamento" AS ENUM (
  'ABERTO','EM_REVISAO','APROVADO','PAGO','CANCELADO'
);

-- ────────────────────────────────────────────────
-- TABELA: FechamentoMensal
-- ────────────────────────────────────────────────
CREATE TABLE "FechamentoMensal" (
  "id"                      TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "mes"                     INTEGER NOT NULL CHECK ("mes" BETWEEN 1 AND 12),
  "ano"                     INTEGER NOT NULL,
  "status"                  "StatusFechamento" NOT NULL DEFAULT 'ABERTO',
  "totalComissoesLiberadas" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalVendedores"         INTEGER NOT NULL DEFAULT 0,
  "observacoes"             TEXT,
  "criadoPorId"             TEXT NOT NULL,
  "aprovadoPorId"           TEXT,
  "dataAprovacao"           TIMESTAMPTZ,
  "paidById"                TEXT,
  "dataPagamento"           TIMESTAMPTZ,
  "createdAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "FechamentoMensal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FechamentoMensal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId")
    REFERENCES "User"("id") ON DELETE RESTRICT,
  CONSTRAINT "FechamentoMensal_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId")
    REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "FechamentoMensal_paidById_fkey" FOREIGN KEY ("paidById")
    REFERENCES "User"("id") ON DELETE SET NULL
);

-- apenas 1 fechamento por mês/ano
CREATE UNIQUE INDEX "FechamentoMensal_mes_ano_key" ON "FechamentoMensal"("mes", "ano");
CREATE INDEX "FechamentoMensal_status_idx" ON "FechamentoMensal"("status");
```

---

## Adição a Comissao (FK opcional para fechamento)

```sql
-- Adicionar coluna para rastrear qual fechamento pagou a comissão
ALTER TABLE "Comissao" ADD COLUMN IF NOT EXISTS "fechamentoId" TEXT;
ALTER TABLE "Comissao" ADD CONSTRAINT "Comissao_fechamentoId_fkey"
  FOREIGN KEY ("fechamentoId") REFERENCES "FechamentoMensal"("id") ON DELETE SET NULL;
CREATE INDEX "Comissao_fechamentoId_idx" ON "Comissao"("fechamentoId");
```

---

## Arquitetura dos Dashboards

```
GET /dashboard/vendedor
  ↓
  dashboardVendedor(userId, mes, ano, prisma)
  ├── aggregate Comissao (status=PREVISTA/LIBERADA/PAGA, vendedorId, mês)
  ├── aggregate Recebimento (vendedorId, mês)
  ├── count Contrato (vendedorId, mês)
  ├── count IndicacaoParceiro (vendedorId, mês)
  ├── findMany Meta (vendedorId, mês) → inclui percentualAtingido
  ├── findMany Comissao (últimas 5, vendedorId)
  ├── findMany IndicacaoParceiro (últimas 5, vendedorId)
  ├── findMany Recebimento (pendentes/vencidos, vendedorId)
  └── série temporal: GROUP BY dia para LineChart

GET /dashboard/supervisor
  ↓
  dashboardSupervisor(mes, ano, vendedorId?, prisma)
  ├── 14 KPIs via queries agregadas com filtros opcionais
  ├── comissaoPorVendedor: GROUP BY vendedorId, ORDER BY sum DESC, LIMIT 10
  ├── distribuicaoStatus: GROUP BY status (Comissao)
  ├── evolucaoMensal: últimos 12 meses, GROUP BY mes/ano
  └── indicacoesPorParceiro: GROUP BY parceiroId, ORDER BY count DESC, LIMIT 8
```

---

## Arquitetura do Ranking

```typescript
// Fórmula de pontuação:
interface PontuacaoVendedor {
  vendedorId: string
  nomeVendedor: string
  totalPontos: number
  contratosNoMes: number    // × 3
  mrrNoMes: number          // / 100 (arredondado)
  indicacoesConvertidas: number // × 2
  metasAtingidas100: number    // × 5 (bônus por meta acima de 100%)
  comissaoLiberada: number
  posicao: number
}

// Cálculo:
totalPontos = (contratos × 3) + Math.floor(mrr / 100) + (indicacoes × 2) + (metas100 × 5)
// Desempate: comissaoLiberada DESC
```

---

## Rotas — visão geral

```
GET  /dashboard/vendedor                    → VENDEDOR (próprio), SUPERVISAO+
GET  /dashboard/supervisor                  → SUPERVISAO, CEO, ADMIN
GET  /ranking                               → TODOS os roles
GET  /fechamentos                           → SUPERVISAO+
POST /fechamentos                           → SUPERVISAO+
GET  /fechamentos/:id                       → SUPERVISAO+
GET  /fechamentos/:id/preview               → SUPERVISAO+
PATCH /fechamentos/:id/aprovar              → SUPERVISAO+
PATCH /fechamentos/:id/pagar               → CEO, ADMIN
GET  /metas-comissoes/relatorios            → SUPERVISAO+
```

---

## Cache Strategy

| Endpoint | TTL | Chave |
|----------|-----|-------|
| /dashboard/vendedor | 5min | `dash:vend:${userId}:${mes}:${ano}` |
| /dashboard/supervisor | 10min | `dash:sup:${mes}:${ano}:${vendedorId\|all}` |
| /ranking | 10min | `rank:${mes}:${ano}` |
| /metas-comissoes/relatorios | 5min | `rel:mc:${tipo}:${inicio}:${fim}:${vendedorId\|all}` |

---

## Sprint 25 — TECH LEAD PRONTO ✅
