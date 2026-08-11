# Portal de Parceiros / Representantes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, no-login, multi-step candidacy form (`/parceiro`) implementing the full 10-section "Ficha de Cadastro e Qualificação do Representante" questionnaire, plus an authenticated internal kanban module (`/representantes`) so Prosystem can receive and triage partner/representative applications (Indicador / Representante / Franqueado) without relying on ad-hoc WhatsApp/email.

**Architecture:** One new Prisma model (`CandidatoRepresentante`) backs both surfaces. Key fields (name, company, contact info, chosen profile) live in typed columns for kanban listing/filtering; the remaining ~60 questionnaire answers (Steps 2–10) are stored as one `Json` field (`respostas_detalhadas`) to avoid a migration on every question tweak. A public `POST /api/candidatos-representante` (no auth) creates records and fires an email notification. Authenticated `GET`/`GET :id`/`PATCH :id` power the internal kanban (fixed 4-status enum). Frontend is two independent Next.js pages: `/parceiro` (public, unauthenticated, 10-step wizard) and `/representantes` (authenticated, drag-and-drop kanban with an accordion detail view matching the wizard's 10 sections).

**Tech Stack:** Fastify + Prisma + Zod (backend, matches `backend/src/routes/etiquetas.ts` pattern), Next.js App Router + native HTML5 drag-and-drop (frontend, matches `frontend/app/leads/page.tsx` pattern), Nodemailer via existing `backend/src/services/email.service.ts`.

## Global Constraints

- Key fields (Step 1 of the questionnaire) are typed Prisma columns: `nome, empresa, nome_fantasia, cnpj, cpf_responsavel, telefone, email, cidade, estado, perfil_desejado`. Everything from Steps 2–10 lives in one `Json` column `respostas_detalhadas` — exact shape given in the spec (`docs/superpowers/specs/2026-08-11-portal-parceiros-representantes-design.md`, section "Modelo de dados").
- No per-field backend validation inside `respostas_detalhadas` — it's accepted as free-form JSON. Only Step 1 fields and `perfil_desejado` are validated by zod on the backend.
- No draft/partial-save persistence in v1 — closing the tab mid-wizard loses progress. Do not build `localStorage` or server-side draft persistence.
- Notification email recipient is fixed: `jessica@prosystemnet.com.br` (no per-user configuration in v1).
- No automatic creation of `Usuario`/vendedor records on approval — status change is the only side effect.
- Public `POST` endpoint must NOT use `requireAuth` (it's the only unauthenticated route in this feature); all other endpoints must use `{ onRequest: requireAuth }` exactly like `backend/src/routes/casos-churn.ts:69`.
- `GET /candidatos-representante` (list) must NOT return `respostas_detalhadas` — only key fields, to keep the kanban list payload light. `GET /candidatos-representante/:id` (detail) DOES include it.
- Email failures must never fail the public POST response — the database record is the source of truth; email errors are logged only (mirrors `enviarEmailRedefinicaoSenha`'s `{ ok, error }` return shape in `backend/src/services/email.service.ts:875`). The email body does NOT include the full 60-answer detail — only key fields + a short summary (states of operation + truncated "apresentação da operação" text).
- Kanban drag-and-drop must use the same deferred `setTimeout(() => setDraggingLead(lead), 0)` pattern from `frontend/app/leads/page.tsx:1338` to avoid the documented Chrome/Edge drag-cancel bug.
- Design system colors: gradient `#0D2238 → #1A4E82 → #2E6EAB`, accent `#4B8EC8`, matching existing client-facing emails and `/leads` page.
- Cities list (Step 6) and brands list (Step 8) are unbounded dynamic "+ Adicionar" lists, NOT fixed to 10/4 entries.

---

## File Structure

- `backend/prisma/schema.prisma` — add `CandidatoRepresentante` model.
- `backend/src/routes/candidatos-representante.ts` — new route file (POST public, GET/GET:id/PATCH:id authenticated).
- `backend/src/server.ts` — register new route module in `routeModules` array.
- `backend/src/services/email.service.ts` — add `enviarEmailNovaCandidaturaRepresentante` export.
- `backend/tests/candidatos-representante.test.ts` — new vitest integration test file.
- `frontend/app/parceiro/page.tsx` — new public form page (wizard shell + state + submit).
- `frontend/app/parceiro/steps.tsx` — the 10 step components, extracted from `page.tsx` to keep it from growing past ~300 lines.
- `frontend/app/representantes/page.tsx` — new authenticated kanban page.
- `frontend/app/representantes/DetalheCandidato.tsx` — the detail modal (accordion of 10 sections), extracted to keep `page.tsx` focused on the kanban board.
- `frontend/components/dashboard/DashboardLayout.tsx` — add one `NavItem` entry.

---

### Task 1: Prisma model `CandidatoRepresentante`

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma model `CandidatoRepresentante` with fields `id, nome, empresa, nome_fantasia, cnpj, cpf_responsavel, telefone, email, cidade, estado, perfil_desejado, respostas_detalhadas (Json), status, observacoes_internas, created_at, updated_at`, consumed by Task 2's route file.

- [ ] **Step 1: Add the model to schema.prisma**

Open `backend/prisma/schema.prisma`, find the `model KanbanColuna {` block (around line 744), and insert the new model directly above it:

```prisma
model CandidatoRepresentante {
  id        String   @id @default(cuid())

  // Passo 1 — campos-chave
  nome             String
  empresa          String?
  nome_fantasia    String?
  cnpj             String?
  cpf_responsavel  String?
  telefone         String
  email            String
  cidade           String?
  estado           String?

  perfil_desejado  String // INDICADOR | REPRESENTANTE | FRANQUEADO

  // Passos 2–10 — respostas completas do questionário (ver spec p/ formato)
  respostas_detalhadas Json

  status    String   @default("NOVO") // NOVO | EM_ANALISE | APROVADO | REPROVADO
  observacoes_internas String? @db.Text

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([status])
  @@index([created_at])
}

model KanbanColuna {
```

- [ ] **Step 2: Generate the migration**

Run: `cd backend && npx prisma migrate dev --name add_candidato_representante`
Expected: Output ends with `Your database is now in sync with your schema.` and a new folder appears under `backend/prisma/migrations/` containing `candidato_representante` in its name.

- [ ] **Step 3: Regenerate the Prisma client**

Run: `cd backend && npx prisma generate`
Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat: adiciona model CandidatoRepresentante"
```

---

### Task 2: Backend route — public POST + authenticated GET/PATCH

**Files:**
- Create: `backend/src/routes/candidatos-representante.ts`
- Test: `backend/tests/candidatos-representante.test.ts`
- Modify: `backend/src/server.ts:335` (insert into `routeModules` array)

**Interfaces:**
- Consumes: Prisma model `CandidatoRepresentante` from Task 1; `requireAuth` from `backend/src/middleware/auth.ts`; `enviarEmailNovaCandidaturaRepresentante` from Task 3 (`backend/src/services/email.service.ts`).
- Produces: Fastify plugin `candidatosRepresentanteRoutes(fastify, { prisma })` exporting routes `POST /candidatos-representante`, `GET /candidatos-representante`, `GET /candidatos-representante/:id`, `PATCH /candidatos-representante/:id`. Response envelope on all routes: `{ status: 'success' | 'error', data?: ..., message?: string }`. List endpoint's `data` items omit `respostas_detalhadas`; detail endpoint's `data` includes it.

- [ ] **Step 1: Write the failing integration test**

Create `backend/tests/candidatos-representante.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { candidatosRepresentanteRoutes } from '@/routes/candidatos-representante';

const RESPOSTAS_DETALHADAS_TESTE = {
  estrutura_empresa: { possui_equipe: true, qtd_pessoas: 3 },
  estrutura_comercial: { visita_presencial: true, canais: ['WHATSAPP'] },
  instalacao_implantacao: { realiza_instalacao: true },
  suporte: { presta_suporte: true, tipos: ['WHATSAPP'] },
  regiao_atuacao: { estados: ['ES'], cidades: [{ nome: 'Vitória/ES', tipo: 'PRESENCIAL' }] },
  experiencia_mercado: { tempo_atuacao: '5 anos', segmentos: ['FARMACIAS'] },
  marcas_atuais: { representa_outras: false, marcas: [] },
  capacidade_expansao: { prospectar_mes: '10', etapas_atua: ['PROSPECCAO', 'SUPORTE'] },
  apresentacao_operacao: 'Atuo há 5 anos na região com foco em farmácias.',
};

describe('Candidatos Representante Routes', () => {
  let fastify: FastifyInstance;
  let prisma: PrismaClient;
  let createdId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    fastify = Fastify();
    fastify.register(cors);
    fastify.register(helmet, { contentSecurityPolicy: false });
    fastify.register(async (fastify) => {
      fastify.register(candidatosRepresentanteRoutes, { prisma });
    });
    fastify.get('/health', async () => ({ status: 'ok' }));
  });

  afterAll(async () => {
    await prisma.candidatoRepresentante.deleteMany({ where: { email: 'candidato.teste@example.com' } });
    await prisma.$disconnect();
    await fastify.close();
  });

  it('POST /candidatos-representante creates a candidacy without auth', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/candidatos-representante',
      payload: {
        nome: 'Candidato Teste',
        empresa: 'Teste Comércio LTDA',
        telefone: '27999999999',
        email: 'candidato.teste@example.com',
        cidade: 'Vitória',
        estado: 'ES',
        perfil_desejado: 'REPRESENTANTE',
        respostas_detalhadas: RESPOSTAS_DETALHADAS_TESTE,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.status).toBe('success');
    expect(body.data.status).toBe('NOVO');
    expect(body.data.respostas_detalhadas.apresentacao_operacao).toBe('Atuo há 5 anos na região com foco em farmácias.');
    createdId = body.data.id;
  });

  it('POST /candidatos-representante rejects invalid payload', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/candidatos-representante',
      payload: { nome: '' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('GET /candidatos-representante requires auth', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/candidatos-representante' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /candidatos-representante rejects invalid token', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/candidatos-representante',
      headers: { authorization: 'Bearer test-token' },
    });
    // token inválido também deve barrar (401) — o hook global só popula
    // request.user, quem bloqueia é requireAuth verificando a assinatura.
    expect(response.statusCode).toBe(401);
  });

  it('GET /candidatos-representante/:id requires auth', async () => {
    const response = await fastify.inject({ method: 'GET', url: `/candidatos-representante/${createdId}` });
    expect(response.statusCode).toBe(401);
  });

  it('PATCH /candidatos-representante/:id requires auth', async () => {
    const response = await fastify.inject({
      method: 'PATCH',
      url: `/candidatos-representante/${createdId}`,
      payload: { status: 'EM_ANALISE' },
    });
    expect(response.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/candidatos-representante.test.ts`
Expected: FAIL — `Cannot find module '@/routes/candidatos-representante'` (file doesn't exist yet).

- [ ] **Step 3: Write the route file**

Create `backend/src/routes/candidatos-representante.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '@/middleware/auth';
import { enviarEmailNovaCandidaturaRepresentante } from '@/services/email.service';

const PERFIS = ['INDICADOR', 'REPRESENTANTE', 'FRANQUEADO'] as const;
const STATUS = ['NOVO', 'EM_ANALISE', 'APROVADO', 'REPROVADO'] as const;

const CandidatoSchema = z.object({
  nome:             z.string().min(1),
  empresa:          z.string().optional(),
  nome_fantasia:    z.string().optional(),
  cnpj:             z.string().optional(),
  cpf_responsavel:  z.string().optional(),
  telefone:         z.string().min(1),
  email:            z.string().email(),
  cidade:           z.string().optional(),
  estado:           z.string().optional(),
  perfil_desejado:  z.enum(PERFIS),
  respostas_detalhadas: z.record(z.any()),
});

const UpdateSchema = z.object({
  status:                z.enum(STATUS).optional(),
  observacoes_internas:  z.string().optional(),
});

// Campos retornados na listagem — sem `respostas_detalhadas` (payload leve do kanban).
const CAMPOS_LISTA = {
  id: true, nome: true, empresa: true, nome_fantasia: true, cnpj: true,
  cpf_responsavel: true, telefone: true, email: true, cidade: true, estado: true,
  perfil_desejado: true, status: true, observacoes_internas: true,
  created_at: true, updated_at: true,
} as const;

export async function candidatosRepresentanteRoutes(
  fastify: FastifyInstance,
  options: { prisma: PrismaClient }
) {
  const { prisma } = options;

  // Rota pública — sem requireAuth. Usada pelo wizard /parceiro.
  fastify.post('/candidatos-representante', async (request, reply) => {
    const body = CandidatoSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    }

    const candidato = await prisma.candidatoRepresentante.create({ data: body.data });

    enviarEmailNovaCandidaturaRepresentante(candidato).catch((err) => {
      console.error('[CANDIDATOS-REPRESENTANTE] Falha ao enviar e-mail de notificação:', err?.message || err);
    });

    return reply.status(201).send({ status: 'success', data: candidato });
  });

  fastify.get('/candidatos-representante', { onRequest: requireAuth }, async (request, reply) => {
    const { status } = request.query as { status?: string };
    const candidatos = await prisma.candidatoRepresentante.findMany({
      where: status ? { status } : {},
      select: CAMPOS_LISTA,
      orderBy: { created_at: 'desc' },
    });
    return reply.send({ status: 'success', data: candidatos });
  });

  fastify.get('/candidatos-representante/:id', { onRequest: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const candidato = await prisma.candidatoRepresentante.findUnique({ where: { id } });
    if (!candidato) {
      return reply.status(404).send({ status: 'error', message: 'Candidatura não encontrada' });
    }
    return reply.send({ status: 'success', data: candidato });
  });

  fastify.patch('/candidatos-representante/:id', { onRequest: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ status: 'error', message: 'Dados inválidos' });
    }
    const candidato = await prisma.candidatoRepresentante.update({ where: { id }, data: body.data });
    return reply.send({ status: 'success', data: candidato });
  });
}
```

- [ ] **Step 4: Register the route in server.ts**

In `backend/src/server.ts`, inside the `routeModules` array (around line 367, right after the `csat` entry), add:

```typescript
    ['candidatos-representante', () => import('./routes/candidatos-representante'), 'candidatosRepresentanteRoutes'],
```

- [ ] **Step 5: Add a temporary stub for `enviarEmailNovaCandidaturaRepresentante` so the test can run**

This function is fully implemented in Task 3. To make Task 2's test runnable in isolation, append this stub at the end of `backend/src/services/email.service.ts` now (Task 3 will replace the stub body with the real implementation — same export name and signature, so no further changes to `candidatos-representante.ts` are needed):

```typescript
export async function enviarEmailNovaCandidaturaRepresentante(candidato: {
  nome: string; empresa?: string | null; telefone: string; email: string;
  cidade?: string | null; estado?: string | null; perfil_desejado: string;
  respostas_detalhadas: any;
}): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'not implemented yet' };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/candidatos-representante.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/candidatos-representante.ts backend/src/server.ts backend/src/services/email.service.ts backend/tests/candidatos-representante.test.ts
git commit -m "feat: rotas de candidatos a representante (pública + autenticadas)"
```

---

### Task 3: Email notification

**Files:**
- Modify: `backend/src/services/email.service.ts` (replace Task 2's stub with the real implementation)

**Interfaces:**
- Consumes: nothing new (uses `nodemailer` transporter already set up via `createTransporter()` at `backend/src/services/email.service.ts:5`).
- Produces: `enviarEmailNovaCandidaturaRepresentante(candidato): Promise<{ ok: boolean; error?: string }>` — same signature as the Task 2 stub, so `candidatos-representante.ts` requires no changes.

- [ ] **Step 1: Replace the stub with the real implementation**

In `backend/src/services/email.service.ts`, find the stub added in Task 2 (`export async function enviarEmailNovaCandidaturaRepresentante...`) and replace its entire body:

```typescript
export async function enviarEmailNovaCandidaturaRepresentante(candidato: {
  nome: string; empresa?: string | null; telefone: string; email: string;
  cidade?: string | null; estado?: string | null; perfil_desejado: string;
  respostas_detalhadas: any;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SMTP_USER) {
    console.warn('[EMAIL] SMTP_USER não configurado — e-mail não enviado');
    return { ok: false, error: 'SMTP não configurado' };
  }

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER!;
  const fromName  = process.env.SMTP_FROM_NAME  || 'ProSystem Sistemas';
  const appUrl    = process.env.FRONTEND_URL     || 'https://crmcomercialprosystem-eu96iiiml.vercel.app';
  const destinatario = 'jessica@prosystemnet.com.br';

  const PERFIL_LABEL: Record<string, string> = {
    INDICADOR: 'Indicador',
    REPRESENTANTE: 'Representante',
    FRANQUEADO: 'Franqueado',
  };

  const estados: string[] = candidato.respostas_detalhadas?.regiao_atuacao?.estados || [];
  const apresentacao: string = candidato.respostas_detalhadas?.apresentacao_operacao || '';
  const resumoApresentacao = apresentacao.length > 240 ? apresentacao.slice(0, 240) + '…' : apresentacao;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:'Segoe UI',Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F4F7FB;padding:32px 16px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                       box-shadow:0 4px 24px rgba(13,34,56,0.10);max-width:600px;">
          <tr>
            <td style="background:linear-gradient(135deg,#0D2238 0%,#1A4E82 60%,#2E6EAB 100%);padding:40px 40px 36px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                Pro<span style="color:#90BEF0;">System</span>
              </p>
              <p style="margin:0;font-size:12px;color:#6AAAE5;letter-spacing:2px;text-transform:uppercase;">
                Nova Candidatura de Parceiro
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 16px;font-size:16px;color:#0D2238;">
                Uma nova candidatura de <strong>${PERFIL_LABEL[candidato.perfil_desejado] || candidato.perfil_desejado}</strong> foi recebida:
              </p>
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;">
                <tr><td style="padding:6px 0;font-size:14px;color:#4A6E8A;">Nome</td><td style="padding:6px 0;font-size:14px;color:#0D2238;font-weight:600;">${candidato.nome}</td></tr>
                ${candidato.empresa ? `<tr><td style="padding:6px 0;font-size:14px;color:#4A6E8A;">Empresa</td><td style="padding:6px 0;font-size:14px;color:#0D2238;font-weight:600;">${candidato.empresa}</td></tr>` : ''}
                <tr><td style="padding:6px 0;font-size:14px;color:#4A6E8A;">Telefone</td><td style="padding:6px 0;font-size:14px;color:#0D2238;font-weight:600;">${candidato.telefone}</td></tr>
                <tr><td style="padding:6px 0;font-size:14px;color:#4A6E8A;">E-mail</td><td style="padding:6px 0;font-size:14px;color:#0D2238;font-weight:600;">${candidato.email}</td></tr>
                <tr><td style="padding:6px 0;font-size:14px;color:#4A6E8A;">Cidade/UF sede</td><td style="padding:6px 0;font-size:14px;color:#0D2238;font-weight:600;">${candidato.cidade || '—'}${candidato.estado ? '/' + candidato.estado : ''}</td></tr>
                ${estados.length ? `<tr><td style="padding:6px 0;font-size:14px;color:#4A6E8A;">Estados de atuação</td><td style="padding:6px 0;font-size:14px;color:#0D2238;font-weight:600;">${estados.join(', ')}</td></tr>` : ''}
                ${resumoApresentacao ? `<tr><td style="padding:6px 0;font-size:14px;color:#4A6E8A;vertical-align:top;">Apresentação</td><td style="padding:6px 0;font-size:14px;color:#0D2238;">${resumoApresentacao}</td></tr>` : ''}
              </table>
              <a href="${appUrl}/representantes" style="display:inline-block;background:#2E6EAB;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">
                Ver ficha completa no CRM
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: destinatario,
      subject: `Nova candidatura de parceiro — ${candidato.nome}`,
      html,
    });
    return { ok: true };
  } catch (error: any) {
    console.error('[EMAIL] Falha ao enviar notificação de candidatura:', error?.message || error);
    return { ok: false, error: error?.message || 'Erro desconhecido' };
  }
}
```

- [ ] **Step 2: Run the Task 2 test suite again to confirm nothing broke**

Run: `cd backend && npx vitest run tests/candidatos-representante.test.ts`
Expected: All 6 tests still PASS (the POST test doesn't assert on email delivery, only on the DB record, so this is a regression check).

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/email.service.ts
git commit -m "feat: e-mail de notificação de nova candidatura de representante"
```

---

### Task 4: Public wizard page `/parceiro` — shell, state, Steps 1–5

**Files:**
- Create: `frontend/app/parceiro/page.tsx`
- Create: `frontend/app/parceiro/steps.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (frontend-only until submit).
- Produces: `FormState` type and `FORM_INICIAL` constant in `steps.tsx`, consumed by Task 5 (Steps 6–10) and by `page.tsx`'s submit handler, which calls `POST ${NEXT_PUBLIC_API_URL}/candidatos-representante` (Task 2) with a payload shaped exactly like `CandidatoSchema` from Task 2 Step 3 (`nome, empresa, nome_fantasia, cnpj, cpf_responsavel, telefone, email, cidade, estado, perfil_desejado, respostas_detalhadas`).

- [ ] **Step 1: Write `steps.tsx` with shared types and Steps 1–5**

Create `frontend/app/parceiro/steps.tsx`:

```tsx
'use client';

export interface FormState {
  // Passo 1 — campos-chave
  nome: string;
  empresa: string;
  nome_fantasia: string;
  cnpj: string;
  cpf_responsavel: string;
  telefone: string;
  email: string;
  cidade: string;
  estado: string;

  // Passo 2 — estrutura da empresa
  possui_equipe: boolean | null;
  qtd_pessoas_equipe: string;
  funcao_comercial: string;
  funcao_vendas: string;
  funcao_implantacao: string;
  funcao_instalacao: string;
  funcao_suporte: string;
  funcao_treinamento: string;
  funcao_administrativo: string;
  funcao_outros: string;
  qtd_dedicada_prosystem: string;
  equipe_propria_ou_terceirizada: string;

  // Passo 3 — estrutura comercial
  responsavel_vendas: string;
  qtd_prospeccao_venda: string;
  visita_presencial: boolean | null;
  prospeccao_ativa: boolean | null;
  canais_prospeccao: string[];
  canal_prospeccao_outros: string;

  // Passo 4 — instalação/implantação/treinamento
  realiza_instalacao: boolean | null;
  quem_instala: string;
  qtd_instaladores: string;
  experiencia_erp_pdv_instalacao: boolean | null;
  experiencia_config_equipamentos: boolean | null;
  realiza_implantacao: boolean | null;
  realiza_treinamento: boolean | null;
  qtd_treinadores: string;

  // Passo 5 — suporte
  presta_suporte: boolean | null;
  tipos_suporte: string[];
  tipo_suporte_outros: string;
  suporte_responsavel: string;
  suporte_qtd_pessoas: string;
  suporte_horario: string;
  suporte_experiencia_anterior: boolean | null;

  // Passo 6 — região de atuação
  estados_atuacao: string;
  regiao_principal: string;
  cidades: { nome: string; tipo: 'PRESENCIAL' | 'REMOTO' }[];
  atende_todas_presencial: boolean | null;
  veiculo_proprio: boolean | null;
  distancia_maxima: string;

  // Passo 7 — experiência no mercado
  tempo_atuacao: string;
  trabalhou_software_gestao: boolean | null;
  experiencia_erp_pdv_mercado: boolean | null;
  segmentos_experiencia: string[];
  segmento_outros: string;
  possui_carteira: boolean | null;
  qtd_clientes_aprox: string;

  // Passo 8 — marcas atuais
  representa_outras_marcas: boolean | null;
  marcas: { marca: string; produto_servico: string; segmento: string }[];
  tempo_representacao_marcas: string;
  exclusividade: string;
  atua_com: string[];
  representa_concorrente: boolean | null;
  concorrente_qual: string;
  tem_impedimento: boolean | null;
  impedimento_descricao: string;

  // Passo 9 — capacidade e expansão
  prospectar_mes: string;
  fechar_mes: string;
  implantar_mes: string;
  acompanha_prospeccao_pos_venda: boolean | null;
  etapas_atua: string[];

  // Passo 10 — apresentação + perfil desejado
  apresentacao_operacao: string;
  perfil_desejado: string;
}

export const FORM_INICIAL: FormState = {
  nome: '', empresa: '', nome_fantasia: '', cnpj: '', cpf_responsavel: '', telefone: '', email: '', cidade: '', estado: '',
  possui_equipe: null, qtd_pessoas_equipe: '', funcao_comercial: '', funcao_vendas: '', funcao_implantacao: '',
  funcao_instalacao: '', funcao_suporte: '', funcao_treinamento: '', funcao_administrativo: '', funcao_outros: '',
  qtd_dedicada_prosystem: '', equipe_propria_ou_terceirizada: '',
  responsavel_vendas: '', qtd_prospeccao_venda: '', visita_presencial: null, prospeccao_ativa: null,
  canais_prospeccao: [], canal_prospeccao_outros: '',
  realiza_instalacao: null, quem_instala: '', qtd_instaladores: '', experiencia_erp_pdv_instalacao: null,
  experiencia_config_equipamentos: null, realiza_implantacao: null, realiza_treinamento: null, qtd_treinadores: '',
  presta_suporte: null, tipos_suporte: [], tipo_suporte_outros: '', suporte_responsavel: '', suporte_qtd_pessoas: '',
  suporte_horario: '', suporte_experiencia_anterior: null,
  estados_atuacao: '', regiao_principal: '', cidades: [], atende_todas_presencial: null, veiculo_proprio: null,
  distancia_maxima: '',
  tempo_atuacao: '', trabalhou_software_gestao: null, experiencia_erp_pdv_mercado: null, segmentos_experiencia: [],
  segmento_outros: '', possui_carteira: null, qtd_clientes_aprox: '',
  representa_outras_marcas: null, marcas: [], tempo_representacao_marcas: '', exclusividade: '', atua_com: [],
  representa_concorrente: null, concorrente_qual: '', tem_impedimento: null, impedimento_descricao: '',
  prospectar_mes: '', fechar_mes: '', implantar_mes: '', acompanha_prospeccao_pos_venda: null, etapas_atua: [],
  apresentacao_operacao: '', perfil_desejado: '',
};

/** Converte o FormState plano em payload no formato esperado pelo backend. */
export function paraPayload(f: FormState) {
  return {
    nome: f.nome,
    empresa: f.empresa || undefined,
    nome_fantasia: f.nome_fantasia || undefined,
    cnpj: f.cnpj || undefined,
    cpf_responsavel: f.cpf_responsavel || undefined,
    telefone: f.telefone,
    email: f.email,
    cidade: f.cidade || undefined,
    estado: f.estado || undefined,
    perfil_desejado: f.perfil_desejado,
    respostas_detalhadas: {
      estrutura_empresa: {
        possui_equipe: f.possui_equipe, qtd_pessoas: f.qtd_pessoas_equipe,
        funcoes: {
          comercial: f.funcao_comercial, vendas: f.funcao_vendas, implantacao: f.funcao_implantacao,
          instalacao: f.funcao_instalacao, suporte: f.funcao_suporte, treinamento: f.funcao_treinamento,
          administrativo: f.funcao_administrativo, outros: f.funcao_outros,
        },
        qtd_dedicada_prosystem: f.qtd_dedicada_prosystem, equipe_propria_ou_terceirizada: f.equipe_propria_ou_terceirizada,
      },
      estrutura_comercial: {
        responsavel_vendas: f.responsavel_vendas, qtd_prospeccao_venda: f.qtd_prospeccao_venda,
        visita_presencial: f.visita_presencial, prospeccao_ativa: f.prospeccao_ativa,
        canais: f.canais_prospeccao, canal_outros: f.canal_prospeccao_outros,
      },
      instalacao_implantacao: {
        realiza_instalacao: f.realiza_instalacao, quem_instala: f.quem_instala, qtd_instaladores: f.qtd_instaladores,
        experiencia_erp_pdv: f.experiencia_erp_pdv_instalacao, experiencia_config_equipamentos: f.experiencia_config_equipamentos,
        realiza_implantacao: f.realiza_implantacao, realiza_treinamento: f.realiza_treinamento, qtd_treinadores: f.qtd_treinadores,
      },
      suporte: {
        presta_suporte: f.presta_suporte, tipos: f.tipos_suporte, tipo_outros: f.tipo_suporte_outros,
        responsavel: f.suporte_responsavel, qtd_pessoas: f.suporte_qtd_pessoas, horario: f.suporte_horario,
        experiencia_anterior: f.suporte_experiencia_anterior,
      },
      regiao_atuacao: {
        estados: f.estados_atuacao.split(',').map(s => s.trim()).filter(Boolean), regiao_principal: f.regiao_principal,
        cidades: f.cidades, atende_todas_presencial: f.atende_todas_presencial, veiculo_proprio: f.veiculo_proprio,
        distancia_maxima: f.distancia_maxima,
      },
      experiencia_mercado: {
        tempo_atuacao: f.tempo_atuacao, trabalhou_software_gestao: f.trabalhou_software_gestao,
        experiencia_erp_pdv: f.experiencia_erp_pdv_mercado, segmentos: f.segmentos_experiencia,
        segmento_outros: f.segmento_outros, possui_carteira: f.possui_carteira, qtd_clientes_aprox: f.qtd_clientes_aprox,
      },
      marcas_atuais: {
        representa_outras: f.representa_outras_marcas, marcas: f.marcas,
        tempo_representacao: f.tempo_representacao_marcas, exclusividade: f.exclusividade, atua_com: f.atua_com,
        representa_concorrente: f.representa_concorrente, concorrente_qual: f.concorrente_qual,
        tem_impedimento: f.tem_impedimento, impedimento_descricao: f.impedimento_descricao,
      },
      capacidade_expansao: {
        prospectar_mes: f.prospectar_mes, fechar_mes: f.fechar_mes, implantar_mes: f.implantar_mes,
        acompanha_prospeccao_pos_venda: f.acompanha_prospeccao_pos_venda, etapas_atua: f.etapas_atua,
      },
      apresentacao_operacao: f.apresentacao_operacao,
    },
  };
}

// ─── Componentes de campo reutilizáveis ─────────────────────────────────────

export function Campo({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 14, color: '#0D2238' }}
      />
    </div>
  );
}

export function CampoTextarea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 14, color: '#0D2238', fontFamily: 'inherit', resize: 'vertical' }}
      />
    </div>
  );
}

export function CampoSimNao({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', gap: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0D2238' }}>
          <input type="radio" checked={value === true} onChange={() => onChange(true)} /> Sim
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0D2238' }}>
          <input type="radio" checked={value === false} onChange={() => onChange(false)} /> Não
        </label>
      </div>
    </div>
  );
}

export function CampoMultiSelect({ label, opcoes, value, onChange }: { label: string; opcoes: { valor: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  function toggle(valor: string) {
    onChange(value.includes(valor) ? value.filter(v => v !== valor) : [...value, valor]);
  }
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {opcoes.map(o => (
          <label key={o.valor} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0D2238', border: '1px solid #E2ECF5', borderRadius: 8, padding: '6px 10px' }}>
            <input type="checkbox" checked={value.includes(o.valor)} onChange={() => toggle(o.valor)} /> {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Passo 1 — Dados do representante ───────────────────────────────────────

export function Passo1({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Campo label="Nome completo *" value={f.nome} onChange={v => set('nome', v)} />
      <Campo label="Nome da empresa / Razão Social" value={f.empresa} onChange={v => set('empresa', v)} />
      <Campo label="Nome fantasia" value={f.nome_fantasia} onChange={v => set('nome_fantasia', v)} />
      <Campo label="CNPJ" value={f.cnpj} onChange={v => set('cnpj', v)} />
      <Campo label="CPF do responsável" value={f.cpf_responsavel} onChange={v => set('cpf_responsavel', v)} />
      <Campo label="Telefone / WhatsApp *" value={f.telefone} onChange={v => set('telefone', v)} />
      <Campo label="E-mail *" value={f.email} onChange={v => set('email', v)} type="email" />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <Campo label="Cidade sede" value={f.cidade} onChange={v => set('cidade', v)} />
        <Campo label="UF sede" value={f.estado} onChange={v => set('estado', v)} />
      </div>
    </div>
  );
}

// ─── Passo 2 — Estrutura da empresa ─────────────────────────────────────────

export function Passo2({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <CampoSimNao label="Possui equipe?" value={f.possui_equipe} onChange={v => set('possui_equipe', v)} />
      <Campo label="Quantas pessoas fazem parte da equipe?" value={f.qtd_pessoas_equipe} onChange={v => set('qtd_pessoas_equipe', v)} />
      <p style={{ fontSize: 12, fontWeight: 700, color: '#0D2238', marginTop: 8 }}>Pessoas por função e o que cada uma faz:</p>
      <Campo label="Comercial / Prospecção" value={f.funcao_comercial} onChange={v => set('funcao_comercial', v)} />
      <Campo label="Vendas / Fechamento" value={f.funcao_vendas} onChange={v => set('funcao_vendas', v)} />
      <Campo label="Implantação" value={f.funcao_implantacao} onChange={v => set('funcao_implantacao', v)} />
      <Campo label="Instalação" value={f.funcao_instalacao} onChange={v => set('funcao_instalacao', v)} />
      <Campo label="Suporte" value={f.funcao_suporte} onChange={v => set('funcao_suporte', v)} />
      <Campo label="Treinamento" value={f.funcao_treinamento} onChange={v => set('funcao_treinamento', v)} />
      <Campo label="Administrativo" value={f.funcao_administrativo} onChange={v => set('funcao_administrativo', v)} />
      <Campo label="Outros" value={f.funcao_outros} onChange={v => set('funcao_outros', v)} />
      <Campo label="Quantas pessoas estarão dedicadas à representação da Prosystem?" value={f.qtd_dedicada_prosystem} onChange={v => set('qtd_dedicada_prosystem', v)} />
      <Campo label="A equipe é própria ou terceirizada?" value={f.equipe_propria_ou_terceirizada} onChange={v => set('equipe_propria_ou_terceirizada', v)} />
    </div>
  );
}

// ─── Passo 3 — Estrutura comercial ──────────────────────────────────────────

const CANAIS_PROSPECCAO = [
  { valor: 'VISITA_PRESENCIAL', label: 'Visita presencial' },
  { valor: 'TELEFONE', label: 'Telefone' },
  { valor: 'WHATSAPP', label: 'WhatsApp' },
  { valor: 'REDES_SOCIAIS', label: 'Redes sociais' },
  { valor: 'INDICACOES', label: 'Indicações' },
  { valor: 'TRAFEGO_PAGO', label: 'Tráfego pago' },
];

export function Passo3({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Campo label="Quem será responsável pelas vendas do sistema?" value={f.responsavel_vendas} onChange={v => set('responsavel_vendas', v)} />
      <Campo label="Quantas pessoas atuarão diretamente na prospecção e venda?" value={f.qtd_prospeccao_venda} onChange={v => set('qtd_prospeccao_venda', v)} />
      <CampoSimNao label="Realiza visitas presenciais aos clientes?" value={f.visita_presencial} onChange={v => set('visita_presencial', v)} />
      <CampoSimNao label="Realiza prospecção ativa?" value={f.prospeccao_ativa} onChange={v => set('prospeccao_ativa', v)} />
      <CampoMultiSelect label="Quais canais utiliza para prospectar clientes?" opcoes={CANAIS_PROSPECCAO} value={f.canais_prospeccao} onChange={v => set('canais_prospeccao', v)} />
      <Campo label="Outros canais (opcional)" value={f.canal_prospeccao_outros} onChange={v => set('canal_prospeccao_outros', v)} />
    </div>
  );
}

// ─── Passo 4 — Instalação, implantação e treinamento ───────────────────────

export function Passo4({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <CampoSimNao label="Realiza instalação de sistemas no cliente?" value={f.realiza_instalacao} onChange={v => set('realiza_instalacao', v)} />
      <Campo label="Quem realiza a instalação?" value={f.quem_instala} onChange={v => set('quem_instala', v)} />
      <Campo label="Quantas pessoas da equipe realizam instalações?" value={f.qtd_instaladores} onChange={v => set('qtd_instaladores', v)} />
      <CampoSimNao label="Possui experiência com instalação de ERP, PDV ou sistemas de gestão?" value={f.experiencia_erp_pdv_instalacao} onChange={v => set('experiencia_erp_pdv_instalacao', v)} />
      <CampoSimNao label="Possui experiência com configuração de computadores, impressoras, rede e equipamentos de PDV?" value={f.experiencia_config_equipamentos} onChange={v => set('experiencia_config_equipamentos', v)} />
      <CampoSimNao label="Realiza implantação e configuração inicial do sistema?" value={f.realiza_implantacao} onChange={v => set('realiza_implantacao', v)} />
      <CampoSimNao label="Realiza treinamento dos usuários após a implantação?" value={f.realiza_treinamento} onChange={v => set('realiza_treinamento', v)} />
      <Campo label="Quantas pessoas da equipe podem realizar treinamento?" value={f.qtd_treinadores} onChange={v => set('qtd_treinadores', v)} />
    </div>
  );
}

// ─── Passo 5 — Suporte ao cliente ───────────────────────────────────────────

const TIPOS_SUPORTE = [
  { valor: 'PRESENCIAL', label: 'Presencial' },
  { valor: 'TELEFONE', label: 'Telefone' },
  { valor: 'WHATSAPP', label: 'WhatsApp' },
  { valor: 'REMOTO', label: 'Acesso remoto' },
  { valor: 'TREINAMENTO', label: 'Treinamento' },
  { valor: 'TECNICO_BASICO', label: 'Suporte técnico básico' },
];

export function Passo5({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <CampoSimNao label="Presta suporte aos clientes após a venda?" value={f.presta_suporte} onChange={v => set('presta_suporte', v)} />
      <CampoMultiSelect label="Quais tipos de suporte consegue oferecer?" opcoes={TIPOS_SUPORTE} value={f.tipos_suporte} onChange={v => set('tipos_suporte', v)} />
      <Campo label="Outros (opcional)" value={f.tipo_suporte_outros} onChange={v => set('tipo_suporte_outros', v)} />
      <Campo label="Quem é responsável pelo suporte na equipe?" value={f.suporte_responsavel} onChange={v => set('suporte_responsavel', v)} />
      <Campo label="Quantas pessoas realizam suporte?" value={f.suporte_qtd_pessoas} onChange={v => set('suporte_qtd_pessoas', v)} />
      <Campo label="Qual o horário de atendimento do suporte?" value={f.suporte_horario} onChange={v => set('suporte_horario', v)} />
      <CampoSimNao label="Possui experiência anterior com suporte de software?" value={f.suporte_experiencia_anterior} onChange={v => set('suporte_experiencia_anterior', v)} />
    </div>
  );
}
```

- [ ] **Step 2: Write the wizard shell in `page.tsx` (Steps 1–5 wired up, submit disabled until Task 5 adds Steps 6–10)**

Create `frontend/app/parceiro/page.tsx`. This file will be extended in Task 5 to include Steps 6–10; for now it renders all 10 step numbers but only Steps 1–5 have real content (Steps 6–10 render a placeholder paragraph until Task 5).

```tsx
'use client';

import { useState } from 'react';
import axios from 'axios';
import { CheckCircle2, Loader2, Handshake, ChevronLeft, ChevronRight } from 'lucide-react';
import { FormState, FORM_INICIAL, paraPayload, Passo1, Passo2, Passo3, Passo4, Passo5 } from './steps';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const PERFIS = [
  { valor: 'INDICADOR', titulo: 'Indicador', descricao: 'Apenas faz a indicação dos produtos e recebe um valor correspondente à instalação.', percentual: '30% referente ao valor da instalação' },
  { valor: 'REPRESENTANTE', titulo: 'Representante', descricao: 'Faz a prospecção de novos clientes e a instalação presencialmente do software.', percentual: '50% referente ao valor da instalação' },
  { valor: 'FRANQUEADO', titulo: 'Franqueado', descricao: 'Responsável por fazer prospecção, instalação, treinamento e suporte técnico.', percentual: '50% da instalação + 50% da mensalidade' },
];

const BENEFICIOS = [
  'Direito de uso da marca e venda dos produtos Prosystem Sistemas',
  'Treinamento inicial e contínuo',
  'Know how e estrutura da empresa',
  'Respaldo de uma empresa estruturada e com visão de mercado',
  'Acesso a toda tecnologia emergente de automação comercial (ECF, NF-e, NFC-e, PAF-ECF etc.)',
  'Facilidade para a prestação de suporte técnico',
];

const TITULOS_PASSOS = [
  'Dados do representante', 'Estrutura da empresa', 'Estrutura comercial',
  'Instalação, implantação e treinamento', 'Suporte ao cliente', 'Região de atuação',
  'Experiência no mercado', 'Marcas que representa', 'Capacidade de atendimento',
  'Apresentação da operação',
];

export default function ParceiroPage() {
  const [passo, setPasso] = useState(0);
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  function set<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  const podeAvancarPasso1 = form.nome.trim() && form.telefone.trim() && form.email.trim();

  function avancar() {
    if (passo === 0 && !podeAvancarPasso1) {
      setErro('Preencha nome, telefone e e-mail para continuar.');
      return;
    }
    setErro('');
    setPasso(p => Math.min(p + 1, TITULOS_PASSOS.length - 1));
  }

  function voltar() {
    setErro('');
    setPasso(p => Math.max(p - 1, 0));
  }

  async function enviar() {
    if (!form.perfil_desejado) {
      setErro('Selecione o perfil desejado antes de enviar.');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      await axios.post(`${API_URL}/candidatos-representante`, paraPayload(form));
      setEnviado(true);
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Não foi possível enviar sua candidatura. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div style={{ minHeight: '100vh', background: '#F4F7FB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 48, maxWidth: 480, textAlign: 'center', boxShadow: '0 4px 24px rgba(13,34,56,0.10)' }}>
          <CheckCircle2 size={48} color="#2E6EAB" style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0D2238', marginBottom: 8 }}>Candidatura recebida!</h1>
          <p style={{ fontSize: 14, color: '#4A6E8A' }}>Obrigado pelo interesse em ser parceiro Prosystem. Nossa equipe vai analisar seus dados e entrar em contato em breve.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FB', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <div style={{ background: 'linear-gradient(135deg,#0D2238 0%,#1A4E82 60%,#2E6EAB 100%)', padding: '56px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            Pro<span style={{ color: '#90BEF0' }}>System</span>
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginTop: 16, marginBottom: 12 }}>
            Venha ser parceiro da Prosystem Desenvolvimento de Sistemas
          </h1>
          <p style={{ fontSize: 14, color: '#B8D4EF', lineHeight: 1.6 }}>
            Representação Comercial &amp; Outsourcing — a Prosystem atua no mercado com fornecimento de software de
            automação comercial para diversos segmentos: drogarias, farmácias de manipulação, lojas, oficinas e
            comércio em geral. Estamos buscando novas parcerias para ampliar nosso grupo.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, marginBottom: 24, boxShadow: '0 1px 3px rgba(13,34,56,0.05)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0D2238', marginBottom: 16 }}>O que você ganha como parceiro</h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {BENEFICIOS.map(b => (
              <li key={b} style={{ fontSize: 14, color: '#4A6E8A', marginBottom: 8, lineHeight: 1.5 }}>{b}</li>
            ))}
          </ul>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 32, marginBottom: 24, boxShadow: '0 1px 3px rgba(13,34,56,0.05)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0D2238', marginBottom: 16 }}>Perfis de parceria</h2>
          <div style={{ display: 'grid', gap: 16 }}>
            {PERFIS.map(p => (
              <div key={p.valor} style={{ border: '1px solid #E2ECF5', borderRadius: 12, padding: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#2E6EAB', marginBottom: 4 }}>{p.titulo}</p>
                <p style={{ fontSize: 13, color: '#4A6E8A', marginBottom: 6, lineHeight: 1.5 }}>{p.descricao}</p>
                <p style={{ fontSize: 12, color: '#0D2238', fontWeight: 600 }}>{p.percentual}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 1px 3px rgba(13,34,56,0.05)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0D2238', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Handshake size={18} color="#2E6EAB" /> Ficha de Cadastro e Qualificação
          </h2>
          <p style={{ fontSize: 12, color: '#4A6E8A', marginBottom: 4 }}>
            Etapa {passo + 1} de {TITULOS_PASSOS.length} — {TITULOS_PASSOS[passo]}
          </p>
          <div style={{ height: 6, background: '#E2ECF5', borderRadius: 3, marginBottom: 24, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${((passo + 1) / TITULOS_PASSOS.length) * 100}%`, background: '#2E6EAB', transition: 'width 0.2s' }} />
          </div>

          {passo === 0 && <Passo1 f={form} set={set} />}
          {passo === 1 && <Passo2 f={form} set={set} />}
          {passo === 2 && <Passo3 f={form} set={set} />}
          {passo === 3 && <Passo4 f={form} set={set} />}
          {passo === 4 && <Passo5 f={form} set={set} />}
          {passo >= 5 && <p style={{ fontSize: 13, color: '#4A6E8A' }}>Etapa {passo + 1} será implementada na próxima tarefa.</p>}

          {erro && <p style={{ fontSize: 13, color: '#DC2626', marginTop: 16 }}>{erro}</p>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button
              onClick={voltar}
              disabled={passo === 0}
              style={{ background: 'transparent', color: '#2E6EAB', border: '1px solid #2E6EAB', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: passo === 0 ? 'default' : 'pointer', opacity: passo === 0 ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <ChevronLeft size={16} /> Voltar
            </button>
            {passo < TITULOS_PASSOS.length - 1 ? (
              <button
                onClick={avancar}
                style={{ background: '#2E6EAB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                Avançar <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={enviar}
                disabled={enviando}
                style={{ background: '#2E6EAB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: enviando ? 'default' : 'pointer', opacity: enviando ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {enviando ? <Loader2 size={16} className="animate-spin" /> : null}
                {enviando ? 'Enviando...' : 'Enviar candidatura'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify Steps 1–5 render and navigation works**

Run: `cd frontend && npm run dev` (leave running), then in a browser go to `http://localhost:3000/parceiro`.
Expected: page loads without a login redirect, shows institutional header, benefits, profile cards, and the wizard starting at "Etapa 1 de 10 — Dados do representante". Clicking "Avançar" without filling nome/telefone/e-mail shows the error message and does not advance. Fill those 3 fields, click "Avançar" repeatedly through Steps 2–5 (each should render its real fields) up to Step 6, which shows the "será implementada" placeholder. Click "Voltar" and confirm it returns to Step 5 with previously entered data intact. Stop the dev server after verifying (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/parceiro/page.tsx frontend/app/parceiro/steps.tsx
git commit -m "feat: wizard publico de candidatura a parceiro - shell e passos 1-5"
```

---

### Task 5: Public wizard page `/parceiro` — Steps 6–10 and final submit wiring

**Files:**
- Modify: `frontend/app/parceiro/steps.tsx` (append Passo6–Passo10 components and their option constants)
- Modify: `frontend/app/parceiro/page.tsx` (import and render Passo6–Passo10, remove the Step ≥5 placeholder)

**Interfaces:**
- Consumes: `FormState`, `Campo`, `CampoTextarea`, `CampoSimNao`, `CampoMultiSelect` from Task 4's `steps.tsx`.
- Produces: `Passo6, Passo7, Passo8, Passo9, Passo10` components with the same `{ f, set }` prop signature as Passo1–5, consumed by `page.tsx`.

- [ ] **Step 1: Append Steps 6–10 to `steps.tsx`**

At the end of `frontend/app/parceiro/steps.tsx`, add:

```tsx

// ─── Passo 6 — Região de atuação ────────────────────────────────────────────

export function Passo6({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  function addCidade() {
    set('cidades', [...f.cidades, { nome: '', tipo: 'PRESENCIAL' }]);
  }
  function updateCidade(i: number, patch: Partial<FormState['cidades'][number]>) {
    set('cidades', f.cidades.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }
  function removeCidade(i: number) {
    set('cidades', f.cidades.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Campo label="Estado(s) em que atua (separados por vírgula)" value={f.estados_atuacao} onChange={v => set('estados_atuacao', v)} />
      <Campo label="Região principal de atuação" value={f.regiao_principal} onChange={v => set('regiao_principal', v)} />

      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>Cidades em que possui atuação comercial</label>
        <div style={{ display: 'grid', gap: 8 }}>
          {f.cidades.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={c.nome}
                onChange={e => updateCidade(i, { nome: e.target.value })}
                placeholder="Cidade/UF"
                style={{ flex: 2, padding: '8px 10px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 13 }}
              />
              <select
                value={c.tipo}
                onChange={e => updateCidade(i, { tipo: e.target.value as 'PRESENCIAL' | 'REMOTO' })}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 13 }}
              >
                <option value="PRESENCIAL">Presencial</option>
                <option value="REMOTO">Remoto</option>
              </select>
              <button onClick={() => removeCidade(i)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>×</button>
            </div>
          ))}
        </div>
        <button onClick={addCidade} style={{ marginTop: 8, background: 'none', border: '1px dashed #2E6EAB', color: '#2E6EAB', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Adicionar cidade
        </button>
      </div>

      <CampoSimNao label="Consegue realizar atendimento presencial em todas essas cidades?" value={f.atende_todas_presencial} onChange={v => set('atende_todas_presencial', v)} />
      <CampoSimNao label="Possui veículo próprio para visitas e atendimento?" value={f.veiculo_proprio} onChange={v => set('veiculo_proprio', v)} />
      <Campo label="Qual distância máxima consegue percorrer para atendimento presencial?" value={f.distancia_maxima} onChange={v => set('distancia_maxima', v)} />
    </div>
  );
}

// ─── Passo 7 — Experiência no mercado ───────────────────────────────────────

const SEGMENTOS_EXPERIENCIA = [
  { valor: 'FARMACIAS', label: 'Farmácias' },
  { valor: 'DROGARIAS', label: 'Drogarias' },
  { valor: 'PADARIAS', label: 'Padarias' },
  { valor: 'MERCADOS', label: 'Mercados' },
  { valor: 'CONVENIENCIAS', label: 'Conveniências' },
];

export function Passo7({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Campo label="Há quanto tempo atua comercialmente?" value={f.tempo_atuacao} onChange={v => set('tempo_atuacao', v)} />
      <CampoSimNao label="Já trabalhou ou trabalha com software de gestão?" value={f.trabalhou_software_gestao} onChange={v => set('trabalhou_software_gestao', v)} />
      <CampoSimNao label="Possui experiência com ERP ou PDV?" value={f.experiencia_erp_pdv_mercado} onChange={v => set('experiencia_erp_pdv_mercado', v)} />
      <CampoMultiSelect label="Possui experiência nos seguintes segmentos:" opcoes={SEGMENTOS_EXPERIENCIA} value={f.segmentos_experiencia} onChange={v => set('segmentos_experiencia', v)} />
      <Campo label="Outros segmentos (opcional)" value={f.segmento_outros} onChange={v => set('segmento_outros', v)} />
      <CampoSimNao label="Já possui carteira de clientes nesses segmentos?" value={f.possui_carteira} onChange={v => set('possui_carteira', v)} />
      <Campo label="Se sim, aproximadamente quantos clientes ou contatos possui?" value={f.qtd_clientes_aprox} onChange={v => set('qtd_clientes_aprox', v)} />
    </div>
  );
}

// ─── Passo 8 — Marcas e empresas que representa atualmente ─────────────────

const ATUA_COM_OPCOES = [
  { valor: 'SOFTWARE', label: 'Software' },
  { valor: 'ERP', label: 'ERP' },
  { valor: 'PDV', label: 'PDV' },
  { valor: 'AUTOMACAO_COMERCIAL', label: 'Automação comercial' },
  { valor: 'SISTEMAS_FARMACIAS', label: 'Sistemas para farmácias' },
  { valor: 'SISTEMAS_PADARIAS', label: 'Sistemas para padarias' },
  { valor: 'TECNOLOGIA_VAREJO', label: 'Tecnologia para varejo' },
  { valor: 'NENHUMA', label: 'Nenhuma das anteriores' },
];

export function Passo8({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  function addMarca() {
    set('marcas', [...f.marcas, { marca: '', produto_servico: '', segmento: '' }]);
  }
  function updateMarca(i: number, patch: Partial<FormState['marcas'][number]>) {
    set('marcas', f.marcas.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  }
  function removeMarca(i: number) {
    set('marcas', f.marcas.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <CampoSimNao label="Atualmente representa outras empresas, marcas, produtos ou serviços?" value={f.representa_outras_marcas} onChange={v => set('representa_outras_marcas', v)} />

      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>Marcas que representa</label>
        <div style={{ display: 'grid', gap: 10 }}>
          {f.marcas.map((m, i) => (
            <div key={i} style={{ border: '1px solid #E2ECF5', borderRadius: 8, padding: 10, display: 'grid', gap: 6 }}>
              <input value={m.marca} onChange={e => updateMarca(i, { marca: e.target.value })} placeholder="Marca" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 13 }} />
              <input value={m.produto_servico} onChange={e => updateMarca(i, { produto_servico: e.target.value })} placeholder="Produto/Serviço" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 13 }} />
              <input value={m.segmento} onChange={e => updateMarca(i, { segmento: e.target.value })} placeholder="Segmento" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 13 }} />
              <button onClick={() => removeMarca(i)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 12, fontWeight: 700, justifySelf: 'start' }}>Remover</button>
            </div>
          ))}
        </div>
        <button onClick={addMarca} style={{ marginTop: 8, background: 'none', border: '1px dashed #2E6EAB', color: '#2E6EAB', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Adicionar marca
        </button>
      </div>

      <Campo label="Há quanto tempo representa essas marcas?" value={f.tempo_representacao_marcas} onChange={v => set('tempo_representacao_marcas', v)} />
      <Campo label="Essas representações são exclusivas ou não exclusivas?" value={f.exclusividade} onChange={v => set('exclusividade', v)} />
      <CampoMultiSelect label="Alguma dessas marcas atua com:" opcoes={ATUA_COM_OPCOES} value={f.atua_com} onChange={v => set('atua_com', v)} />
      <CampoSimNao label="Representa atualmente algum concorrente direto ou indireto da Prosystem?" value={f.representa_concorrente} onChange={v => set('representa_concorrente', v)} />
      {f.representa_concorrente && (
        <Campo label="Se sim, informe qual empresa ou marca" value={f.concorrente_qual} onChange={v => set('concorrente_qual', v)} />
      )}
      <CampoSimNao label="Existe algum contrato de exclusividade, restrição territorial ou impedimento?" value={f.tem_impedimento} onChange={v => set('tem_impedimento', v)} />
      {f.tem_impedimento && (
        <CampoTextarea label="Se sim, descreva" value={f.impedimento_descricao} onChange={v => set('impedimento_descricao', v)} />
      )}
    </div>
  );
}

// ─── Passo 9 — Capacidade de atendimento e expansão ────────────────────────

const ETAPAS_ATUACAO = [
  { valor: 'PROSPECCAO', label: 'Prospecção' },
  { valor: 'DEMONSTRACAO', label: 'Demonstração' },
  { valor: 'NEGOCIACAO', label: 'Negociação' },
  { valor: 'FECHAMENTO', label: 'Fechamento' },
  { valor: 'INSTALACAO', label: 'Instalação' },
  { valor: 'IMPLANTACAO', label: 'Implantação' },
  { valor: 'TREINAMENTO', label: 'Treinamento' },
  { valor: 'SUPORTE', label: 'Suporte' },
  { valor: 'POS_VENDA', label: 'Pós-venda' },
];

export function Passo9({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Campo label="Quantos novos clientes acredita conseguir prospectar por mês?" value={f.prospectar_mes} onChange={v => set('prospectar_mes', v)} />
      <Campo label="Quantos novos clientes acredita conseguir fechar por mês?" value={f.fechar_mes} onChange={v => set('fechar_mes', v)} />
      <Campo label="Quantos clientes sua estrutura consegue implantar por mês?" value={f.implantar_mes} onChange={v => set('implantar_mes', v)} />
      <CampoSimNao label="Consegue acompanhar o cliente desde a prospecção até o pós-venda?" value={f.acompanha_prospeccao_pos_venda} onChange={v => set('acompanha_prospeccao_pos_venda', v)} />
      <CampoMultiSelect label="Em quais etapas sua equipe consegue atuar diretamente?" opcoes={ETAPAS_ATUACAO} value={f.etapas_atua} onChange={v => set('etapas_atua', v)} />
    </div>
  );
}

// ─── Passo 10 — Apresentação da operação + perfil desejado ─────────────────

export function Passo10({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <CampoTextarea
        label="Descreva resumidamente sua estrutura atual, equipe, região de atuação, marcas que representa e como pretende desenvolver comercialmente a Prosystem em sua região:"
        value={f.apresentacao_operacao}
        onChange={v => set('apresentacao_operacao', v)}
        rows={6}
      />
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>Perfil desejado *</label>
        <select
          value={f.perfil_desejado}
          onChange={e => set('perfil_desejado', e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 14, color: '#0D2238' }}
        >
          <option value="">Selecione...</option>
          <option value="INDICADOR">Indicador</option>
          <option value="REPRESENTANTE">Representante</option>
          <option value="FRANQUEADO">Franqueado</option>
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire Steps 6–10 into `page.tsx`**

In `frontend/app/parceiro/page.tsx`, update the import line:

```tsx
import { FormState, FORM_INICIAL, paraPayload, Passo1, Passo2, Passo3, Passo4, Passo5 } from './steps';
```

to:

```tsx
import { FormState, FORM_INICIAL, paraPayload, Passo1, Passo2, Passo3, Passo4, Passo5, Passo6, Passo7, Passo8, Passo9, Passo10 } from './steps';
```

And replace:

```tsx
          {passo === 4 && <Passo5 f={form} set={set} />}
          {passo >= 5 && <p style={{ fontSize: 13, color: '#4A6E8A' }}>Etapa {passo + 1} será implementada na próxima tarefa.</p>}
```

with:

```tsx
          {passo === 4 && <Passo5 f={form} set={set} />}
          {passo === 5 && <Passo6 f={form} set={set} />}
          {passo === 6 && <Passo7 f={form} set={set} />}
          {passo === 7 && <Passo8 f={form} set={set} />}
          {passo === 8 && <Passo9 f={form} set={set} />}
          {passo === 9 && <Passo10 f={form} set={set} />}
```

- [ ] **Step 3: Verify the full wizard end-to-end, including submission**

With both `cd backend && npm run dev` and `cd frontend && npm run dev` running, go to `http://localhost:3000/parceiro`. Fill Step 1 (nome, telefone, email) and click through all 10 steps:
- On Step 6, click "+ Adicionar cidade" twice, fill both rows, remove one with "×" — confirm only one remains.
- On Step 8, click "+ Adicionar marca", fill it, toggle "Representa concorrente" to Sim — confirm the conditional "qual empresa" field appears.
- On Step 10, fill the "apresentação" textarea and select "Representante" as perfil desejado.
- Click "Enviar candidatura" — expect the "Candidatura recebida!" confirmation screen.
- Verify in the database or via `GET /candidatos-representante/:id` (with a valid token, e.g. through the browser devtools or a REST client) that the created record's `respostas_detalhadas` contains the city list, the brand list, and the apresentação text exactly as entered.
Stop both dev servers after verifying (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/parceiro/steps.tsx frontend/app/parceiro/page.tsx
git commit -m "feat: wizard publico de candidatura a parceiro - passos 6-10 e envio completo"
```

---

### Task 6: Internal kanban page `/representantes`

**Files:**
- Create: `frontend/app/representantes/page.tsx`
- Modify: `frontend/components/dashboard/DashboardLayout.tsx:56-60` (add nav item to the "Clientes & Base" group)

**Interfaces:**
- Consumes: `apiClient` from `frontend/lib/api-client.ts` (`GET/PATCH /candidatos-representante`, Task 2); `useAuth` from `frontend/lib/auth-context`; `DetalheCandidato` component from Task 7 (`frontend/app/representantes/DetalheCandidato.tsx`) — build this task with a TEMPORARY inline detail modal showing only key fields, which Task 7 replaces with the full accordion.
- Produces: standalone authenticated page, linked from the sidebar. Exports nothing (page component).

- [ ] **Step 1: Write the kanban page with a minimal detail modal (placeholder for Task 7)**

Create `frontend/app/representantes/page.tsx`:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { Handshake, Loader2, X } from 'lucide-react';

export interface CandidatoResumo {
  id: string;
  nome: string;
  empresa?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  cpf_responsavel?: string | null;
  telefone: string;
  email: string;
  cidade?: string | null;
  estado?: string | null;
  perfil_desejado: string;
  status: string;
  observacoes_internas?: string | null;
  created_at: string;
}

const COLUNAS = [
  { chave: 'NOVO', nome: 'Novo', cor: '#2563eb' },
  { chave: 'EM_ANALISE', nome: 'Em Análise', cor: '#d97706' },
  { chave: 'APROVADO', nome: 'Aprovado', cor: '#16a34a' },
  { chave: 'REPROVADO', nome: 'Reprovado', cor: '#9ca3af' },
];

export const PERFIL_LABEL: Record<string, string> = {
  INDICADOR: 'Indicador',
  REPRESENTANTE: 'Representante',
  FRANQUEADO: 'Franqueado',
};

export default function RepresentantesPage() {
  const [candidatos, setCandidatos] = useState<CandidatoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.client.get('/candidatos-representante');
      setCandidatos(res.data.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function moverStatus(candidato: CandidatoResumo, novoStatus: string) {
    setCandidatos(prev => prev.map(c => c.id === candidato.id ? { ...c, status: novoStatus } : c));
    await apiClient.client.patch(`/candidatos-representante/${candidato.id}`, { status: novoStatus });
  }

  const porColuna = (chave: string) => candidatos.filter(c => c.status === chave);
  const selecionado = candidatos.find(c => c.id === selecionadoId) || null;

  return (
    <DashboardLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Handshake size={18} color="var(--t-primary)" />
          <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t-text-primary)' }}>Representantes</h1>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Loader2 size={24} className="animate-spin" color="var(--t-primary)" />
          </div>
        ) : (
          <div
            style={{ display: 'flex', gap: 12, overflowX: 'auto' }}
            onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
          >
            {COLUNAS.map(col => {
              const lista = porColuna(col.chave);
              const isOver = dragOverCol === col.chave;
              return (
                <div
                  key={col.chave}
                  style={{
                    width: 260, flexShrink: 0, borderRadius: 12,
                    background: isOver ? `${col.cor}08` : 'var(--t-card-bg)',
                    border: `1px solid ${isOver ? col.cor : `${col.cor}33`}`,
                  }}
                  onDragOver={e => { e.preventDefault(); setDragOverCol(col.chave); }}
                  onDragEnter={e => { e.preventDefault(); setDragOverCol(col.chave); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOverCol(null);
                    const candidato = candidatos.find(c => c.id === draggingId);
                    if (candidato && candidato.status !== col.chave) moverStatus(candidato, col.chave);
                    setDraggingId(null);
                  }}
                >
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--t-card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-primary)' }}>{col.nome}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-text-muted)' }}>{lista.length}</span>
                  </div>
                  <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
                    {lista.map(c => (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', c.id);
                          setTimeout(() => setDraggingId(c.id), 0);
                        }}
                        onClick={() => setSelecionadoId(c.id)}
                        style={{
                          background: 'var(--t-content-bg)', borderRadius: 8, padding: 10,
                          cursor: 'pointer', opacity: draggingId === c.id ? 0.4 : 1,
                        }}
                      >
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>{c.nome}</p>
                        {c.empresa && <p style={{ fontSize: 11, color: 'var(--t-text-secondary)' }}>{c.empresa}</p>}
                        <p style={{ fontSize: 11, color: 'var(--t-text-secondary)' }}>{PERFIL_LABEL[c.perfil_desejado] || c.perfil_desejado}</p>
                        <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{[c.cidade, c.estado].filter(Boolean).join('/') || '—'}</p>
                        <p style={{ fontSize: 10, color: 'var(--t-text-muted)', marginTop: 4 }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selecionado && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,34,56,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: 'var(--t-card-bg)', borderRadius: 16, padding: 24, width: 480, maxWidth: '90vw' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--t-text-primary)' }}>{selecionado.nome}</h2>
                <button onClick={() => setSelecionadoId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={18} color="var(--t-text-secondary)" />
                </button>
              </div>
              <div style={{ display: 'grid', gap: 8, fontSize: 13, color: 'var(--t-text-secondary)' }}>
                <p><strong style={{ color: 'var(--t-text-primary)' }}>Perfil:</strong> {PERFIL_LABEL[selecionado.perfil_desejado] || selecionado.perfil_desejado}</p>
                <p><strong style={{ color: 'var(--t-text-primary)' }}>Telefone:</strong> {selecionado.telefone}</p>
                <p><strong style={{ color: 'var(--t-text-primary)' }}>E-mail:</strong> {selecionado.email}</p>
                <p><strong style={{ color: 'var(--t-text-primary)' }}>Cidade/UF:</strong> {[selecionado.cidade, selecionado.estado].filter(Boolean).join('/') || '—'}</p>
              </div>
              <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 16 }}>Ficha completa com todas as 10 seções será exibida aqui na próxima tarefa.</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
```

- [ ] **Step 2: Add the nav item**

In `frontend/components/dashboard/DashboardLayout.tsx`, find the "Clientes & Base" group (line 54-60):

```tsx
  {
    label: 'Clientes & Base',
    items: [
      { href: '/clientes',   icon: Building2, label: 'Clientes',   roles: ALL },
      { href: '/indicacoes', icon: Handshake, label: 'Cross-sell', roles: COMERCIAL },
    ],
  },
```

Replace with:

```tsx
  {
    label: 'Clientes & Base',
    items: [
      { href: '/clientes',       icon: Building2, label: 'Clientes',       roles: ALL },
      { href: '/indicacoes',     icon: Handshake, label: 'Cross-sell',     roles: COMERCIAL },
      { href: '/representantes', icon: Handshake, label: 'Representantes', roles: COMERCIAL },
    ],
  },
```

- [ ] **Step 3: Verify in the browser**

With both `cd backend && npm run dev` and `cd frontend && npm run dev` running, log into the CRM with a COMERCIAL-role account, click "Representantes" in the sidebar under "Clientes & Base".
Expected: kanban loads with 4 columns (Novo/Em Análise/Aprovado/Reprovado). The candidacy created in Task 5's manual verification should appear in "Novo". Drag it to "Em Análise" — the card should move and stay there after a page refresh (confirms the PATCH persisted). Click a card to open the (temporary, minimal) detail modal — confirm it shows the key fields.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/representantes/page.tsx frontend/components/dashboard/DashboardLayout.tsx
git commit -m "feat: modulo interno de triagem de representantes (kanban)"
```

---

### Task 7: Full candidacy detail view (accordion of 10 sections)

**Files:**
- Create: `frontend/app/representantes/DetalheCandidato.tsx`
- Modify: `frontend/app/representantes/page.tsx` (replace the inline minimal modal with `DetalheCandidato`)

**Interfaces:**
- Consumes: `apiClient` (`GET /candidatos-representante/:id`, `PATCH /candidatos-representante/:id`, Task 2); `CandidatoResumo`, `PERFIL_LABEL` types/constants from Task 6's `page.tsx`.
- Produces: `DetalheCandidato` component with props `{ candidatoId: string; onClose: () => void; onStatusChange: (novoStatus: string) => void }`, consumed by `page.tsx`.

- [ ] **Step 1: Write `DetalheCandidato.tsx`**

Create `frontend/app/representantes/DetalheCandidato.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { PERFIL_LABEL } from './page';

interface CandidatoCompleto {
  id: string;
  nome: string;
  empresa?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  cpf_responsavel?: string | null;
  telefone: string;
  email: string;
  cidade?: string | null;
  estado?: string | null;
  perfil_desejado: string;
  status: string;
  observacoes_internas?: string | null;
  respostas_detalhadas: any;
  created_at: string;
}

const SIM_NAO = (v: any) => v === true ? 'Sim' : v === false ? 'Não' : '—';
const LISTA = (v: any) => Array.isArray(v) && v.length ? v.join(', ') : '—';
const TXT = (v: any) => v || '—';

function Secao({ titulo, aberto, onToggle, children }: { titulo: string; aberto: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--t-card-border)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--t-content-bg)', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>{titulo}</span>
        {aberto ? <ChevronUp size={16} color="var(--t-text-secondary)" /> : <ChevronDown size={16} color="var(--t-text-secondary)" />}
      </button>
      {aberto && <div style={{ padding: '12px 14px', display: 'grid', gap: 6, fontSize: 13, color: 'var(--t-text-secondary)' }}>{children}</div>}
    </div>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return <p><strong style={{ color: 'var(--t-text-primary)' }}>{label}:</strong> {valor}</p>;
}

export default function DetalheCandidato({ candidatoId, onClose, onStatusChange }: { candidatoId: string; onClose: () => void; onStatusChange: (novoStatus: string) => void }) {
  const [candidato, setCandidato] = useState<CandidatoCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [obsRascunho, setObsRascunho] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [secaoAberta, setSecaoAberta] = useState<string | null>('estrutura_empresa');

  useEffect(() => {
    setLoading(true);
    apiClient.client.get(`/candidatos-representante/${candidatoId}`).then(res => {
      const c = res.data.data as CandidatoCompleto;
      setCandidato(c);
      setObsRascunho(c.observacoes_internas || '');
    }).finally(() => setLoading(false));
  }, [candidatoId]);

  async function salvarObservacoes() {
    if (!candidato) return;
    setSalvando(true);
    try {
      await apiClient.client.patch(`/candidatos-representante/${candidato.id}`, { observacoes_internas: obsRascunho });
    } finally {
      setSalvando(false);
    }
  }

  function toggleSecao(chave: string) {
    setSecaoAberta(prev => prev === chave ? null : chave);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,34,56,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'var(--t-card-bg)', borderRadius: 16, padding: 24, width: 600, maxWidth: '92vw', maxHeight: '86vh', overflowY: 'auto' }}>
        {loading || !candidato ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Loader2 size={24} className="animate-spin" color="var(--t-primary)" />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--t-text-primary)' }}>{candidato.nome}</h2>
                {candidato.empresa && <p style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>{candidato.empresa}</p>}
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="var(--t-text-secondary)" />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 4, marginBottom: 16, fontSize: 13, color: 'var(--t-text-secondary)' }}>
              <Linha label="Perfil desejado" valor={PERFIL_LABEL[candidato.perfil_desejado] || candidato.perfil_desejado} />
              <Linha label="Nome fantasia" valor={TXT(candidato.nome_fantasia)} />
              <Linha label="CNPJ" valor={TXT(candidato.cnpj)} />
              <Linha label="CPF responsável" valor={TXT(candidato.cpf_responsavel)} />
              <Linha label="Telefone" valor={candidato.telefone} />
              <Linha label="E-mail" valor={candidato.email} />
              <Linha label="Cidade/UF sede" valor={[candidato.cidade, candidato.estado].filter(Boolean).join('/') || '—'} />
            </div>

            {(() => {
              const r = candidato.respostas_detalhadas || {};
              const ee = r.estrutura_empresa || {};
              const ec = r.estrutura_comercial || {};
              const ii = r.instalacao_implantacao || {};
              const sp = r.suporte || {};
              const ra = r.regiao_atuacao || {};
              const em = r.experiencia_mercado || {};
              const ma = r.marcas_atuais || {};
              const ce = r.capacidade_expansao || {};

              return (
                <>
                  <Secao titulo="Estrutura da empresa" aberto={secaoAberta === 'estrutura_empresa'} onToggle={() => toggleSecao('estrutura_empresa')}>
                    <Linha label="Possui equipe" valor={SIM_NAO(ee.possui_equipe)} />
                    <Linha label="Qtd. pessoas" valor={TXT(ee.qtd_pessoas)} />
                    <Linha label="Comercial/Prospecção" valor={TXT(ee.funcoes?.comercial)} />
                    <Linha label="Vendas/Fechamento" valor={TXT(ee.funcoes?.vendas)} />
                    <Linha label="Implantação" valor={TXT(ee.funcoes?.implantacao)} />
                    <Linha label="Instalação" valor={TXT(ee.funcoes?.instalacao)} />
                    <Linha label="Suporte" valor={TXT(ee.funcoes?.suporte)} />
                    <Linha label="Treinamento" valor={TXT(ee.funcoes?.treinamento)} />
                    <Linha label="Administrativo" valor={TXT(ee.funcoes?.administrativo)} />
                    <Linha label="Outros" valor={TXT(ee.funcoes?.outros)} />
                    <Linha label="Dedicadas à Prosystem" valor={TXT(ee.qtd_dedicada_prosystem)} />
                    <Linha label="Equipe própria/terceirizada" valor={TXT(ee.equipe_propria_ou_terceirizada)} />
                  </Secao>

                  <Secao titulo="Estrutura comercial" aberto={secaoAberta === 'estrutura_comercial'} onToggle={() => toggleSecao('estrutura_comercial')}>
                    <Linha label="Responsável pelas vendas" valor={TXT(ec.responsavel_vendas)} />
                    <Linha label="Qtd. em prospecção/venda" valor={TXT(ec.qtd_prospeccao_venda)} />
                    <Linha label="Visita presencial" valor={SIM_NAO(ec.visita_presencial)} />
                    <Linha label="Prospecção ativa" valor={SIM_NAO(ec.prospeccao_ativa)} />
                    <Linha label="Canais" valor={LISTA(ec.canais)} />
                    <Linha label="Outros canais" valor={TXT(ec.canal_outros)} />
                  </Secao>

                  <Secao titulo="Instalação, implantação e treinamento" aberto={secaoAberta === 'instalacao_implantacao'} onToggle={() => toggleSecao('instalacao_implantacao')}>
                    <Linha label="Realiza instalação" valor={SIM_NAO(ii.realiza_instalacao)} />
                    <Linha label="Quem instala" valor={TXT(ii.quem_instala)} />
                    <Linha label="Qtd. instaladores" valor={TXT(ii.qtd_instaladores)} />
                    <Linha label="Experiência ERP/PDV" valor={SIM_NAO(ii.experiencia_erp_pdv)} />
                    <Linha label="Experiência config. equipamentos" valor={SIM_NAO(ii.experiencia_config_equipamentos)} />
                    <Linha label="Realiza implantação" valor={SIM_NAO(ii.realiza_implantacao)} />
                    <Linha label="Realiza treinamento" valor={SIM_NAO(ii.realiza_treinamento)} />
                    <Linha label="Qtd. treinadores" valor={TXT(ii.qtd_treinadores)} />
                  </Secao>

                  <Secao titulo="Suporte ao cliente" aberto={secaoAberta === 'suporte'} onToggle={() => toggleSecao('suporte')}>
                    <Linha label="Presta suporte" valor={SIM_NAO(sp.presta_suporte)} />
                    <Linha label="Tipos" valor={LISTA(sp.tipos)} />
                    <Linha label="Outros tipos" valor={TXT(sp.tipo_outros)} />
                    <Linha label="Responsável" valor={TXT(sp.responsavel)} />
                    <Linha label="Qtd. pessoas" valor={TXT(sp.qtd_pessoas)} />
                    <Linha label="Horário" valor={TXT(sp.horario)} />
                    <Linha label="Experiência anterior" valor={SIM_NAO(sp.experiencia_anterior)} />
                  </Secao>

                  <Secao titulo="Região de atuação" aberto={secaoAberta === 'regiao_atuacao'} onToggle={() => toggleSecao('regiao_atuacao')}>
                    <Linha label="Estados" valor={LISTA(ra.estados)} />
                    <Linha label="Região principal" valor={TXT(ra.regiao_principal)} />
                    <Linha label="Cidades" valor={Array.isArray(ra.cidades) && ra.cidades.length ? ra.cidades.map((c: any) => `${c.nome} (${c.tipo === 'PRESENCIAL' ? 'Presencial' : 'Remoto'})`).join(', ') : '—'} />
                    <Linha label="Atende todas presencialmente" valor={SIM_NAO(ra.atende_todas_presencial)} />
                    <Linha label="Veículo próprio" valor={SIM_NAO(ra.veiculo_proprio)} />
                    <Linha label="Distância máxima" valor={TXT(ra.distancia_maxima)} />
                  </Secao>

                  <Secao titulo="Experiência no mercado" aberto={secaoAberta === 'experiencia_mercado'} onToggle={() => toggleSecao('experiencia_mercado')}>
                    <Linha label="Tempo de atuação" valor={TXT(em.tempo_atuacao)} />
                    <Linha label="Trabalhou com software de gestão" valor={SIM_NAO(em.trabalhou_software_gestao)} />
                    <Linha label="Experiência ERP/PDV" valor={SIM_NAO(em.experiencia_erp_pdv)} />
                    <Linha label="Segmentos" valor={LISTA(em.segmentos)} />
                    <Linha label="Outros segmentos" valor={TXT(em.segmento_outros)} />
                    <Linha label="Possui carteira" valor={SIM_NAO(em.possui_carteira)} />
                    <Linha label="Qtd. aproximada de clientes" valor={TXT(em.qtd_clientes_aprox)} />
                  </Secao>

                  <Secao titulo="Marcas que representa atualmente" aberto={secaoAberta === 'marcas_atuais'} onToggle={() => toggleSecao('marcas_atuais')}>
                    <Linha label="Representa outras marcas" valor={SIM_NAO(ma.representa_outras)} />
                    <Linha label="Marcas" valor={Array.isArray(ma.marcas) && ma.marcas.length ? ma.marcas.map((m: any) => `${m.marca} — ${m.produto_servico} (${m.segmento})`).join('; ') : '—'} />
                    <Linha label="Tempo de representação" valor={TXT(ma.tempo_representacao)} />
                    <Linha label="Exclusividade" valor={TXT(ma.exclusividade)} />
                    <Linha label="Atua com" valor={LISTA(ma.atua_com)} />
                    <Linha label="Representa concorrente" valor={SIM_NAO(ma.representa_concorrente)} />
                    {ma.representa_concorrente && <Linha label="Qual concorrente" valor={TXT(ma.concorrente_qual)} />}
                    <Linha label="Tem impedimento" valor={SIM_NAO(ma.tem_impedimento)} />
                    {ma.tem_impedimento && <Linha label="Descrição do impedimento" valor={TXT(ma.impedimento_descricao)} />}
                  </Secao>

                  <Secao titulo="Capacidade de atendimento e expansão" aberto={secaoAberta === 'capacidade_expansao'} onToggle={() => toggleSecao('capacidade_expansao')}>
                    <Linha label="Prospectar/mês" valor={TXT(ce.prospectar_mes)} />
                    <Linha label="Fechar/mês" valor={TXT(ce.fechar_mes)} />
                    <Linha label="Implantar/mês" valor={TXT(ce.implantar_mes)} />
                    <Linha label="Acompanha prospecção→pós-venda" valor={SIM_NAO(ce.acompanha_prospeccao_pos_venda)} />
                    <Linha label="Etapas em que atua" valor={LISTA(ce.etapas_atua)} />
                  </Secao>

                  <Secao titulo="Apresentação da operação" aberto={secaoAberta === 'apresentacao_operacao'} onToggle={() => toggleSecao('apresentacao_operacao')}>
                    <p>{TXT(r.apresentacao_operacao)}</p>
                  </Secao>
                </>
              );
            })()}

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)', margin: '16px 0 6px' }}>Observações internas</label>
            <textarea
              value={obsRascunho}
              onChange={e => setObsRascunho(e.target.value)}
              rows={4}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--t-card-border)', fontSize: 13, marginBottom: 12, fontFamily: 'inherit' }}
            />
            <button
              onClick={salvarObservacoes}
              disabled={salvando}
              style={{ background: 'var(--t-primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.7 : 1 }}
            >
              {salvando ? 'Salvando...' : 'Salvar observações'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire `DetalheCandidato` into `page.tsx`, replacing the minimal inline modal**

In `frontend/app/representantes/page.tsx`:

Add the import at the top:

```tsx
import DetalheCandidato from './DetalheCandidato';
```

Replace the entire inline modal block:

```tsx
        {selecionado && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,34,56,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: 'var(--t-card-bg)', borderRadius: 16, padding: 24, width: 480, maxWidth: '90vw' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--t-text-primary)' }}>{selecionado.nome}</h2>
                <button onClick={() => setSelecionadoId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={18} color="var(--t-text-secondary)" />
                </button>
              </div>
              <div style={{ display: 'grid', gap: 8, fontSize: 13, color: 'var(--t-text-secondary)' }}>
                <p><strong style={{ color: 'var(--t-text-primary)' }}>Perfil:</strong> {PERFIL_LABEL[selecionado.perfil_desejado] || selecionado.perfil_desejado}</p>
                <p><strong style={{ color: 'var(--t-text-primary)' }}>Telefone:</strong> {selecionado.telefone}</p>
                <p><strong style={{ color: 'var(--t-text-primary)' }}>E-mail:</strong> {selecionado.email}</p>
                <p><strong style={{ color: 'var(--t-text-primary)' }}>Cidade/UF:</strong> {[selecionado.cidade, selecionado.estado].filter(Boolean).join('/') || '—'}</p>
              </div>
              <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 16 }}>Ficha completa com todas as 10 seções será exibida aqui na próxima tarefa.</p>
            </div>
          </div>
        )}
```

with:

```tsx
        {selecionadoId && (
          <DetalheCandidato
            candidatoId={selecionadoId}
            onClose={() => setSelecionadoId(null)}
            onStatusChange={(novoStatus) => {
              setCandidatos(prev => prev.map(c => c.id === selecionadoId ? { ...c, status: novoStatus } : c));
            }}
          />
        )}
```

Also remove the now-unused `X` import from `lucide-react` in `page.tsx` if it is no longer referenced elsewhere in that file, and remove the `selecionado` variable (`const selecionado = candidatos.find(...)`) since it's no longer used — the modal now receives `selecionadoId` directly.

- [ ] **Step 3: Verify the full detail view in the browser**

With both dev servers running, open `/representantes`, click the candidacy created earlier. Expected: modal opens, shows key fields at top, then 9 collapsible sections (Estrutura da empresa open by default, others collapsed). Click each section header to expand/collapse. Confirm the city list from Task 5's test entry shows as "Cidade/UF (Presencial)" format, and the brand list shows "Marca — Produto (Segmento)" format. Type in "Observações internas", click "Salvar observações", close and reopen the modal — confirm the text persisted.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/representantes/DetalheCandidato.tsx frontend/app/representantes/page.tsx
git commit -m "feat: ficha de detalhe completa do candidato (10 secoes em acordeao)"
```

---

## Self-Review Notes

- **Spec coverage:** Institutional public page + 3-profile table (Task 5's `page.tsx`, unchanged from Task 4) ✓. All 10 wizard steps with the exact fields from the spec (Tasks 4–5) ✓. Dynamic unbounded cities list with Presencial/Remoto toggle (Task 5, Passo6) ✓. Dynamic unbounded brands list (Task 5, Passo8) ✓. Conditional fields for "representa concorrente" and "tem impedimento" (Task 5, Passo8) ✓. `perfil_desejado` selection at the end of the wizard (Task 5, Passo10) ✓. `POST` public, no draft persistence (Task 4/5, matches Global Constraints) ✓. Backend key columns + `respostas_detalhadas` Json (Task 1) ✓. List endpoint omits detail Json, detail endpoint includes it (Task 2) ✓. Kanban 4 fixed statuses, drag-and-drop with the Chrome/Edge-safe pattern (Task 6) ✓. Full 10-section accordion detail view + internal observations (Task 7) ✓. Email notification with key fields + short summary, not the full 60 answers (Task 3) ✓. No auto Usuario/vendedor creation (nowhere implemented — correct, by design) ✓. No badge counter added to the sidebar nav item (Task 6 — column count in the kanban itself is the only counter, consistent with the spec's decision to keep this enxuto).
- **Placeholder scan:** none found — every step has runnable code or exact commands. Task 4's Step 6–10 "placeholder paragraph" is an intentional, temporary scaffold explicitly replaced by Task 5 Step 2 within the same plan — not a plan gap.
- **Type consistency:** `perfil_desejado` values (`INDICADOR`/`REPRESENTANTE`/`FRANQUEADO`) and `status` values (`NOVO`/`EM_ANALISE`/`APROVADO`/`REPROVADO`) match across Prisma schema (Task 1), zod schemas (Task 2), email template (Task 3), and both frontend pages (Tasks 4-7). The `respostas_detalhadas` JSON shape in `paraPayload()` (Task 4) matches exactly the shape read back by `DetalheCandidato.tsx` (Task 7) — same keys (`estrutura_empresa`, `estrutura_comercial`, `instalacao_implantacao`, `suporte`, `regiao_atuacao`, `experiencia_mercado`, `marcas_atuais`, `capacidade_expansao`, `apresentacao_operacao`) and same nested field names, cross-checked field by field against the spec's documented JSON example.
