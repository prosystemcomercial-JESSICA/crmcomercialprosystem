# Sprint 34 — Step 03 — Daniel Mendes (Tech Lead)
# Vínculo Manual WA → Lead — Arquitetura

## Schema Changes

```prisma
// Migration: adicionar campos arquivada em WhatsappConversa
// NENHUMA tabela nova — apenas 3 campos novos

model WhatsappConversa {
  id                       String             @id @default(cuid())
  telefone                 String             @unique
  leadId                   String?
  lead                     Lead?              @relation(fields: [leadId], references: [id])
  arquivada                Boolean            @default(false)   // NOVO
  arquivadaEm              DateTime?                            // NOVO
  arquivadaPorId           String?                              // NOVO
  arquivadaPor             Usuario?           @relation("ConversaArquivadaPor", fields: [arquivadaPorId], references: [id])
  ultimaMensagemEm         DateTime?
  ultimaMensagemRecebidaEm DateTime?
  totalNaoLidas            Int                @default(0)
  mensagens                WhatsappMensagem[]
  criadoEm                 DateTime           @default(now())
}
```

## Migration SQL

```sql
-- Adicionar campos
ALTER TABLE "WhatsappConversa"
  ADD COLUMN "arquivada"       BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN "arquivadaEm"     TIMESTAMP,
  ADD COLUMN "arquivadaPorId"  TEXT;

-- FK para usuario
ALTER TABLE "WhatsappConversa"
  ADD CONSTRAINT "WhatsappConversa_arquivadaPorId_fkey"
  FOREIGN KEY ("arquivadaPorId") REFERENCES "Usuario"("id")
  ON DELETE SET NULL;

-- Índice parcial para performance na lista de desconhecidos
CREATE INDEX idx_wa_conversa_desconhecida
  ON "WhatsappConversa" ("ultimaMensagemEm" DESC)
  WHERE "leadId" IS NULL AND "arquivada" = false;

-- Novos enum values para HistoricoLead
ALTER TYPE "TipoEventoHistorico" ADD VALUE IF NOT EXISTS 'conversa_wa_vinculada';
ALTER TYPE "TipoEventoHistorico" ADD VALUE IF NOT EXISTS 'lead_criado_via_whatsapp';
```

## Endpoints Novos

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/conversas/desconhecidas` | SUPERVISAO/CEO/ADMIN | Lista conversas sem lead |
| GET | `/api/conversas/desconhecidas/contagem` | SUPERVISAO/CEO/ADMIN | Contagem para badge |
| GET | `/api/conversas/desconhecidas/:id/mensagens` | SUPERVISAO/CEO/ADMIN | Thread completa |
| PATCH | `/api/conversas/desconhecidas/:id/vincular` | SUPERVISAO/CEO/ADMIN | Vincular a lead existente |
| POST | `/api/conversas/desconhecidas/:id/criar-lead` | SUPERVISAO/CEO/ADMIN | Criar lead + vincular |
| PATCH | `/api/conversas/desconhecidas/:id/arquivar` | SUPERVISAO/CEO/ADMIN | Arquivar/restaurar |

## Decisões de Arquitetura

1. **Reutilização máxima:** `criarLead()` do módulo leads existente. Busca usa `GET /api/leads/buscar?q=` já implementado.
2. **Sem tabela nova:** 3 campos em `WhatsappConversa` + 2 enum values. Migration mínima.
3. **SSE:** `sseHub.notificarUsuario()` já existe (Sprint 20) — apenas novo tipo de evento.
4. **Cache keys:** `desconhecidas-lista`, `desconhecidas-contagem` — TTL 2min — invalidar em vincular/arquivar.
5. **Permissões:** middleware de role guard — VENDEDOR recebe 403 em todos os endpoints /desconhecidas.

## Cache Strategy

```typescript
const CACHE_DESCONHECIDAS_LISTA = 'wa-desconhecidas-lista'
const CACHE_DESCONHECIDAS_CONTAGEM = 'wa-desconhecidas-contagem'
// TTL: 2min
// Invalidar após: vincular, criar-lead, arquivar
```
