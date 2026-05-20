# Sprint 18 — Step 03 — Daniel Mendes (Tech Lead)
# Campanhas — Arquitetura

## Modelos Prisma

```prisma
enum CanalCampanha {
  EMAIL
}

enum StatusCampanha {
  RASCUNHO
  AGENDADA
  ENVIANDO
  CONCLUIDA
  CANCELADA
}

enum StatusDestinatario {
  PENDENTE
  ENVIADO
  FALHA
  SEM_CANAL
}

model Campanha {
  id                  String          @id @default(cuid())
  nome                String
  descricao           String?
  canal               CanalCampanha   @default(EMAIL)
  assunto             String
  corpo               String          @db.Text
  status              StatusCampanha  @default(RASCUNHO)
  agendadaPara        DateTime?
  filtroEtapas        String[]        @default([])
  filtroStatus        String[]        @default([])
  filtroVendedores    String[]        @default([])
  totalDestinatarios  Int             @default(0)
  totalEnviados       Int             @default(0)
  totalFalhas         Int             @default(0)
  iniciadaEm          DateTime?
  concluidaEm         DateTime?
  criadoPorId         String
  criadoPor           User            @relation(fields: [criadoPorId], references: [id])
  destinatarios       CampanhaDestinatario[]
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  @@map("campanhas")
}

model CampanhaDestinatario {
  id           String              @id @default(cuid())
  campanhaId   String
  campanha     Campanha            @relation(fields: [campanhaId], references: [id], onDelete: Cascade)
  leadId       String
  lead         Lead                @relation(fields: [leadId], references: [id], onDelete: Cascade)
  email        String?
  status       StatusDestinatario  @default(PENDENTE)
  erro         String?
  enviadoEm    DateTime?
  createdAt    DateTime            @default(now())

  @@unique([campanhaId, leadId])
  @@map("campanha_destinatarios")
}
```

## Migration SQL

```sql
CREATE TYPE "CanalCampanha" AS ENUM ('EMAIL');
CREATE TYPE "StatusCampanha" AS ENUM ('RASCUNHO','AGENDADA','ENVIANDO','CONCLUIDA','CANCELADA');
CREATE TYPE "StatusDestinatario" AS ENUM ('PENDENTE','ENVIADO','FALHA','SEM_CANAL');

CREATE TABLE "campanhas" (
  "id"                 TEXT NOT NULL,
  "nome"               TEXT NOT NULL,
  "descricao"          TEXT,
  "canal"              "CanalCampanha" NOT NULL DEFAULT 'EMAIL',
  "assunto"            TEXT NOT NULL,
  "corpo"              TEXT NOT NULL,
  "status"             "StatusCampanha" NOT NULL DEFAULT 'RASCUNHO',
  "agendadaPara"       TIMESTAMP(3),
  "filtroEtapas"       TEXT[] DEFAULT ARRAY[]::TEXT[],
  "filtroStatus"       TEXT[] DEFAULT ARRAY[]::TEXT[],
  "filtroVendedores"   TEXT[] DEFAULT ARRAY[]::TEXT[],
  "totalDestinatarios" INTEGER NOT NULL DEFAULT 0,
  "totalEnviados"      INTEGER NOT NULL DEFAULT 0,
  "totalFalhas"        INTEGER NOT NULL DEFAULT 0,
  "iniciadaEm"         TIMESTAMP(3),
  "concluidaEm"        TIMESTAMP(3),
  "criadoPorId"        TEXT NOT NULL,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "campanhas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "campanha_destinatarios" (
  "id"          TEXT NOT NULL,
  "campanhaId"  TEXT NOT NULL,
  "leadId"      TEXT NOT NULL,
  "email"       TEXT,
  "status"      "StatusDestinatario" NOT NULL DEFAULT 'PENDENTE',
  "erro"        TEXT,
  "enviadoEm"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campanha_destinatarios_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campanha_destinatarios_campanhaId_leadId_key" UNIQUE ("campanhaId", "leadId")
);

ALTER TABLE "campanhas"
  ADD CONSTRAINT "campanhas_criadoPorId_fkey"
  FOREIGN KEY ("criadoPorId") REFERENCES "users"("id") ON DELETE RESTRICT;

ALTER TABLE "campanha_destinatarios"
  ADD CONSTRAINT "campanha_destinatarios_campanhaId_fkey"
  FOREIGN KEY ("campanhaId") REFERENCES "campanhas"("id") ON DELETE CASCADE;

ALTER TABLE "campanha_destinatarios"
  ADD CONSTRAINT "campanha_destinatarios_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE;
```

## Estratégia de envio (in-process async)

Mesmo padrão do Sprint 12 (importação): sem Bull/Redis, usando `setImmediate` entre lotes.

```typescript
async function dispararCampanha(campanhaId: string, prisma: PrismaClient) {
  const destinatarios = await prisma.campanha_destinatario.findMany({
    where: { campanhaId, status: 'PENDENTE', email: { not: null } },
    include: { lead: { select: { nome: true, empresa: true, vendedor: { select: { nome: true } } } } },
  })

  for (const dest of destinatarios) {
    setImmediate(async () => {
      try {
        await enviarEmail({ para: dest.email!, assunto, corpo: substituirVariaveis(corpo, dest) })
        await prisma.$transaction([
          prisma.campanha_destinatario.update({ where: { id: dest.id }, data: { status: 'ENVIADO', enviadoEm: new Date() } }),
          prisma.campanha.update({ where: { id: campanhaId }, data: { totalEnviados: { increment: 1 } } }),
        ])
      } catch (err) {
        await prisma.$transaction([
          prisma.campanha_destinatario.update({ where: { id: dest.id }, data: { status: 'FALHA', erro: String(err) } }),
          prisma.campanha.update({ where: { id: campanhaId }, data: { totalFalhas: { increment: 1 } } }),
        ])
      }
    })
  }
}
```

## Substituição de variáveis

```typescript
export function substituirVariaveis(
  template: string,
  dados: { nome?: string; empresa?: string; vendedor?: string }
): string {
  return template
    .replace(/\{nome\}/g, dados.nome ?? '')
    .replace(/\{empresa\}/g, dados.empresa ?? '')
    .replace(/\{vendedor\}/g, dados.vendedor ?? '')
}
```

## Envio de e-mail — nodemailer

```typescript
// src/lib/mailer.ts
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function enviarEmail(opts: { para: string; assunto: string; corpo: string }) {
  await transporter.sendMail({
    from:    process.env.SMTP_FROM ?? 'CRM ProSystem <noreply@prosystem.com.br>',
    to:      opts.para,
    subject: opts.assunto,
    html:    opts.corpo,
  })
}
```

## Variáveis de ambiente adicionais

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=crm@prosystem.com.br
SMTP_PASS=senha_aqui
SMTP_FROM="CRM ProSystem <crm@prosystem.com.br>"
```

## Cron job — campanhas agendadas

```typescript
// Adicionar ao job existente (a cada hora):
async function verificarCampanhasAgendadas(prisma: PrismaClient) {
  const agora = new Date()
  const campanhas = await prisma.campanha.findMany({
    where: { status: 'AGENDADA', agendadaPara: { lte: agora } },
  })
  for (const c of campanhas) {
    await iniciarDisparo(c.id, prisma)
  }
}
```

## API Endpoints

```
POST   /api/campanhas                        → criar campanha
GET    /api/campanhas                        → listar campanhas
GET    /api/campanhas/preview                → preview destinatários por filtro (query params)
GET    /api/campanhas/:id                    → detalhe + métricas
PATCH  /api/campanhas/:id                   → editar (apenas rascunho)
POST   /api/campanhas/:id/disparar          → iniciar envio (ou agendar)
POST   /api/campanhas/:id/cancelar          → cancelar agendada ou interromper enviando
GET    /api/campanhas/:id/destinatarios     → listar destinatários com status
GET    /api/campanhas/:id/progresso         → SSE de progresso em tempo real
```

## Decisões

- **Array columns no Prisma (filtroEtapas etc.):** PostgreSQL suporta nativamente; evita tabela de relacionamento para filtros
- **Snapshot de destinatários ao disparar (não ao criar):** garante que novos leads criados entre criação e disparo sejam incluídos
- **SEM_CANAL gravado na tabela:** leads sem e-mail entram no snapshot mas com status SEM_CANAL, sem tentativa de envio
- **Envio em lotes com setImmediate:** mesma decisão do Sprint 12; sem dependência de Bull/Redis
- **nodemailer:** biblioteca madura, sem dependência de serviço externo; SMTP configurável por env; Sprint 19 adiciona adaptadores (WhatsApp, etc.)
- **SSE de progresso:** reutiliza o padrão do Sprint 12; polling a cada 2s como fallback no frontend
- **Cancelamento de enviando:** atualiza status para CANCELADA; leads pendentes permanecem como PENDENTE (não mudam para NENHUM status especial) — permite identificar o ponto de interrupção
