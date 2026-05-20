# Sprint 33 — Step 03 — Daniel Mendes (Tech Lead)
# Softphone Integrado — Arquitetura

## Schema (1 tabela nova)

```prisma
model Chamada {
  id            String        @id @default(cuid())
  leadId        String
  lead          Lead          @relation(fields: [leadId], references: [id])
  usuarioId     String
  usuario       Usuario       @relation(fields: [usuarioId], references: [id])
  numeroDiscado String
  duracao       Int           @default(0)  // segundos
  status        StatusChamada
  sipCallId     String?       @unique      // idempotência
  gravacaoUrl   String?
  resultado     String?       // preenchido pelo vendedor após chamada
  criadoEm      DateTime      @default(now())

  @@index([leadId])
  @@index([usuarioId, criadoEm])
}

enum StatusChamada {
  ATENDIDA
  NAO_ATENDIDA
  OCUPADO
  ERRO
}
```

## Migration SQL

```sql
CREATE TYPE "StatusChamada" AS ENUM ('ATENDIDA', 'NAO_ATENDIDA', 'OCUPADO', 'ERRO');

CREATE TABLE "Chamada" (
  "id"            TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "leadId"        TEXT NOT NULL,
  "usuarioId"     TEXT NOT NULL,
  "numeroDiscado" TEXT NOT NULL,
  "duracao"       INT NOT NULL DEFAULT 0,
  "status"        "StatusChamada" NOT NULL,
  "sipCallId"     TEXT UNIQUE,
  "gravacaoUrl"   TEXT,
  "resultado"     TEXT,
  "criadoEm"      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "Chamada_leadId_fkey"   FOREIGN KEY ("leadId")   REFERENCES "Lead"("id"),
  CONSTRAINT "Chamada_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
);
CREATE INDEX "Chamada_leadId_idx" ON "Chamada"("leadId");
CREATE INDEX "Chamada_usuario_data_idx" ON "Chamada"("usuarioId", "criadoEm" DESC);

-- Novo tipo de evento no histórico
ALTER TYPE "TipoEventoHistorico" ADD VALUE IF NOT EXISTS 'ligacao_softphone';
```

## Endpoints

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/softphone/config` | VENDEDOR+ | Config SIP para JsSIP (sem expor senha em texto) |
| POST | `/api/softphone/chamadas` | VENDEDOR+ | Registrar chamada encerrada |
| GET | `/api/softphone/chamadas/lead/:leadId` | VENDEDOR+ | Histórico de chamadas do lead |
| GET | `/api/softphone/chamadas/em-andamento` | SUPERVISAO+ | Lista em tempo real (polling) |
| GET | `/api/softphone/relatorio` | SUPERVISAO+ | Relatório agregado |
| PUT | `/api/softphone/config-admin` | ADMIN | Salvar config SIP |
| POST | `/api/softphone/config-admin/testar` | ADMIN | Testar conexão SIP |

## Decisões de Arquitetura

1. **JsSIP no browser:** o cliente SIP roda 100% no frontend (WebRTC). Não há proxy SIP no Node — o CRM apenas fornece as credenciais e registra os resultados das chamadas.
2. **Credenciais SIP:** armazenadas criptografadas no banco (AES-256-GCM, mesma chave do Google Calendar Token). Backend retorna config decodificada via HTTPS — nunca exposta no frontend build.
3. **Registro de chamada:** POST ao encerrar — inclui `sipCallId` (gerado pelo JsSIP) para idempotência. Se chamada já existe pelo sipCallId, ignorar.
4. **Painel em andamento:** o CRM não sabe em tempo real quem está em chamada (a sinalização é peer-to-peer). Solução: frontend envia `PATCH /api/softphone/chamadas/:id/em-andamento` a cada 10s durante a chamada. Backend expõe chamadas com `status = EM_ANDAMENTO` (status temporário não persistido — usar Redis TTL 15s ou cache node-cache).
5. **Gravação:** o servidor VoIP grava e envia a URL para o CRM via webhook `POST /api/softphone/gravacao-webhook`. Backend salva na `Chamada.gravacaoUrl`.
6. **STUN:** frontend usa `stun:stun.l.google.com:19302` como fallback para NAT traversal.

## Variáveis novas

```env
# Mesma chave do Google Calendar Token (reutiliza TOKEN_ENCRYPTION_KEY)
# Nenhuma variável nova necessária para o softphone básico
```
