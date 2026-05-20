# Sprint 26 — Step 03 — Daniel Mendes (Tech Lead)
# Módulo de Agenda — Arquitetura Técnica

---

## 1. Novas Tabelas — Schema Prisma + SQL

### 1.1 Enum: TipoEvento

```prisma
enum TipoEvento {
  REUNIAO
  LIGACAO
  VISITA
  APRESENTACAO
  FOLLOW_UP
  DEMO
  OUTRO
}
```

### 1.2 Enum: StatusEvento

```prisma
enum StatusEvento {
  AGENDADO
  CONFIRMADO
  REALIZADO
  CANCELADO
  REAGENDADO
  NAO_COMPARECEU
}
```

### 1.3 Enum: TipoLocal

```prisma
enum TipoLocal {
  ONLINE
  PRESENCIAL
}
```

### 1.4 Tabela: GoogleCalendarToken

```prisma
model GoogleCalendarToken {
  id           String   @id @default(cuid())
  userId       String   @unique
  accessToken  String   // AES-256-GCM criptografado
  refreshToken String   // AES-256-GCM criptografado
  expiresAt    DateTime
  calendarId   String   // e.g. "joao@gmail.com"
  googleEmail  String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

```sql
CREATE TABLE "GoogleCalendarToken" (
  "id"           TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "userId"       TEXT        NOT NULL,
  "accessToken"  TEXT        NOT NULL,
  "refreshToken" TEXT        NOT NULL,
  "expiresAt"    TIMESTAMPTZ NOT NULL,
  "calendarId"   TEXT        NOT NULL,
  "googleEmail"  TEXT        NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "GoogleCalendarToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GoogleCalendarToken_userId_key" UNIQUE ("userId"),
  CONSTRAINT "GoogleCalendarToken_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "GoogleCalendarToken_userId_idx" ON "GoogleCalendarToken"("userId");
```

### 1.5 Tabela: AgendaEvento

```prisma
model AgendaEvento {
  id              String      @id @default(cuid())
  titulo          String
  tipo            TipoEvento  @default(REUNIAO)
  status          StatusEvento @default(AGENDADO)
  dataInicio      DateTime
  dataFim         DateTime
  tipoLocal       TipoLocal   @default(ONLINE)
  descricao       String?
  convidados      String[]    // e-mails extras além do lead
  lembreteMinutos Int         @default(30)

  // Vínculo com lead ou cliente
  leadId          String?
  clienteBaseId   String?

  // Criador
  criadoPorId     String

  // Google Calendar
  googleEventId   String?     // ID no Google Calendar (para update/delete)
  hangoutLink     String?     // https://meet.google.com/xxx-yyy-zzz
  htmlLink        String?     // URL do evento no GCal

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  lead        Lead?        @relation(fields: [leadId], references: [id], onDelete: SetNull)
  clienteBase ClienteBase? @relation(fields: [clienteBaseId], references: [id], onDelete: SetNull)
  criadoPor   User         @relation(fields: [criadoPorId], references: [id])

  @@index([criadoPorId])
  @@index([leadId])
  @@index([clienteBaseId])
  @@index([dataInicio])
  @@index([googleEventId])
}
```

```sql
CREATE TYPE "TipoEvento"   AS ENUM ('REUNIAO','LIGACAO','VISITA','APRESENTACAO','FOLLOW_UP','DEMO','OUTRO');
CREATE TYPE "StatusEvento" AS ENUM ('AGENDADO','CONFIRMADO','REALIZADO','CANCELADO','REAGENDADO','NAO_COMPARECEU');
CREATE TYPE "TipoLocal"    AS ENUM ('ONLINE','PRESENCIAL');

CREATE TABLE "AgendaEvento" (
  "id"              TEXT           NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "titulo"          TEXT           NOT NULL,
  "tipo"            "TipoEvento"   NOT NULL DEFAULT 'REUNIAO',
  "status"          "StatusEvento" NOT NULL DEFAULT 'AGENDADO',
  "dataInicio"      TIMESTAMPTZ    NOT NULL,
  "dataFim"         TIMESTAMPTZ    NOT NULL,
  "tipoLocal"       "TipoLocal"    NOT NULL DEFAULT 'ONLINE',
  "descricao"       TEXT,
  "convidados"      TEXT[]         NOT NULL DEFAULT '{}',
  "lembreteMinutos" INTEGER        NOT NULL DEFAULT 30,
  "leadId"          TEXT,
  "clienteBaseId"   TEXT,
  "criadoPorId"     TEXT           NOT NULL,
  "googleEventId"   TEXT,
  "hangoutLink"     TEXT,
  "htmlLink"        TEXT,
  "createdAt"       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT "AgendaEvento_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgendaEvento_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL,
  CONSTRAINT "AgendaEvento_clienteBaseId_fkey"
    FOREIGN KEY ("clienteBaseId") REFERENCES "ClienteBase"("id") ON DELETE SET NULL,
  CONSTRAINT "AgendaEvento_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId") REFERENCES "User"("id")
);

CREATE INDEX "AgendaEvento_criadoPorId_idx"  ON "AgendaEvento"("criadoPorId");
CREATE INDEX "AgendaEvento_leadId_idx"        ON "AgendaEvento"("leadId");
CREATE INDEX "AgendaEvento_clienteBaseId_idx" ON "AgendaEvento"("clienteBaseId");
CREATE INDEX "AgendaEvento_dataInicio_idx"    ON "AgendaEvento"("dataInicio");
CREATE INDEX "AgendaEvento_googleEventId_idx" ON "AgendaEvento"("googleEventId");
```

---

## 2. Criptografia dos Tokens — AES-256-GCM

```typescript
// lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO   = 'aes-256-gcm'
const KEY    = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex') // 32 bytes hex → 64 chars
const IV_LEN = 12 // GCM padrão

export function encrypt(plain: string): string {
  const iv      = randomBytes(IV_LEN)
  const cipher  = createCipheriv(ALGO, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag     = cipher.getAuthTag()
  // formato: iv(12B):tag(16B):ciphertext — tudo em hex
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decrypt(stored: string): string {
  const [ivHex, tagHex, ctHex] = stored.split(':')
  const iv      = Buffer.from(ivHex, 'hex')
  const tag     = Buffer.from(tagHex, 'hex')
  const ct      = Buffer.from(ctHex, 'hex')
  const decipher = createDecipheriv(ALGO, KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ct) + decipher.final('utf8')
}
```

**Variável de ambiente necessária:**
```
TOKEN_ENCRYPTION_KEY=<64 hex chars — gerar com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

---

## 3. Google Calendar API Client

### 3.1 Dependência

```bash
npm install googleapis
```

### 3.2 OAuth2 Client Factory

```typescript
// lib/google-calendar.ts
import { google } from 'googleapis'

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID!
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI! // /agenda/auth/google/callback

export function createOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
}

export function getAuthUrl(oauth2Client: InstanceType<typeof google.auth.OAuth2>) {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
    prompt: 'consent', // forçar refresh_token sempre
  })
}
```

### 3.3 Helper: token com auto-refresh

```typescript
// lib/google-token.ts
import { prisma } from './prisma'
import { decrypt, encrypt } from './crypto'
import { createOAuth2Client } from './google-calendar'

export async function getAuthenticatedClient(userId: string) {
  const record = await prisma.googleCalendarToken.findUnique({ where: { userId } })
  if (!record) throw new Error('GOOGLE_NOT_CONNECTED')

  const oauth2 = createOAuth2Client()
  oauth2.setCredentials({
    access_token:  decrypt(record.accessToken),
    refresh_token: decrypt(record.refreshToken),
    expiry_date:   record.expiresAt.getTime(),
  })

  // auto-refresh se expirado (ou expira em < 5 min)
  if (record.expiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    const { credentials } = await oauth2.refreshAccessToken()
    oauth2.setCredentials(credentials)
    await prisma.googleCalendarToken.update({
      where: { userId },
      data: {
        accessToken: encrypt(credentials.access_token!),
        expiresAt:   new Date(credentials.expiry_date!),
      },
    })
  }

  return oauth2
}
```

---

## 4. Rotas — Visão Geral

### 4.1 Auth / OAuth2

| Método | Rota                              | Roles       | Descrição |
|--------|-----------------------------------|-------------|-----------|
| GET    | /agenda/auth/google               | Todos       | Redireciona para Google OAuth consent |
| GET    | /agenda/auth/google/callback      | —           | Callback OAuth2; troca code por tokens |
| GET    | /agenda/auth/status               | Todos       | { conectado, email, calendarId } |
| DELETE | /agenda/auth/disconnect           | Todos       | Revoga token + remove do banco |

### 4.2 Eventos

| Método | Rota                              | Roles             | Descrição |
|--------|-----------------------------------|-------------------|-----------|
| GET    | /agenda/eventos                   | Todos             | Lista eventos do userId (filtros: inicio, fim, leadId, status, tipo, vendedorId*) |
| POST   | /agenda/eventos                   | VENDEDOR+         | Cria evento + Google Calendar |
| GET    | /agenda/eventos/:id               | Todos             | Detalhe do evento |
| PATCH  | /agenda/eventos/:id               | Criador/SUPV+     | Atualiza evento + Google Calendar |
| DELETE | /agenda/eventos/:id               | Criador/SUPV+     | Cancela evento (status=CANCELADO + Google) |
| GET    | /agenda/eventos/hoje/count        | Todos             | { count } — para badge sidebar |

*`vendedorId` apenas para SUPERVISAO/CEO/ADMIN

---

## 5. Diagrama de Fluxo — Criar Evento

```
POST /agenda/eventos
        │
        ├─ Valida campos obrigatórios (titulo, dataInicio, dataFim, leadId | clienteBaseId)
        │
        ├─ Verifica se userId tem GoogleCalendarToken
        │       ├─ SIM → getAuthenticatedClient(userId) → auto-refresh se necessário
        │       └─ NÃO → continua sem Google (hangoutLink = null)
        │
        ├─ [Com Google] calendar.events.insert({
        │       calendarId: 'primary',
        │       conferenceDataVersion: 1,
        │       requestBody: {
        │         summary, description, start, end,
        │         attendees: [leadEmail, ...convidados],
        │         reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: lembreteMinutos }] },
        │         conferenceData: { createRequest: { requestId: uuid } }
        │       }
        │     })
        │     → googleEventId = event.id
        │     → hangoutLink   = event.hangoutLink
        │     → htmlLink      = event.htmlLink
        │
        ├─ prisma.agendaEvento.create({ ...dados, googleEventId, hangoutLink, htmlLink })
        │
        ├─ [Se leadId] prisma.historicoLead.create({
        │       leadId, tipo: 'reuniao_agendada',
        │       descricao: `📅 ${titulo} · ${dataInicio} · ${hangoutLink ?? 'Presencial'}`
        │     })
        │
        └─ return { evento, googleCreated: boolean }
```

---

## 6. Diagrama de Fluxo — OAuth2 Callback

```
GET /agenda/auth/google/callback?code=...&state=...
        │
        ├─ oauth2.getToken(code)
        │     → { access_token, refresh_token, expiry_date, id_token }
        │
        ├─ Decodifica id_token para pegar email do usuário Google
        │
        ├─ prisma.googleCalendarToken.upsert({
        │     where: { userId },
        │     create/update: {
        │       accessToken:  encrypt(access_token),
        │       refreshToken: encrypt(refresh_token),
        │       expiresAt:    new Date(expiry_date),
        │       googleEmail:  decodedEmail,
        │       calendarId:   decodedEmail,  // calendar primário = e-mail
        │     }
        │   })
        │
        └─ redirect('/configuracoes?google=conectado')
```

---

## 7. Estratégia de Cache

| Endpoint | Cache Key | TTL |
|----------|-----------|-----|
| GET /agenda/eventos | `agenda:eventos:${userId}:${inicio}:${fim}:${leadId??''}` | 2 min |
| GET /agenda/eventos/hoje/count | `agenda:badge:${userId}:${date}` | 5 min |
| GET /agenda/auth/status | sem cache (leitura rápida do banco) | — |

Cache invalidado ao criar/editar/cancelar evento (`agenda:eventos:${userId}:*` pattern delete).

---

## 8. Variáveis de Ambiente Novas

```env
GOOGLE_CLIENT_ID=<Google OAuth2 Client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth2 Client Secret>
GOOGLE_REDIRECT_URI=https://crm.prosystem.com.br/agenda/auth/google/callback
TOKEN_ENCRYPTION_KEY=<64 hex chars>
```

---

## 9. Relacionamentos no Prisma existente (alterações)

```prisma
// Lead — adicionar relação
model Lead {
  // ... campos existentes ...
  agendaEventos AgendaEvento[]
}

// User — adicionar relação
model User {
  // ... campos existentes ...
  googleCalendarToken GoogleCalendarToken?
  agendaEventosCriados AgendaEvento[]      @relation("EventosCriados")
}

// ClienteBase — adicionar relação
model ClienteBase {
  // ... campos existentes ...
  agendaEventos AgendaEvento[]
}
```

---

## Sprint 26 — STEP 03 PRONTO ✅
