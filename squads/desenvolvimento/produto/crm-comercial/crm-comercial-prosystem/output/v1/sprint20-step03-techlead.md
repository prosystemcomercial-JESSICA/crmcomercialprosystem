# Sprint 20 — Step 03 — Daniel Mendes (Tech Lead)
# Inbound WhatsApp — Arquitetura

## Modelos Prisma

```prisma
enum DirecaoMensagem {
  INBOUND   // recebida do lead
  OUTBOUND  // enviada pelo CRM
}

enum TipoMensagem {
  TEXT
  IMAGE
  AUDIO
  DOCUMENT
  UNSUPPORTED
}

model WhatsappConversa {
  id                      String    @id @default(cuid())
  telefone                String    @unique  // E.164 normalizado
  leadId                  String?
  lead                    Lead?     @relation(fields: [leadId], references: [id], onDelete: SetNull)
  ultimaMensagemEm        DateTime?
  ultimaMensagemRecebidaEm DateTime? // ancora da janela de 24h
  totalNaoLidas           Int       @default(0)
  mensagens               WhatsappMensagem[]
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  @@map("whatsapp_conversas")
}

model WhatsappMensagem {
  id           String             @id @default(cuid())
  conversaId   String
  conversa     WhatsappConversa   @relation(fields: [conversaId], references: [id], onDelete: Cascade)
  waMessageId  String?            @unique  // ID da mensagem no Meta (inbound)
  direcao      DirecaoMensagem
  tipo         TipoMensagem       @default(TEXT)
  texto        String?
  mediaId      String?            // media_id da Meta (para imagens, docs, áudio)
  mediaNome    String?            // nome original do arquivo
  lida         Boolean            @default(false)
  enviadoPorId String?
  enviadoPor   User?              @relation(fields: [enviadoPorId], references: [id], onDelete: SetNull)
  timestamp    DateTime           // timestamp original da Meta (inbound) ou now() (outbound)
  createdAt    DateTime           @default(now())

  @@map("whatsapp_mensagens")
}
```

## Extensão do modelo Lead

```prisma
// Adicionar ao modelo Lead:
conversa   WhatsappConversa?
```

## Migration SQL

```sql
CREATE TYPE "DirecaoMensagem" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "TipoMensagem"    AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'DOCUMENT', 'UNSUPPORTED');

CREATE TABLE "whatsapp_conversas" (
  "id"                       TEXT NOT NULL,
  "telefone"                 TEXT NOT NULL,
  "leadId"                   TEXT,
  "ultimaMensagemEm"         TIMESTAMP(3),
  "ultimaMensagemRecebidaEm" TIMESTAMP(3),
  "totalNaoLidas"            INTEGER NOT NULL DEFAULT 0,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_conversas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "whatsapp_conversas_telefone_key" UNIQUE ("telefone")
);

CREATE TABLE "whatsapp_mensagens" (
  "id"           TEXT NOT NULL,
  "conversaId"   TEXT NOT NULL,
  "waMessageId"  TEXT,
  "direcao"      "DirecaoMensagem" NOT NULL,
  "tipo"         "TipoMensagem" NOT NULL DEFAULT 'TEXT',
  "texto"        TEXT,
  "mediaId"      TEXT,
  "mediaNome"    TEXT,
  "lida"         BOOLEAN NOT NULL DEFAULT false,
  "enviadoPorId" TEXT,
  "timestamp"    TIMESTAMP(3) NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_mensagens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "whatsapp_mensagens_waMessageId_key" UNIQUE ("waMessageId")
);

ALTER TABLE "whatsapp_conversas"
  ADD CONSTRAINT "whatsapp_conversas_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL;

ALTER TABLE "whatsapp_mensagens"
  ADD CONSTRAINT "whatsapp_mensagens_conversaId_fkey"
  FOREIGN KEY ("conversaId") REFERENCES "whatsapp_conversas"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "whatsapp_mensagens_enviadoPorId_fkey"
  FOREIGN KEY ("enviadoPorId") REFERENCES "users"("id") ON DELETE SET NULL;
```

## Verificação e segurança do webhook

```typescript
// Verificação Meta (GET) — hub.challenge handshake
// Validação HMAC-SHA256 (POST) — X-Hub-Signature-256

import { createHmac } from 'crypto'

export function verificarAssinaturaMeta(
  rawBody: Buffer,
  signature: string | undefined,
  appSecret: string
): boolean {
  if (!signature) return false
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')
  return signature === expected
}
```

## Normalização de telefone E.164

```typescript
export function normalizarTelefone(phone: string): string {
  // Remove tudo exceto dígitos e o +
  let num = phone.replace(/[^\d+]/g, '')
  // Garante que começa com +
  if (!num.startsWith('+')) num = '+' + num
  return num
}
```

## Notificação em tempo real — SSE broadcast

```typescript
// src/lib/sse-hub.ts
// Map de conexões SSE abertas por userId
const conexoes = new Map<string, Set<(data: string) => void>>()

export function registrarConexao(userId: string, send: (data: string) => void) {
  if (!conexoes.has(userId)) conexoes.set(userId, new Set())
  conexoes.get(userId)!.add(send)
}

export function removerConexao(userId: string, send: (data: string) => void) {
  conexoes.get(userId)?.delete(send)
}

export function notificarUsuario(userId: string, evento: object) {
  conexoes.get(userId)?.forEach((send) => send(JSON.stringify(evento)))
}

export function notificarTodos(evento: object) {
  conexoes.forEach((senders) =>
    senders.forEach((send) => send(JSON.stringify(evento)))
  )
}
```

## Janela de 24h

```typescript
export function dentroJanela24h(ultimaMensagemRecebidaEm: Date | null): boolean {
  if (!ultimaMensagemRecebidaEm) return false
  const diff = Date.now() - ultimaMensagemRecebidaEm.getTime()
  return diff < 24 * 60 * 60 * 1000
}
```

## API Endpoints

```
# Webhook Meta (público — sem autenticação JWT)
GET  /webhook/whatsapp     → verificação Meta (hub.challenge)
POST /webhook/whatsapp     → receber mensagem (valida HMAC)

# Conversas (autenticado)
GET  /api/conversas                       → listar conversas
GET  /api/conversas/:leadId               → mensagens da conversa
POST /api/conversas/:leadId/responder     → enviar resposta (texto livre ou template)
PATCH /api/conversas/:leadId/lida        → marcar como lidas
GET  /api/conversas/nao-lidas/contagem   → total não lidas (para badge)
GET  /api/conversas/stream               → SSE de novas mensagens
GET  /api/whatsapp/media/:mediaId        → proxy de download de mídia
```

## Variáveis de ambiente adicionais

```env
WHATSAPP_VERIFY_TOKEN=<token_secreto_definido_no_meta>
WHATSAPP_APP_SECRET=<app_secret_do_app_meta>
```

## Decisões

- **WhatsappConversa separada de Lead:** suporta lead desconhecido (sem leadId) sem quebrar o schema de Lead; vínculo opcional via leadId
- **Unique por telefone:** garante uma conversa por número; upsert seguro
- **waMessageId unique:** idempotência no webhook — Meta pode re-entregar mensagens; `skipDuplicates` no create
- **SSE hub por userId:** sem WebSocket; mesma decisão de infra das SSEs anteriores; `notificarTodos` para supervisão; `notificarUsuario` para vendedor do lead
- **Media como proxy:** não baixa arquivo localmente; frontend chama `/api/whatsapp/media/:id` que faz fetch na API da Meta com o token; evita armazenamento local de mídia binária
- **Janela de 24h no frontend:** calculada a partir de `ultimaMensagemRecebidaEm` retornado pela API; sem lógica no backend para alternar o campo de texto (UI adapta)
- **Buffer do rawBody:** Fastify precisa do body como Buffer para verificar HMAC; configurar `addContentTypeParser` no endpoint do webhook
