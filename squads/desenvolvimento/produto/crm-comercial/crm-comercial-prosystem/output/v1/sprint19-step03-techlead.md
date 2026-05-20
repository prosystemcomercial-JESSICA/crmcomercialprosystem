# Sprint 19 — Step 03 — Daniel Mendes (Tech Lead)
# Integrações — Arquitetura

## Modelos Prisma

```prisma
model ConfigIntegracao {
  id        String   @id @default(cuid())
  chave     String   @unique  // 'WHATSAPP_PHONE_ID' | 'WHATSAPP_TOKEN' | 'WHATSAPP_TEMPLATE' | 'SMTP_HOST' | etc.
  valor     String   @db.Text // criptografado para campos sensíveis
  sensivel  Boolean  @default(false)
  updatedAt DateTime @updatedAt

  @@map("config_integracoes")
}

model LogMensagem {
  id           String   @id @default(cuid())
  canal        String   // 'WHATSAPP' | 'EMAIL'
  destinatario String   // phone ou email
  template     String?  // nome do template WA ou assunto do e-mail
  status       String   @default("PENDENTE") // 'ENVIADO' | 'FALHA' | 'PENDENTE'
  erro         String?
  leadId       String?
  lead         Lead?    @relation(fields: [leadId], references: [id], onDelete: SetNull)
  campanhaId   String?
  campanha     Campanha? @relation(fields: [campanhaId], references: [id], onDelete: SetNull)
  enviadoPorId String?
  enviadoPor   User?    @relation(fields: [enviadoPorId], references: [id], onDelete: SetNull)
  createdAt    DateTime @default(now())

  @@map("log_mensagens")
}

model RegistroLigacao {
  id           String   @id @default(cuid())
  leadId       String
  lead         Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  dataHora     DateTime
  duracaoMin   Int?
  resultado    String   // 'conectou_agendou' | 'conectou_sem_interesse' | 'nao_atendeu' | 'caixa_postal'
  notas        String?
  registradoPorId String
  registradoPor   User  @relation(fields: [registradoPorId], references: [id])
  createdAt    DateTime @default(now())

  @@map("registro_ligacoes")
}
```

## Extensão dos modelos existentes

```prisma
// Adicionar ao enum CanalCampanha:
enum CanalCampanha {
  EMAIL
  WHATSAPP  // novo
}

// Adicionar a CampanhaDestinatario:
model CampanhaDestinatario {
  // ... campos existentes ...
  whatsappPhone String?  // capturado do lead.telefone no snapshot
}
```

## Migration SQL

```sql
-- ConfigIntegracao
CREATE TABLE "config_integracoes" (
  "id"        TEXT NOT NULL,
  "chave"     TEXT NOT NULL,
  "valor"     TEXT NOT NULL,
  "sensivel"  BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "config_integracoes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "config_integracoes_chave_key" UNIQUE ("chave")
);

-- LogMensagem
CREATE TABLE "log_mensagens" (
  "id"           TEXT NOT NULL,
  "canal"        TEXT NOT NULL,
  "destinatario" TEXT NOT NULL,
  "template"     TEXT,
  "status"       TEXT NOT NULL DEFAULT 'PENDENTE',
  "erro"         TEXT,
  "leadId"       TEXT,
  "campanhaId"   TEXT,
  "enviadoPorId" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "log_mensagens_pkey" PRIMARY KEY ("id")
);

-- RegistroLigacao
CREATE TABLE "registro_ligacoes" (
  "id"              TEXT NOT NULL,
  "leadId"          TEXT NOT NULL,
  "dataHora"        TIMESTAMP(3) NOT NULL,
  "duracaoMin"      INTEGER,
  "resultado"       TEXT NOT NULL,
  "notas"           TEXT,
  "registradoPorId" TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "registro_ligacoes_pkey" PRIMARY KEY ("id")
);

-- FKs
ALTER TABLE "log_mensagens"
  ADD CONSTRAINT "log_mensagens_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "log_mensagens_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "campanhas"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "log_mensagens_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "registro_ligacoes"
  ADD CONSTRAINT "registro_ligacoes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "registro_ligacoes_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "users"("id") ON DELETE RESTRICT;

-- Adicionar coluna whatsappPhone a campanha_destinatarios
ALTER TABLE "campanha_destinatarios" ADD COLUMN "whatsappPhone" TEXT;

-- Adicionar valor WHATSAPP ao enum
ALTER TYPE "CanalCampanha" ADD VALUE 'WHATSAPP';
```

## WhatsApp Business Cloud API

```typescript
// src/lib/whatsapp.ts
interface WhatsAppConfig {
  phoneNumberId: string
  accessToken: string
  templateName: string
}

interface TemplateParam {
  type: 'text'
  text: string
}

export async function enviarWhatsApp(opts: {
  config: WhatsAppConfig
  para: string          // E.164: +5511999990000
  params: TemplateParam[] // variáveis do template na ordem definida no Meta
}): Promise<{ messageId: string }> {
  const url = `https://graph.facebook.com/v19.0/${opts.config.phoneNumberId}/messages`

  const payload = {
    messaging_product: 'whatsapp',
    to: opts.para,
    type: 'template',
    template: {
      name: opts.config.templateName,
      language: { code: 'pt_BR' },
      components: [
        {
          type: 'body',
          parameters: opts.params,
        },
      ],
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const erro = await res.json()
    throw new Error(erro?.error?.message ?? `WhatsApp API error ${res.status}`)
  }

  const data = await res.json()
  return { messageId: data.messages?.[0]?.id ?? '' }
}
```

## Criptografia de campos sensíveis

```typescript
// src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const KEY = Buffer.from(process.env.ENCRYPTION_KEY ?? '', 'hex') // 32 bytes hex
const ALGO = 'aes-256-cbc'

export function encrypt(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGO, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decrypt(text: string): string {
  const [ivHex, encHex] = text.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const enc = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv(ALGO, KEY, iv)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString()
}
```

```env
# Adicionar ao .env:
ENCRYPTION_KEY=<64 hex chars gerados com: openssl rand -hex 32>
```

## Carregamento de config (com fallback para env vars)

```typescript
// src/lib/config.ts
import { PrismaClient } from '@prisma/client'
import { decrypt } from './crypto'

export async function getConfig(chave: string, prisma: PrismaClient): Promise<string | null> {
  const cfg = await prisma.configIntegracao.findUnique({ where: { chave } })
  if (!cfg) return null
  return cfg.sensivel ? decrypt(cfg.valor) : cfg.valor
}

export async function getSmtpConfig(prisma: PrismaClient) {
  const [host, port, secure, user, pass, from] = await Promise.all([
    getConfig('SMTP_HOST', prisma),
    getConfig('SMTP_PORT', prisma),
    getConfig('SMTP_SECURE', prisma),
    getConfig('SMTP_USER', prisma),
    getConfig('SMTP_PASS', prisma),
    getConfig('SMTP_FROM', prisma),
  ])
  return {
    host:   host   ?? process.env.SMTP_HOST   ?? 'localhost',
    port:   Number(port ?? process.env.SMTP_PORT ?? 587),
    secure: (secure ?? process.env.SMTP_SECURE) === 'true',
    user:   user   ?? process.env.SMTP_USER,
    pass:   pass   ?? process.env.SMTP_PASS,
    from:   from   ?? process.env.SMTP_FROM   ?? 'CRM ProSystem <noreply@prosystem.com.br>',
  }
}

export async function getWhatsAppConfig(prisma: PrismaClient) {
  const [phoneNumberId, accessToken, templateName] = await Promise.all([
    getConfig('WHATSAPP_PHONE_ID', prisma),
    getConfig('WHATSAPP_TOKEN', prisma),
    getConfig('WHATSAPP_TEMPLATE', prisma),
  ])
  if (!phoneNumberId || !accessToken) return null
  return { phoneNumberId, accessToken, templateName: templateName ?? 'saudacao_vendedor' }
}
```

## API Endpoints

```
# Configurações
GET    /api/config/integracoes              → listar config (valores sensíveis mascarados)
PUT    /api/config/integracoes              → salvar/atualizar config
POST   /api/config/integracoes/testar/:canal → testar conexão (whatsapp | smtp)

# WhatsApp
POST   /api/leads/:leadId/whatsapp          → enviar mensagem individual

# Ligações
POST   /api/leads/:leadId/ligacoes          → registrar ligação
GET    /api/leads/:leadId/ligacoes          → listar ligações do lead

# Log
GET    /api/log-mensagens                   → log de mensagens (SUPERVISAO+)
```

## Decisões

- **ConfigIntegracao no banco (não só env):** permite reconfigurar via UI sem redeploy; env vars como fallback para retro-compatibilidade com Sprint 18
- **AES-256-CBC para campos sensíveis:** padrão sólido para dados em repouso; chave em env var (ENCRYPTION_KEY); IV aleatório por valor (nunca reutilizado)
- **WhatsApp Cloud API (não Business API on-premise):** sem servidor próprio; hosted pelo Meta; credenciais = phone_number_id + permanent token
- **Templates pré-aprovados:** única opção segura e confiável; texto livre só dentro de janela de 24h (fora de escopo)
- **RegistroLigacao como tabela separada:** dados mais ricos (duração, resultado) que um simples HistoricoLead; ambos são registrados (HistoricoLead para timeline unificada)
- **LogMensagem:** auditoria completa separada de HistoricoLead; inclui campanhas e envios individuais; não poluí a timeline do lead
- **WhatsApp em Campanhas:** mesmo padrão do e-mail; `whatsappPhone` capturado no snapshot; SEM_CANAL se lead não tem telefone
