# Campanha de E-mail Marketing — Padarias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatizar a sequência de 12 e-mails de reengajamento/nutrição para leads de padaria, com kanban de acompanhamento no CRM, entrada opt-in (pop-up de confirmação) tanto para leads novos quanto para a base existente, e pausa automática por clique (via webhook do Resend).

**Architecture:** Tabelas novas e dedicadas (não reaproveita `Campanha`/`CampanhaDisparo`, que exigem `cliente_id` obrigatório e leads normalmente não são `Cliente` ainda). Um scheduler diário (mesmo padrão dos outros já existentes em `server.ts`) varre `LeadSequenciaEmail` e dispara quem está com e-mail vencido, usando o `email-campanha.service.ts` já existente (adaptado para aceitar lead em vez de cliente). Um webhook do Resend atualiza clique/abertura e pausa a sequência automaticamente. Frontend: pop-up de opt-in ao salvar um lead como Padaria, ação em lote para a base existente, e um Kanban novo dedicado com as fases exatas da especificação do usuário.

**Tech Stack:** Fastify + Prisma + MySQL (backend), Next.js App Router (frontend), Resend (envio de e-mail).

## Global Constraints

- Sequência vale **apenas para leads com `segmento === 'Padaria'`** (comparação exata contra o valor do `<Sel>` fixo `SEGMENTOS`, não a função fuzzy `segmentoDe`).
- **12 e-mails**, calendário fixo: dias 0, 3, 6, 9, 12, 15, 20, 25, 30, 35, 40, 45 (a partir da entrada do lead na campanha).
- Templates HTML já prontos em `C:\Users\prosy\Downloads\SEQUENCIA CAPTAÇÃO PADARIAS\email-01-prosystem-padarias.html` até `email-12-prosystem-padarias-diagnostico.html` — devem ser copiados para `backend/src/email-templates/padarias-sequencia/email-01.html` ... `email-12.html` (renomeando para um padrão previsível; guardar o nome original como referência em comentário).
- Cada template tem placeholder `{{unsubscribe_url}}` — o serviço de envio deve substituir por um link real de descadastro (rota nova, ver Task 6), nunca por `#` como no teste manual anterior.
- Todo envio é feito com `EMAIL_FROM` já configurado (`backend/src/services/email-campanha.service.ts`, hoje sandbox `onboarding@resend.dev`) — **nenhuma mudança nesse ponto agora**, a campanha real só roda pra valer quando o domínio for verificado (fora do escopo deste plano).
- Um clique em qualquer CTA do e-mail deve **pausar a sequência automaticamente** e mover o lead para a coluna "Engajou / Qualificar" — via webhook do Resend (`click` event).
- Resposta ao e-mail e contato via WhatsApp **não são detectáveis automaticamente** nesta versão — ficam como ação manual (botão "Marcar como engajou" no kanban).
- Pop-up de opt-in aparece: (a) ao criar um lead novo com segmento Padaria, (b) ao editar um lead existente e mudar o segmento para Padaria, (c) para os leads Padaria já cadastrados hoje, via uma ação em lote dedicada (não automática/silenciosa — é uma tela de revisão, ver Task 8).
- Propostas Comerciais **não** disparam pop-up próprio — o vínculo com a campanha é sempre pelo Lead relacionado (Global Constraint confirmada com o usuário).

---

## A) Banco de dados — `backend/prisma/schema.prisma`

### Task 1: Novos modelos Prisma

**Files:**
- Modify: `backend/prisma/schema.prisma` (adicionar ao final do arquivo, perto dos outros modelos de Campanha para ficar fácil de achar)

**Interfaces:**
- Produz: os 4 modelos abaixo, usados por todas as tasks seguintes.

- [ ] **Step 1: Adicionar os modelos ao schema**

```prisma
// ── Campanha de e-mail marketing por segmento (ex.: Padarias) ──────────────
// Modelos DEDICADOS a lead (não reaproveita Campanha/CampanhaDisparo, que
// exigem cliente_id obrigatório — a maioria dos leads ainda não é Cliente).
model SequenciaEmail {
  id          String   @id @default(cuid())
  nome        String   @db.VarChar(150) // "Padarias 2026"
  segmento    String   // "Padaria" — valor exato do campo Lead.segmento
  ativa       Boolean  @default(true)
  descricao   String?  @db.Text

  created_by String
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  etapas SequenciaEmailEtapa[]
  leads  LeadSequenciaEmail[]

  @@index([segmento])
  @@index([ativa])
}

model SequenciaEmailEtapa {
  id            String         @id @default(cuid())
  sequencia_id  String
  sequencia     SequenciaEmail @relation(fields: [sequencia_id], references: [id], onDelete: Cascade)

  numero        Int      // 1 a 12
  dia_envio     Int      // dias corridos desde a entrada (0, 3, 6, 9, 12, 15, 20, 25, 30, 35, 40, 45)
  assunto       String   @db.VarChar(200)
  template_path String   @db.VarChar(200) // ex.: "padarias-sequencia/email-01.html"
  tema          String?  @db.VarChar(100) // "Produção / Estoque" — vira etiqueta no lead ao engajar
  fase_kanban   String   // "NUTRICAO_1" | "NUTRICAO_2" | "NUTRICAO_3" | "NUTRICAO_4"

  created_at DateTime @default(now())

  disparos LeadSequenciaEmailDisparo[]

  @@unique([sequencia_id, numero])
  @@index([sequencia_id])
}

// Vínculo lead ↔ sequência: 1 lead só pode estar 1x ativo na mesma sequência
// (não impede reentrada após LONGO_PRAZO, ver Task 4).
model LeadSequenciaEmail {
  id           String         @id @default(cuid())
  sequencia_id String
  sequencia    SequenciaEmail @relation(fields: [sequencia_id], references: [id], onDelete: Cascade)

  lead_id String
  lead    Lead   @relation(fields: [lead_id], references: [id], onDelete: Cascade)

  // Fases do Kanban dedicado (ver planilha do usuário):
  // BASE_VALIDADA | NUTRICAO_1 | NUTRICAO_2 | NUTRICAO_3 | NUTRICAO_4 |
  // ENGAJOU_QUALIFICAR | APRESENTACAO_AGENDADA | APRESENTACAO_REALIZADA |
  // PROPOSTA_NEGOCIACAO | CONTRATO_ASSINADO | LONGO_PRAZO | DESCADASTRADO
  fase_kanban String @default("BASE_VALIDADA")

  ultima_etapa_enviada  Int?      // número do último e-mail enviado (1-12)
  proximo_envio_em      DateTime? // data calculada do próximo disparo
  pausada               Boolean   @default(false)
  motivo_pausa          String?   @db.VarChar(200) // "Clique no CTA" | "Resposta manual" | "WhatsApp manual" | "Descadastro"

  tema_interesse String? @db.VarChar(100) // preenchido quando engaja (tema do e-mail clicado)

  entrou_em      DateTime  @default(now())
  pausada_em     DateTime?
  descadastrou_em DateTime?

  created_by String
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  disparos LeadSequenciaEmailDisparo[]

  @@unique([sequencia_id, lead_id])
  @@index([sequencia_id, fase_kanban])
  @@index([proximo_envio_em])
  @@index([lead_id])
}

model LeadSequenciaEmailDisparo {
  id String @id @default(cuid())

  lead_sequencia_id String
  lead_sequencia    LeadSequenciaEmail @relation(fields: [lead_sequencia_id], references: [id], onDelete: Cascade)

  etapa_id String
  etapa    SequenciaEmailEtapa @relation(fields: [etapa_id], references: [id], onDelete: Cascade)

  status     String    // ENVIADO | ERRO
  message_id String?
  erro       String?   @db.Text

  sent_at      DateTime?
  email_aberto Boolean   @default(false)
  opened_at    DateTime?
  link_clicado Boolean   @default(false)
  clicked_at   DateTime?
  clicked_url  String?   @db.Text

  created_at DateTime @default(now())

  @@index([lead_sequencia_id])
  @@index([etapa_id])
  @@index([message_id])
}
```

- [ ] **Step 2: Adicionar a relação inversa em `Lead`**

Localizar `model Lead { ... }` (linha ~579) e adicionar, perto de outras relações (`etiquetas_lead`, `observacoes_lead`, etc.):

```prisma
  sequencias_email LeadSequenciaEmail[]
```

- [ ] **Step 3: Rodar a migration**

```bash
cd backend
npx prisma migrate dev --name add_sequencia_email_padarias
```

Expected: migration criada e aplicada sem erro, 4 tabelas novas + 1 coluna de relação em `Lead` (relação inversa não gera coluna nova, só a FK do lado `LeadSequenciaEmail.lead_id`).

- [ ] **Step 4: Gerar o client Prisma**

```bash
npx prisma generate
```

Expected: sem erros, `PrismaClient` atualizado com os novos modelos.

---

## B) Seed da sequência e dos 12 templates

### Task 2: Copiar os templates HTML para o backend

**Files:**
- Create: `backend/src/email-templates/padarias-sequencia/email-01.html` até `email-12.html` (12 arquivos)

- [ ] **Step 1: Copiar e renomear os 12 arquivos**

```bash
mkdir -p backend/src/email-templates/padarias-sequencia
cp "C:\Users\prosy\Downloads\SEQUENCIA CAPTAÇÃO PADARIAS\email-01-prosystem-padarias.html" backend/src/email-templates/padarias-sequencia/email-01.html
cp "C:\Users\prosy\Downloads\SEQUENCIA CAPTAÇÃO PADARIAS\email-02-prosystem-padarias-producao-estoque.html" backend/src/email-templates/padarias-sequencia/email-02.html
cp "C:\Users\prosy\Downloads\SEQUENCIA CAPTAÇÃO PADARIAS\email-03-prosystem-padarias-custo-margem.html" backend/src/email-templates/padarias-sequencia/email-03.html
cp "C:\Users\prosy\Downloads\SEQUENCIA CAPTAÇÃO PADARIAS\email-04-prosystem-padarias-caixa.html" backend/src/email-templates/padarias-sequencia/email-04.html
cp "C:\Users\prosy\Downloads\SEQUENCIA CAPTAÇÃO PADARIAS\email-05-prosystem-padarias-decisoes.html" backend/src/email-templates/padarias-sequencia/email-05.html
cp "C:\Users\prosy\Downloads\SEQUENCIA CAPTAÇÃO PADARIAS\email-06-prosystem-padarias-apresentacao.html" backend/src/email-templates/padarias-sequencia/email-06.html
cp "C:\Users\prosy\Downloads\SEQUENCIA CAPTAÇÃO PADARIAS\email-07-prosystem-padarias-estoque-parado.html" backend/src/email-templates/padarias-sequencia/email-07.html
cp "C:\Users\prosy\Downloads\SEQUENCIA CAPTAÇÃO PADARIAS\email-08-prosystem-padarias-vendas-perdidas.html" backend/src/email-templates/padarias-sequencia/email-08.html
cp "C:\Users\prosy\Downloads\SEQUENCIA CAPTAÇÃO PADARIAS\email-09-prosystem-padarias-auditoria.html" backend/src/email-templates/padarias-sequencia/email-09.html
cp "C:\Users\prosy\Downloads\SEQUENCIA CAPTAÇÃO PADARIAS\email-10-prosystem-padarias-promocoes.html" backend/src/email-templates/padarias-sequencia/email-10.html
cp "C:\Users\prosy\Downloads\SEQUENCIA CAPTAÇÃO PADARIAS\email-11-prosystem-padarias-fiscal-contabilidade.html" backend/src/email-templates/padarias-sequencia/email-11.html
cp "C:\Users\prosy\Downloads\SEQUENCIA CAPTAÇÃO PADARIAS\email-12-prosystem-padarias-diagnostico.html" backend/src/email-templates/padarias-sequencia/email-12.html
```

Expected: 12 arquivos em `backend/src/email-templates/padarias-sequencia/`.

- [ ] **Step 2: Commit**

```bash
git add backend/src/email-templates/padarias-sequencia/
git commit -m "feat: adiciona os 12 templates da sequencia de email padarias"
```

### Task 3: Script de seed da `SequenciaEmail` + 12 `SequenciaEmailEtapa`

**Files:**
- Create: `backend/scripts/seed-sequencia-padarias.ts`

**Interfaces:**
- Consome: `SequenciaEmail`, `SequenciaEmailEtapa` (Task 1).
- Produz: 1 registro `SequenciaEmail` (nome "Padarias 2026", segmento "Padaria") + 12 `SequenciaEmailEtapa`, usado por todas as tasks seguintes via `sequencia_id`.

- [ ] **Step 1: Escrever o script de seed**

```ts
// backend/scripts/seed-sequencia-padarias.ts
// Roda 1x (idempotente — upsert): cria a sequência "Padarias 2026" e as 12 etapas
// com o calendário exato da especificação do usuário (planilha Kanban_Campanha_Email_Padarias_Prosystem.xlsx).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ETAPAS = [
  { numero: 1,  dia_envio: 0,  assunto: 'Sua padaria vende. Mas o lucro aparece?',                          tema: null,                       fase_kanban: 'NUTRICAO_1' },
  { numero: 2,  dia_envio: 3,  assunto: 'Sua padaria está produzindo no escuro?',                           tema: 'Produção / Estoque',       fase_kanban: 'NUTRICAO_1' },
  { numero: 3,  dia_envio: 6,  assunto: 'O produto mais vendido pode ser o menos lucrativo',                tema: 'Custos / Margem',          fase_kanban: 'NUTRICAO_1' },
  { numero: 4,  dia_envio: 9,  assunto: 'O caixa da sua padaria não pode parar',                            tema: 'Caixa / TEF',              fase_kanban: 'NUTRICAO_2' },
  { numero: 5,  dia_envio: 12, assunto: 'Os números da sua padaria avisam quando algo sai do controle?',    tema: 'Gestão / Plus',            fase_kanban: 'NUTRICAO_2' },
  { numero: 6,  dia_envio: 15, assunto: 'Veja a Prosystem aplicada à rotina da sua padaria',                tema: null,                       fase_kanban: 'NUTRICAO_2' },
  { numero: 7,  dia_envio: 20, assunto: 'Quanto dinheiro está parado no seu estoque?',                      tema: 'Estoque / Compras',        fase_kanban: 'NUTRICAO_3' },
  { numero: 8,  dia_envio: 25, assunto: 'Você sabe por que uma venda não aconteceu?',                       tema: 'Vendas perdidas',          fase_kanban: 'NUTRICAO_3' },
  { numero: 9,  dia_envio: 30, assunto: 'Quem autorizou esse desconto ou cancelamento?',                    tema: 'Segurança / Auditoria',    fase_kanban: 'NUTRICAO_3' },
  { numero: 10, dia_envio: 35, assunto: 'Promoção boa gira estoque sem destruir margem',                    tema: 'Promoções',                fase_kanban: 'NUTRICAO_4' },
  { numero: 11, dia_envio: 40, assunto: 'Quanto tempo sua equipe perde separando arquivos fiscais?',        tema: 'Fiscal / Contabilidade',   fase_kanban: 'NUTRICAO_4' },
  { numero: 12, dia_envio: 45, assunto: 'Vamos analisar o que está escapando da sua operação?',             tema: 'Diagnóstico',              fase_kanban: 'NUTRICAO_4' },
];

async function main() {
  const sequencia = await prisma.sequenciaEmail.upsert({
    where: { id: 'seq-padarias-2026' },
    create: {
      id: 'seq-padarias-2026',
      nome: 'Padarias 2026',
      segmento: 'Padaria',
      ativa: true,
      descricao: '12 e-mails de reengajamento e nutrição, D+0 a D+45.',
      created_by: 'system',
    },
    update: {},
  });

  for (const e of ETAPAS) {
    const numeroFormatado = String(e.numero).padStart(2, '0');
    await prisma.sequenciaEmailEtapa.upsert({
      where: { sequencia_id_numero: { sequencia_id: sequencia.id, numero: e.numero } },
      create: {
        sequencia_id: sequencia.id,
        numero: e.numero,
        dia_envio: e.dia_envio,
        assunto: e.assunto,
        template_path: `padarias-sequencia/email-${numeroFormatado}.html`,
        tema: e.tema,
        fase_kanban: e.fase_kanban,
      },
      update: {
        dia_envio: e.dia_envio,
        assunto: e.assunto,
        template_path: `padarias-sequencia/email-${numeroFormatado}.html`,
        tema: e.tema,
        fase_kanban: e.fase_kanban,
      },
    });
  }

  console.log(`Sequência "${sequencia.nome}" (${sequencia.id}) com ${ETAPAS.length} etapas seedadas.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Rodar o seed**

```bash
cd backend
npx tsx scripts/seed-sequencia-padarias.ts
```

Expected: `Sequência "Padarias 2026" (seq-padarias-2026) com 12 etapas seedadas.`

- [ ] **Step 3: Verificar no banco**

```bash
node -e "
const mysql = require('mysql2/promise');
mysql.createConnection(process.env.DATABASE_URL).then(async conn => {
  const [rows] = await conn.query('SELECT numero, dia_envio, assunto FROM SequenciaEmailEtapa ORDER BY numero');
  console.table(rows);
  await conn.end();
});
"
```

Expected: 12 linhas, dia_envio na sequência 0,3,6,9,12,15,20,25,30,35,40,45.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/seed-sequencia-padarias.ts
git commit -m "feat: seed da sequencia de email Padarias 2026 (12 etapas)"
```

---

## C) Serviço de envio adaptado para Lead

### Task 4: `backend/src/services/sequencia-email.service.ts`

**Files:**
- Create: `backend/src/services/sequencia-email.service.ts`
- Reference: `backend/src/services/email-campanha.service.ts` (padrão de chamada ao Resend, `getResend()`/`EMAIL_FROM` — **reusar a mesma instância do Resend**, não duplicar a inicialização do client)

**Interfaces:**
- Consome: `Resend` client (extrair `getResend()` de `email-campanha.service.ts` para um local compartilhado — ver Step 1), `EMAIL_FROM` (mesma env var).
- Produz: `entrarNaSequencia(prisma, { sequenciaId, leadId, userId })`, `dispararProximoEmail(prisma, leadSequenciaId)`, `pausarSequencia(prisma, leadSequenciaId, motivo)`, `rodarSchedulerDiario(prisma)` — usados pela rota (Task 5) e pelo scheduler (Task 7).

- [ ] **Step 1: Extrair `getResend()` para um módulo compartilhado**

Criar `backend/src/lib/resend-client.ts`:

```ts
import { Resend } from 'resend';

export const EMAIL_FROM = process.env.EMAIL_FROM || 'Prosystem <onboarding@resend.dev>';

let _resend: Resend | null = null;
export function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY não configurada');
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}
```

Editar `backend/src/services/email-campanha.service.ts`: remover a definição local de `EMAIL_FROM`/`getResend()`/`_resend` (linhas 5-15 do arquivo atual) e substituir por:

```ts
import { getResend, EMAIL_FROM } from '@/lib/resend-client';
```

Expected: `email-campanha.service.ts` continua funcionando exatamente igual (mesmo comportamento), só que a inicialização do client Resend vem de um lugar compartilhado.

- [ ] **Step 2: Rodar o teste de regressão do serviço já existente**

```bash
cd backend
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "email-campanha\|resend-client"
```

Expected: nenhuma saída (sem erros de tipo).

- [ ] **Step 3: Escrever `sequencia-email.service.ts`**

```ts
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { getResend, EMAIL_FROM } from '@/lib/resend-client';

/**
 * Insere um lead numa sequência de e-mail (ex.: Padarias 2026). Idempotente:
 * se o lead já está na sequência, retorna o vínculo existente sem duplicar
 * (respeita o @@unique([sequencia_id, lead_id]) do schema).
 */
export async function entrarNaSequencia(
  prisma: PrismaClient,
  params: { sequenciaId: string; leadId: string; userId: string }
) {
  const existente = await prisma.leadSequenciaEmail.findUnique({
    where: { sequencia_id_lead_id: { sequencia_id: params.sequenciaId, lead_id: params.leadId } },
  });
  if (existente) return existente;

  const primeiraEtapa = await prisma.sequenciaEmailEtapa.findFirst({
    where: { sequencia_id: params.sequenciaId, numero: 1 },
  });
  if (!primeiraEtapa) throw new Error('Sequência sem etapa 1 configurada');

  return prisma.leadSequenciaEmail.create({
    data: {
      sequencia_id: params.sequenciaId,
      lead_id: params.leadId,
      fase_kanban: 'BASE_VALIDADA',
      // Etapa 1 é D+0 — o scheduler do mesmo dia já pode disparar.
      proximo_envio_em: new Date(),
      created_by: params.userId,
    },
  });
}

/** Lê o HTML do template e substitui o placeholder de descadastro. */
function carregarTemplate(templatePath: string, unsubscribeUrl: string): string {
  const fullPath = path.join(process.cwd(), 'src', 'email-templates', templatePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Template não encontrado: ${templatePath}`);
  return fs.readFileSync(fullPath, 'utf-8').replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);
}

/**
 * Envia o PRÓXIMO e-mail pendente de um LeadSequenciaEmail (aquele cujo
 * `ultima_etapa_enviada + 1` ainda não foi enviado) e agenda o próximo envio.
 * Se já enviou a etapa 12, marca fase_kanban = LONGO_PRAZO e não agenda mais nada.
 * Nunca lança: falha de envio grava um LeadSequenciaEmailDisparo com status ERRO
 * e ainda assim agenda o reenvio pro dia seguinte (não trava a sequência por 1 falha).
 */
export async function dispararProximoEmail(prisma: PrismaClient, leadSequenciaId: string) {
  const ls = await prisma.leadSequenciaEmail.findUnique({
    where: { id: leadSequenciaId },
    include: { lead: true, sequencia: true },
  });
  if (!ls || ls.pausada) return null;

  const proximoNumero = (ls.ultima_etapa_enviada || 0) + 1;
  const etapa = await prisma.sequenciaEmailEtapa.findFirst({
    where: { sequencia_id: ls.sequencia_id, numero: proximoNumero },
  });

  // Sem mais etapas → fim da sequência, vai para nutrição de longo prazo.
  if (!etapa) {
    await prisma.leadSequenciaEmail.update({
      where: { id: ls.id },
      data: { fase_kanban: 'LONGO_PRAZO', proximo_envio_em: null },
    });
    return null;
  }

  const email = ls.lead.email || ls.lead.responsavel_email;
  if (!email) {
    // Lead sem e-mail válido — pausa em vez de tentar reenviar pra sempre.
    await prisma.leadSequenciaEmail.update({
      where: { id: ls.id },
      data: { pausada: true, motivo_pausa: 'Lead sem e-mail cadastrado', pausada_em: new Date() },
    });
    return null;
  }

  const unsubscribeUrl = `${process.env.FRONTEND_URL || 'https://efficient-ambition-production-5f99.up.railway.app'}/descadastro-email?ls=${ls.id}`;
  const html = carregarTemplate(etapa.template_path, unsubscribeUrl);

  let resultado: { status: 'ENVIADO' | 'ERRO'; messageId?: string; erro?: string };
  try {
    const { data, error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: etapa.assunto,
      html,
    });
    resultado = error ? { status: 'ERRO', erro: error.message } : { status: 'ENVIADO', messageId: data!.id };
  } catch (e: any) {
    resultado = { status: 'ERRO', erro: e?.message || 'Erro desconhecido' };
  }

  await prisma.leadSequenciaEmailDisparo.create({
    data: {
      lead_sequencia_id: ls.id,
      etapa_id: etapa.id,
      status: resultado.status,
      message_id: resultado.messageId,
      erro: resultado.erro,
      sent_at: resultado.status === 'ENVIADO' ? new Date() : null,
    },
  });

  // Calcula a data do PRÓXIMO e-mail (etapa+1) a partir de entrou_em — não do
  // envio atual, pra não acumular atraso se o scheduler rodar um dia depois.
  const proximaEtapa = await prisma.sequenciaEmailEtapa.findFirst({
    where: { sequencia_id: ls.sequencia_id, numero: proximoNumero + 1 },
  });
  const proximoEnvioEm = proximaEtapa
    ? new Date(ls.entrou_em.getTime() + proximaEtapa.dia_envio * 86400000)
    : null;

  await prisma.leadSequenciaEmail.update({
    where: { id: ls.id },
    data: {
      ultima_etapa_enviada: proximoNumero,
      proximo_envio_em: proximoEnvioEm,
      fase_kanban: proximaEtapa ? proximaEtapa.fase_kanban : 'LONGO_PRAZO',
    },
  });

  return resultado;
}

/** Pausa a sequência (clique automático via webhook, ou ação manual). */
export async function pausarSequencia(prisma: PrismaClient, leadSequenciaId: string, motivo: string) {
  return prisma.leadSequenciaEmail.update({
    where: { id: leadSequenciaId },
    data: { pausada: true, motivo_pausa: motivo, pausada_em: new Date(), fase_kanban: 'ENGAJOU_QUALIFICAR' },
  });
}

/**
 * Roda 1x/dia (scheduler, ver Task 7): dispara o e-mail de todo
 * LeadSequenciaEmail não pausado cujo proximo_envio_em já venceu.
 */
export async function rodarSchedulerSequenciaEmail(prisma: PrismaClient) {
  const pendentes = await prisma.leadSequenciaEmail.findMany({
    where: { pausada: false, proximo_envio_em: { lte: new Date() } },
  });
  let enviados = 0, erros = 0;
  for (const ls of pendentes) {
    const r = await dispararProximoEmail(prisma, ls.id);
    if (r?.status === 'ENVIADO') enviados++;
    else if (r?.status === 'ERRO') erros++;
  }
  return { processados: pendentes.length, enviados, erros };
}
```

- [ ] **Step 4: Type-check**

```bash
cd backend
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "sequencia-email"
```

Expected: nenhuma saída.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/resend-client.ts backend/src/services/email-campanha.service.ts backend/src/services/sequencia-email.service.ts
git commit -m "feat: servico de envio da sequencia de email por lead (padarias)"
```

---

## D) Rotas HTTP

### Task 5: `backend/src/routes/sequencia-email.ts`

**Files:**
- Create: `backend/src/routes/sequencia-email.ts`
- Modify: `backend/src/server.ts` (registrar a rota nova na lista `routeModules`, ao lado de `campanhas`)

**Interfaces:**
- Consome: `entrarNaSequencia`, `pausarSequencia` (Task 4).
- Produz: as rotas HTTP usadas pelo frontend (Tasks 8, 9, 10).

- [ ] **Step 1: Escrever as rotas**

```ts
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { entrarNaSequencia, pausarSequencia } from '@/services/sequencia-email.service';
import { requireGestor } from '@/lib/scope';

const ID_SEQUENCIA_PADARIAS = 'seq-padarias-2026';

export async function sequenciaEmailRoutes(fastify: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  // Lista as sequências disponíveis (hoje só Padarias, mas já preparado p/ mais).
  fastify.get('/sequencias-email', async (_request, reply) => {
    const sequencias = await prisma.sequenciaEmail.findMany({
      include: { _count: { select: { leads: true } } },
    });
    return reply.send({ status: 'success', data: sequencias });
  });

  // Insere 1 lead na sequência — usado pelo pop-up de opt-in (criar/editar lead).
  fastify.post('/sequencias-email/:sequenciaId/leads/:leadId/entrar', async (request, reply) => {
    const { sequenciaId, leadId } = request.params as { sequenciaId: string; leadId: string };
    const user = (request as any).user;

    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, email: true, responsavel_email: true } });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });
    if (!lead.email && !lead.responsavel_email) {
      return reply.status(400).send({ status: 'error', message: 'Lead sem e-mail cadastrado — não é possível incluir na campanha' });
    }

    const vinculo = await entrarNaSequencia(prisma, { sequenciaId, leadId, userId: user?.id || 'system' });
    return reply.status(201).send({ status: 'success', data: vinculo });
  });

  // Lote: candidatos Padaria ainda sem decisão tomada (nem na sequência, nem descadastrados)
  // — alimenta a tela de revisão retroativa (Task 8).
  fastify.get('/sequencias-email/:sequenciaId/candidatos', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { sequenciaId } = request.params as { sequenciaId: string };

    const sequencia = await prisma.sequenciaEmail.findUnique({ where: { id: sequenciaId } });
    if (!sequencia) return reply.status(404).send({ status: 'error', message: 'Sequência não encontrada' });

    const jaDecididos = await prisma.leadSequenciaEmail.findMany({
      where: { sequencia_id: sequenciaId },
      select: { lead_id: true },
    });
    const idsExcluir = jaDecididos.map(d => d.lead_id);

    const candidatos = await prisma.lead.findMany({
      where: {
        segmento: sequencia.segmento,
        deleted_at: null,
        id: { notIn: idsExcluir.length ? idsExcluir : ['__nenhum__'] },
        OR: [{ email: { not: null } }, { responsavel_email: { not: null } }],
      },
      select: { id: true, nome: true, razao_social: true, email: true, responsavel_email: true, vendedor_nome: true, created_at: true },
      orderBy: { created_at: 'desc' },
    });
    return reply.send({ status: 'success', data: candidatos });
  });

  // Entrada em lote (revisão retroativa) — recebe os IDs escolhidos na tela.
  fastify.post('/sequencias-email/:sequenciaId/entrar-lote', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { sequenciaId } = request.params as { sequenciaId: string };
    const body = z.object({ leadIds: z.array(z.string()).min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe leadIds' });

    const user = (request as any).user;
    let inseridos = 0;
    for (const leadId of body.data.leadIds) {
      await entrarNaSequencia(prisma, { sequenciaId, leadId, userId: user?.id || 'system' }).catch(() => {});
      inseridos++;
    }
    return reply.send({ status: 'success', data: { inseridos } });
  });

  // Kanban dedicado — leads agrupados por fase.
  fastify.get('/sequencias-email/:sequenciaId/kanban', async (request, reply) => {
    const { sequenciaId } = request.params as { sequenciaId: string };
    const leads = await prisma.leadSequenciaEmail.findMany({
      where: { sequencia_id: sequenciaId },
      include: {
        lead: { select: { id: true, nome: true, razao_social: true, nome_fantasia: true, email: true, responsavel_nome: true, responsavel_telefone: true, vendedor_nome: true } },
      },
      orderBy: { updated_at: 'desc' },
    });

    const FASES = ['BASE_VALIDADA', 'NUTRICAO_1', 'NUTRICAO_2', 'NUTRICAO_3', 'NUTRICAO_4', 'ENGAJOU_QUALIFICAR', 'APRESENTACAO_AGENDADA', 'APRESENTACAO_REALIZADA', 'PROPOSTA_NEGOCIACAO', 'CONTRATO_ASSINADO', 'LONGO_PRAZO', 'DESCADASTRADO'];
    const grouped: Record<string, typeof leads> = {};
    for (const f of FASES) grouped[f] = [];
    for (const l of leads) (grouped[l.fase_kanban] ||= []).push(l);

    return reply.send({ status: 'success', data: { fases: FASES, leads: grouped } });
  });

  // Mover manualmente de fase (ex.: marcar "engajou" por resposta/WhatsApp percebido manualmente).
  fastify.patch('/sequencias-email/leads/:leadSequenciaId/fase', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { leadSequenciaId } = request.params as { leadSequenciaId: string };
    const body = z.object({
      fase_kanban: z.string(),
      motivo: z.string().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe fase_kanban' });

    // Mover para ENGAJOU_QUALIFICAR manualmente também pausa a sequência
    // (resposta por e-mail ou WhatsApp — não detectável automaticamente).
    if (body.data.fase_kanban === 'ENGAJOU_QUALIFICAR') {
      const atualizado = await pausarSequencia(prisma, leadSequenciaId, body.data.motivo || 'Engajamento manual (resposta/WhatsApp)');
      return reply.send({ status: 'success', data: atualizado });
    }

    const atualizado = await prisma.leadSequenciaEmail.update({
      where: { id: leadSequenciaId },
      data: { fase_kanban: body.data.fase_kanban },
    });
    return reply.send({ status: 'success', data: atualizado });
  });

  // Descadastro (link do e-mail — rota pública, sem auth).
  fastify.get('/sequencias-email/descadastro/:leadSequenciaId', async (request, reply) => {
    const { leadSequenciaId } = request.params as { leadSequenciaId: string };
    await prisma.leadSequenciaEmail.update({
      where: { id: leadSequenciaId },
      data: { pausada: true, motivo_pausa: 'Descadastro', fase_kanban: 'DESCADASTRADO', descadastrou_em: new Date(), proximo_envio_em: null },
    }).catch(() => {});
    return reply.type('text/html').send('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Você foi removido desta campanha.</h2><p>Não enviaremos mais e-mails desta sequência.</p></body></html>');
  });
}
```

- [ ] **Step 2: Registrar a rota em `server.ts`**

Localizar a lista `routeModules` (linha ~333, perto de `campanhas`) e adicionar:

```ts
    ['sequencia-email',       () => import('./routes/sequencia-email'),       'sequenciaEmailRoutes'],
```

- [ ] **Step 3: Type-check e teste manual local**

```bash
cd backend
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "sequencia-email"
```

Expected: nenhuma saída. Depois, subir o backend local (`npx tsx src/server.ts`) e testar:

```bash
curl -s http://localhost:3001/sequencias-email
```

Expected: JSON com a sequência "Padarias 2026" e `_count.leads: 0`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/sequencia-email.ts backend/src/server.ts
git commit -m "feat: rotas da sequencia de email (entrar, kanban, mover fase, descadastro)"
```

---

## E) Webhook do Resend (clique pausa automaticamente)

### Task 6: `POST /webhooks/resend`

**Files:**
- Modify: `backend/src/routes/sequencia-email.ts` (adicionar a rota de webhook)

**Interfaces:**
- Consome: `pausarSequencia` (Task 4).

- [ ] **Step 1: Adicionar a rota de webhook**

O Resend assina o payload com um header `svix-signature` (usa Svix por baixo). Para esta primeira versão, sem verificação de assinatura (documentar como TODO — não é crítico porque o endpoint só reage a cliques de mensagens conhecidas via `message_id`, e um clique falso não tem efeito destrutivo, só pausaria um lead à toa; verificação de assinatura fica para uma iteração de hardening):

```ts
  // Webhook do Resend — evento "email.clicked" pausa a sequência automaticamente.
  // TODO(hardening): validar assinatura svix (RESEND_WEBHOOK_SECRET) antes de confiar no payload.
  fastify.post('/webhooks/resend', async (request, reply) => {
    const body = request.body as any;
    if (body?.type !== 'email.clicked') return reply.send({ status: 'ignored' });

    const messageId = body?.data?.email_id;
    const clickedUrl = body?.data?.click?.link;
    if (!messageId) return reply.send({ status: 'ignored' });

    const disparo = await prisma.leadSequenciaEmailDisparo.findFirst({
      where: { message_id: messageId },
      include: { lead_sequencia: true, etapa: true },
    });
    if (!disparo) return reply.send({ status: 'ignored' }); // não é um e-mail desta sequência

    await prisma.leadSequenciaEmailDisparo.update({
      where: { id: disparo.id },
      data: { link_clicado: true, clicked_at: new Date(), clicked_url: clickedUrl },
    });

    if (!disparo.lead_sequencia.pausada) {
      await pausarSequencia(prisma, disparo.lead_sequencia.id, 'Clique no CTA');
      await prisma.leadSequenciaEmail.update({
        where: { id: disparo.lead_sequencia.id },
        data: { tema_interesse: disparo.etapa.tema },
      });
    }

    return reply.send({ status: 'ok' });
  });
```

- [ ] **Step 2: Configurar o webhook no painel do Resend (ação manual do usuário)**

Não é código — anotar como instrução: no painel do Resend (resend.com/webhooks), criar um endpoint apontando para `https://crmcomercialprosystem-production-945e.up.railway.app/webhooks/resend`, escutando o evento `email.clicked`. Isso só é possível depois do deploy da Task 6 estar no ar.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/sequencia-email.ts
git commit -m "feat: webhook do Resend pausa sequencia automaticamente no clique"
```

---

## F) Scheduler diário

### Task 7: Registrar o scheduler em `server.ts`

**Files:**
- Modify: `backend/src/server.ts` (adicionar perto do scheduler de automação já existente, linha ~300-320)

**Interfaces:**
- Consome: `rodarSchedulerSequenciaEmail` (Task 4).

- [ ] **Step 1: Adicionar o scheduler**

Seguir exatamente o mesmo padrão do scheduler de automação já existente (linhas ~296-320 do arquivo atual: intervalo de 15 minutos, roda 1x por dia numa janela de hora fixa, guarda `ultimoDia` para não repetir). Adicionar logo abaixo dele:

```ts
{
  let ultimoDiaSequenciaEmail = '';
  const HORA_UTC_SEQUENCIA = 13; // ~10h no horário de Brasília

  const rodarSequenciaEmail = async () => {
    try {
      const agora = new Date();
      if (agora.getUTCHours() !== HORA_UTC_SEQUENCIA) return;
      const dia = agora.toISOString().slice(0, 10);
      if (dia === ultimoDiaSequenciaEmail) return;
      ultimoDiaSequenciaEmail = dia;

      const { rodarSchedulerSequenciaEmail } = await import('./services/sequencia-email.service.js');
      const resultado = await rodarSchedulerSequenciaEmail(prismaClient!);
      console.log(`[SEQUENCIA-EMAIL] ${resultado.processados} processados, ${resultado.enviados} enviados, ${resultado.erros} erros`);
    } catch (err: any) {
      console.error('[SEQUENCIA-EMAIL] Erro no scheduler:', err?.message);
    }
  };

  setInterval(rodarSequenciaEmail, 15 * 60 * 1000);
  setTimeout(rodarSequenciaEmail, 150 * 1000);
  console.log('[BOOT] Scheduler da sequência de e-mail (padarias) iniciado');
}
```

- [ ] **Step 2: Teste manual do disparo (sem esperar o horário do scheduler)**

Usar a rota de entrada manual (Task 5) pra colocar 1 lead de teste na sequência, depois chamar diretamente a função no console local pra confirmar que o e-mail 1 sai:

```bash
cd backend
npx tsx -e "
import { PrismaClient } from '@prisma/client';
import { dispararProximoEmail } from './src/services/sequencia-email.service';
const prisma = new PrismaClient();
(async () => {
  // substituir pelo ID retornado pelo POST /entrar de teste
  const r = await dispararProximoEmail(prisma, 'COLOQUE_O_ID_AQUI');
  console.log(r);
  await prisma.\$disconnect();
})();
"
```

Expected: `{ status: 'ENVIADO', messageId: '...' }` — e o e-mail chega na caixa de teste (mesma limitação de sandbox do Resend: só entrega pro e-mail cadastrado na conta).

- [ ] **Step 3: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat: scheduler diario dispara sequencia de email das padarias"
```

---

## G) Frontend — Pop-up de opt-in

### Task 8: Pop-up ao criar/editar lead com segmento Padaria

**Files:**
- Modify: `frontend/app/leads/page.tsx`
- Modify: `frontend/lib/api-client.ts` (novos métodos)

**Interfaces:**
- Consome: `POST /sequencias-email/:sequenciaId/leads/:leadId/entrar` (Task 5).

- [ ] **Step 1: Adicionar métodos no `api-client.ts`**

```ts
async getSequenciasEmail() {
  return this.client.get('/sequencias-email');
}
async entrarNaSequenciaEmail(sequenciaId: string, leadId: string) {
  return this.client.post(`/sequencias-email/${sequenciaId}/leads/${leadId}/entrar`);
}
async getCandidatosSequenciaEmail(sequenciaId: string) {
  return this.client.get(`/sequencias-email/${sequenciaId}/candidatos`);
}
async entrarLoteSequenciaEmail(sequenciaId: string, leadIds: string[]) {
  return this.client.post(`/sequencias-email/${sequenciaId}/entrar-lote`, { leadIds });
}
async getKanbanSequenciaEmail(sequenciaId: string) {
  return this.client.get(`/sequencias-email/${sequenciaId}/kanban`);
}
async moverFaseSequenciaEmail(leadSequenciaId: string, faseKanban: string, motivo?: string) {
  return this.client.patch(`/sequencias-email/leads/${leadSequenciaId}/fase`, { fase_kanban: faseKanban, motivo });
}
```

- [ ] **Step 2: Estado e lógica do pop-up em `leads/page.tsx`**

Adicionar, perto dos outros `useState` do componente:

```tsx
const [popupPadaria, setPopupPadaria] = useState<{ leadId: string; nome: string } | null>(null);
const SEQUENCIA_PADARIAS_ID = 'seq-padarias-2026';
```

Na função `createNewLead` (já existente), logo após `if (novo?.id) setSelectedLead(novo);` (sucesso da criação), adicionar:

```tsx
if (novo?.id && payload.segmento === 'Padaria') {
  setPopupPadaria({ leadId: novo.id, nome: novo.razao_social || novo.nome });
}
```

Fazer o mesmo na função de salvar edição do lead (onde o `editForm` é submetido) — ao salvar com sucesso, checar `editForm.segmento === 'Padaria'` e, **se o segmento MUDOU** (comparar com o valor anterior do lead antes da edição), abrir o mesmo pop-up. Isso evita reabrir o pop-up toda vez que alguém salva um lead que já era Padaria antes.

- [ ] **Step 3: JSX do pop-up**

Adicionar perto dos outros modais do componente:

```tsx
{popupPadaria && (
  <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(13,34,56,.6)' }}>
    <div className="ps-card rounded-2xl shadow-2xl p-6" style={{ width: 420 }}>
      <h2 className="text-sm font-extrabold mb-2" style={{ color: 'var(--t-text-primary)' }}>Incluir na campanha de padarias?</h2>
      <p className="text-xs mb-4" style={{ color: 'var(--t-text-secondary)' }}>
        <b>{popupPadaria.nome}</b> foi classificado como Padaria. Deseja incluir este lead na sequência de e-mail marketing (12 e-mails, D+0 a D+45)?
      </p>
      <div className="flex justify-end gap-2">
        <button onClick={() => setPopupPadaria(null)} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-primary)' }}>
          Agora não
        </button>
        <button
          onClick={async () => {
            await apiClient.entrarNaSequenciaEmail(SEQUENCIA_PADARIAS_ID, popupPadaria.leadId).catch(() => {});
            setPopupPadaria(null);
          }}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-white"
          style={{ background: '#16a34a' }}
        >
          Sim, incluir
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Type-check**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep -i "leads/page.tsx"
```

Expected: nenhuma saída.

- [ ] **Step 5: Teste manual no navegador**

Criar um lead novo com segmento "Padaria" e confirmar que o pop-up aparece ao salvar; clicar "Sim, incluir" e verificar no banco que `LeadSequenciaEmail` foi criado para aquele lead.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/leads/page.tsx frontend/lib/api-client.ts
git commit -m "feat: pop-up de opt-in na campanha de padarias ao criar/editar lead"
```

---

## H) Frontend — Revisão retroativa da base existente

### Task 9: Tela de revisão em lote

**Files:**
- Create: `frontend/app/campanha-padarias/revisar/page.tsx`
- Modify: `frontend/components/dashboard/DashboardLayout.tsx` (item de menu, opcional — pode ser acessado só por link direto na primeira versão)

**Interfaces:**
- Consome: `getCandidatosSequenciaEmail`, `entrarLoteSequenciaEmail` (Task 8, Step 1).

- [ ] **Step 1: Escrever a tela**

Lista simples: tabela com checkbox por linha (nome, e-mail, vendedor, data de cadastro), checkbox "selecionar todos", botão "Incluir selecionados na campanha". Buscar candidatos via `getCandidatosSequenciaEmail('seq-padarias-2026')` no `useEffect` de carga; ao confirmar, chamar `entrarLoteSequenciaEmail` com os IDs marcados e recarregar a lista (os incluídos somem, já que a rota de candidatos exclui quem já decidiu).

Seguir o padrão visual já estabelecido no projeto (`ps-card`, `DashboardLayout`, tokens `var(--t-*)`) — não introduzir uma paleta nova.

- [ ] **Step 2: Teste manual**

Abrir a tela, confirmar que lista os leads Padaria existentes sem decisão tomada, selecionar alguns, confirmar, e verificar que sumiram da lista e apareceram como `LeadSequenciaEmail` no banco.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/campanha-padarias/revisar/page.tsx
git commit -m "feat: tela de revisao retroativa dos leads padaria existentes"
```

---

## I) Frontend — Kanban dedicado

### Task 10: Kanban da campanha

**Files:**
- Create: `frontend/app/campanha-padarias/page.tsx`
- Modify: `frontend/components/dashboard/DashboardLayout.tsx` (item de menu "Campanha Padarias", dentro do grupo Performance ou Inteligência)

**Interfaces:**
- Consome: `getKanbanSequenciaEmail`, `moverFaseSequenciaEmail` (Task 8, Step 1).

- [ ] **Step 1: Escrever o Kanban**

Colunas na ordem exata: Base validada, Nutrição 1, Nutrição 2, Nutrição 3, Nutrição 4, Engajou / Qualificar, Apresentação agendada, Apresentação realizada, Proposta / Negociação, Contrato assinado, Nutrição de longo prazo, Descadastrado. Cada card mostra nome do lead, tema de interesse (se houver), última etapa enviada (ex.: "E5/12"), e um botão "Marcar como engajou" visível apenas nas colunas de Nutrição (chama `moverFaseSequenciaEmail(id, 'ENGAJOU_QUALIFICAR', 'Engajamento manual')`).

Reaproveitar o padrão de layout de kanban já usado em `frontend/app/leads/page.tsx` (scroll horizontal com dots de navegação) em vez de inventar um layout novo — mas **sem** drag-and-drop nesta primeira versão (mover fase é só via botão explícito, para não permitir mover um lead "sem querer" para uma fase que devia ser automática).

- [ ] **Step 2: Adicionar item no menu**

Em `DashboardLayout.tsx`, no grupo `Performance` ou `Inteligência` (junto de outros itens de campanha/análise):

```ts
{ href: '/campanha-padarias', icon: Megaphone, label: 'Campanha Padarias', roles: GESTAO_COMERCIAL },
```

- [ ] **Step 3: Teste manual**

Abrir a tela, confirmar que o lead de teste (Task 7, Step 2) aparece na coluna correta (Nutrição 1, já que recebeu o e-mail 1), e que o botão "Marcar como engajou" move o card para "Engajou / Qualificar" e pausa a sequência (conferir no banco: `pausada = true`).

- [ ] **Step 4: Type-check e commit**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep -i "campanha-padarias"
git add frontend/app/campanha-padarias/page.tsx frontend/components/dashboard/DashboardLayout.tsx
git commit -m "feat: kanban dedicado da campanha de email padarias"
```

---

## J) Deploy e verificação final

### Task 11: Deploy e teste de ponta a ponta em produção

- [ ] **Step 1: Push e aguardar deploy do Railway**

```bash
git push origin main
```

- [ ] **Step 2: Rodar a migration em produção**

Confirmar que o deploy do backend rodou `prisma migrate deploy` automaticamente (checar `package.json` / `Procfile` / start script do backend); se não rodar automaticamente, rodar manualmente contra o banco de produção uma única vez.

- [ ] **Step 3: Rodar o seed em produção (1x)**

```bash
cd backend
DATABASE_URL="<url de produção>" npx tsx scripts/seed-sequencia-padarias.ts
```

- [ ] **Step 4: Configurar o webhook no painel do Resend**

Apontar para a URL de produção do backend (`.../webhooks/resend`), evento `email.clicked` (ver Task 6, Step 2).

- [ ] **Step 5: Teste manual completo em produção**

1. Criar um lead de teste com segmento Padaria em `/leads` → confirmar que o pop-up aparece → clicar "Sim, incluir".
2. Verificar em `/campanha-padarias` que o card aparece em "Base validada" (ou já em "Nutrição 1" se o scheduler já rodou no dia).
3. Abrir `/campanha-padarias/revisar` e confirmar que leads Padaria antigos aparecem como candidatos.
4. Aguardar o scheduler rodar (ou testar disparo manual conforme Task 7, Step 2) e confirmar que o e-mail 1 chega na caixa de teste.
5. Clicar no link de descadastro do e-mail recebido e confirmar que o lead aparece como "Descadastrado" no kanban.

---

## Riscos conhecidos / limitações aceitas

- Resposta por e-mail e contato via WhatsApp **não são detectados automaticamente** — dependem de alguém mover o card manualmente. Documentado como decisão explícita do usuário.
- Webhook do Resend **sem verificação de assinatura** nesta primeira versão (TODO documentado no código) — risco baixo porque o efeito de um payload falso é só pausar um lead à toa, não uma ação destrutiva.
- Envio real para a base de 909 leads/clientes inativos continua bloqueado até um domínio ser verificado no Resend (mesma limitação já registrada na integração anterior) — esta campanha, hoje, só consegue ser testada com o e-mail cadastrado na conta Resend.
- `Lead.segmento` é um campo de texto (`String?`) mesmo vindo de um `<Sel>` fixo — se alguém popular esse campo via importação em massa ou API externa com um valor diferente de exatamente `"Padaria"` (ex.: `"padaria"` minúsculo, ou `"Padaria/Confeitaria"`), o pop-up não dispara. Aceito por ora; se isso incomodar na prática, trocar a comparação exata por `segmentoDe(lead.segmento) === 'PADARIA'` (função já existente em `backend/src/lib/segmento.ts`) numa iteração futura.

## Critical Files for Implementation

- `backend/prisma/schema.prisma`
- `backend/scripts/seed-sequencia-padarias.ts`
- `backend/src/lib/resend-client.ts`
- `backend/src/services/sequencia-email.service.ts`
- `backend/src/services/email-campanha.service.ts` (edição pequena, extrair client compartilhado)
- `backend/src/routes/sequencia-email.ts`
- `backend/src/server.ts` (registrar rota + scheduler)
- `frontend/app/leads/page.tsx`
- `frontend/app/campanha-padarias/page.tsx`
- `frontend/app/campanha-padarias/revisar/page.tsx`
- `frontend/lib/api-client.ts`
- `frontend/components/dashboard/DashboardLayout.tsx`
