# Sprint 32 — Step 03 — Daniel Mendes (Tech Lead)
# Portal do Cliente — Arquitetura

## Schema (2 tabelas novas)

```prisma
model PortalCliente {
  id              String         @id @default(cuid())
  leadId          String         @unique
  lead            Lead           @relation(fields: [leadId], references: [id], onDelete: Cascade)
  email           String         @unique
  senhaHash       String
  ativo           Boolean        @default(true)
  primeiroAcesso  Boolean        @default(true)
  bloqueadoAte    DateTime?
  tentativasFalha Int            @default(0)
  criadoEm        DateTime       @default(now())
  atualizadoEm    DateTime       @updatedAt
  acessos         PortalAcesso[]
}

model PortalAcesso {
  id              String         @id @default(cuid())
  portalClienteId String
  portalCliente   PortalCliente  @relation(fields: [portalClienteId], references: [id], onDelete: Cascade)
  rota            String
  ip              String?
  createdAt       DateTime       @default(now())

  @@index([portalClienteId, createdAt])
}
```

## Migration SQL

```sql
CREATE TABLE "PortalCliente" (
  "id"             TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "leadId"         TEXT NOT NULL UNIQUE,
  "email"          TEXT NOT NULL UNIQUE,
  "senhaHash"      TEXT NOT NULL,
  "ativo"          BOOLEAN NOT NULL DEFAULT true,
  "primeiroAcesso" BOOLEAN NOT NULL DEFAULT true,
  "bloqueadoAte"   TIMESTAMP,
  "tentativasFalha" INT NOT NULL DEFAULT 0,
  "criadoEm"       TIMESTAMP NOT NULL DEFAULT NOW(),
  "atualizadoEm"   TIMESTAMP NOT NULL,
  CONSTRAINT "PortalCliente_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE
);

CREATE TABLE "PortalAcesso" (
  "id"              TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "portalClienteId" TEXT NOT NULL,
  "rota"            TEXT NOT NULL,
  "ip"              TEXT,
  "createdAt"       TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "PortalAcesso_portalClienteId_fkey"
    FOREIGN KEY ("portalClienteId") REFERENCES "PortalCliente"("id") ON DELETE CASCADE
);
CREATE INDEX "PortalAcesso_clienteId_idx" ON "PortalAcesso"("portalClienteId", "createdAt" DESC);
```

## Endpoints Backend

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/portal-clientes/convidar` | CRM JWT | Gerar/resetar acesso para leadId |
| GET | `/api/portal-clientes/:id/acessos` | CRM JWT | Log últimos 30 acessos |
| POST | `/portal/api/auth/login` | público | Login do cliente no portal |
| POST | `/portal/api/auth/alterar-senha` | Portal JWT | Alterar senha |
| GET | `/portal/api/dashboard` | Portal JWT | Cards do dashboard |
| GET | `/portal/api/propostas` | Portal JWT | Lista propostas |
| GET | `/portal/api/propostas/:id` | Portal JWT | Detalhe proposta |
| PATCH | `/portal/api/propostas/:id/aprovar` | Portal JWT | Aprovar proposta |
| PATCH | `/portal/api/propostas/:id/recusar` | Portal JWT | Recusar proposta |
| GET | `/portal/api/contratos` | Portal JWT | Lista contratos |
| GET | `/portal/api/contratos/:id` | Portal JWT | Detalhe contrato |
| GET | `/portal/api/servicos` | Portal JWT | Serviços contratados |
| GET | `/portal/api/historico` | Portal JWT | Timeline filtrada |

## Decisões

1. **JWT portal separado:** secret `PORTAL_JWT_SECRET` (64 hex chars); expira em 4h; não mistura com auth do CRM
2. **Rotas portal:** prefixo `/portal/api/` registradas com middleware de autenticação próprio (`portalAuthenticate`)
3. **Bloqueio:** após 5 falhas de login → `bloqueadoAte = now() + 15min`; verificar no middleware
4. **Senha temporária:** 8 chars alfanumérica (`crypto.randomBytes(5).toString('base64url').slice(0,8)`)
5. **E-mail de convite:** reutiliza nodemailer do Sprint 19; template HTML inline
6. **Log de acesso:** middleware `portalAccessLog` — registra rota + IP a cada request autenticado
7. **Histórico filtrado:** apenas tipos `mensagem_respondida`, `proposta_enviada`, `proposta_aprovada_portal`, `contrato_criado` — WHERE clause no historicoLead

## Variáveis novas

```env
PORTAL_JWT_SECRET=<64 hex chars>  # obrigatório — validar no startup
PORTAL_URL=https://crm.prosystem.com.br  # base URL para links no e-mail
```
