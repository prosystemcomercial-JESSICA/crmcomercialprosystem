# Sprint 23 — Step 03 — Daniel Mendes (Tech Lead)
# Serviços Contratados Avançado — Arquitetura e Schema

---

## Novas tabelas (3 modelos)

```sql
-- ═══════════════════════════════════════════════
-- STEP 1: FeriadoNacional
-- ═══════════════════════════════════════════════
CREATE TABLE "FeriadoNacional" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "data"      DATE NOT NULL UNIQUE,
  "descricao" TEXT NOT NULL,
  "tipo"      TEXT NOT NULL DEFAULT 'Nacional', -- Nacional / Estadual / Municipal
  "estado"    TEXT,
  "cidade"    TEXT,
  "ativo"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed: feriados nacionais 2026
INSERT INTO "FeriadoNacional" ("data", "descricao") VALUES
  ('2026-01-01', 'Confraternização Universal'),
  ('2026-02-16', 'Carnaval (segunda)'),
  ('2026-02-17', 'Carnaval (terça)'),
  ('2026-04-03', 'Sexta-feira Santa'),
  ('2026-04-21', 'Tiradentes'),
  ('2026-05-01', 'Dia do Trabalho'),
  ('2026-06-04', 'Corpus Christi'),
  ('2026-09-07', 'Independência do Brasil'),
  ('2026-10-12', 'Nossa Sra. Aparecida'),
  ('2026-11-02', 'Finados'),
  ('2026-11-15', 'Proclamação da República'),
  ('2026-12-25', 'Natal');

-- ═══════════════════════════════════════════════
-- STEP 2: ChecklistPadrao
-- ═══════════════════════════════════════════════
CREATE TABLE "ChecklistPadrao" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "tipoServicoId" TEXT NOT NULL REFERENCES "TipoServico"("id") ON DELETE CASCADE,
  "ordem"         INTEGER NOT NULL,
  "descricao"     TEXT NOT NULL,
  "obrigatorio"   BOOLEAN NOT NULL DEFAULT true,
  "ativo"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX "ChecklistPadrao_tipoServicoId_idx" ON "ChecklistPadrao"("tipoServicoId");
CREATE UNIQUE INDEX "ChecklistPadrao_tipoServicoId_ordem_idx" ON "ChecklistPadrao"("tipoServicoId", "ordem");

-- ═══════════════════════════════════════════════
-- STEP 3: ChecklistItemServico
-- ═══════════════════════════════════════════════
CREATE TABLE "ChecklistItemServico" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "servicoId"         TEXT NOT NULL REFERENCES "ServicoContratado"("id") ON DELETE CASCADE,
  "checklistPadraoId" TEXT REFERENCES "ChecklistPadrao"("id") ON DELETE SET NULL,
  "ordem"             INTEGER NOT NULL,
  "descricao"         TEXT NOT NULL,
  "obrigatorio"       BOOLEAN NOT NULL DEFAULT true,
  "concluido"         BOOLEAN NOT NULL DEFAULT false,
  "concluidoEm"       TIMESTAMP,
  "concluidoPorId"    TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "observacao"        TEXT,
  "createdAt"         TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX "ChecklistItemServico_servicoId_idx" ON "ChecklistItemServico"("servicoId");

-- ═══════════════════════════════════════════════
-- STEP 4: Coluna dadosExtras em ServicoContratado
-- ═══════════════════════════════════════════════
ALTER TABLE "ServicoContratado" ADD COLUMN IF NOT EXISTS "dadosExtras" TEXT;
```

---

## Atualização da função calcularDataPrevista

```typescript
// src/lib/calcular-data-prevista.ts
import { PrismaClient } from '@prisma/client'

export async function calcularDataPrevista(
  diasUteis: number,
  prisma: PrismaClient,
  inicio: Date = new Date()
): Promise<Date> {
  // carrega feriados futuros dos próximos 60 dias (cache implícito: TTL do node-cache no service)
  const limite = new Date(inicio)
  limite.setDate(limite.getDate() + 90)

  const feriados = await prisma.feriadoNacional.findMany({
    where: {
      ativo: true,
      data: { gte: inicio, lte: limite },
    },
    select: { data: true },
  })

  const feriadoSet = new Set(
    feriados.map((f) => f.data.toISOString().slice(0, 10))
  )

  const data = new Date(inicio)
  let adicionados = 0

  while (adicionados < diasUteis) {
    data.setDate(data.getDate() + 1)
    const dow = data.getDay()
    const iso = data.toISOString().slice(0, 10)
    if (dow !== 0 && dow !== 6 && !feriadoSet.has(iso)) {
      adicionados++
    }
  }

  return data
}
```

---

## Snapshot do checklist ao criar serviço

```typescript
// src/lib/snapshot-checklist.ts
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

  if (itens.length === 0) return []

  return prisma.checklistItemServico.createMany({
    data: itens.map((item) => ({
      servicoId,
      checklistPadraoId: item.id,
      ordem:             item.ordem,
      descricao:         item.descricao,
      obrigatorio:       item.obrigatorio,
    })),
  })
}
```

---

## Estrutura de diretórios — novos arquivos

```
src/modules/servicos/
├── servico-dashboard.routes.ts   ← novo
├── servico-dashboard.service.ts  ← novo
├── servico-relatorio.routes.ts   ← novo
├── servico-relatorio.service.ts  ← novo
├── checklist.routes.ts           ← novo
├── feriado.routes.ts             ← novo

src/lib/
├── calcular-data-prevista.ts     ← substitui a função inline do Sprint 22
└── snapshot-checklist.ts         ← novo
```

---

## Atualizar criarServico para incluir snapshot

```typescript
// Após prisma.servicoContratado.create no servico.service.ts:
import { criarSnapshotChecklist } from '../../lib/snapshot-checklist'

// no final de criarServico():
await criarSnapshotChecklist(servico.id, data.tipoServicoId, prisma)
```

---

## Cache — Dashboard

Mesma estratégia do Sprint 21 (BI):
```typescript
const cache = new NodeCache({ stdTTL: 600 }) // 10min
function dashKey(params: object) { return `srv-dash:${JSON.stringify(params)}` }
```

---

## Permissões adicionais Sprint 23

| Action | FINANCEIRO | TECNICO | SUPERVISAO | CEO | ADMIN |
|--------|------------|---------|------------|-----|-------|
| `verDashboardServicos` | ✅ | ✅* | ✅ | ✅ | ✅ |
| `gerarRelatorioServicos` | ✅ | — | ✅ | ✅ | ✅ |
| `gerenciarChecklists` | — | — | — | ✅ | ✅ |
| `marcarItemChecklist` | — | ✅ | ✅ | ✅ | ✅ |
| `editarDadosExtras` | — | ✅ | ✅ | ✅ | ✅ |
| `gerenciarFeriados` | — | — | — | — | ✅ |

*TECNICO vê somente dados dos serviços designados a ele

---

## Sprint 23 — TECH LEAD PRONTO ✅
