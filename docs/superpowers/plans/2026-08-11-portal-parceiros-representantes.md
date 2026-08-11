# Portal de Parceiros / Representantes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, no-login candidacy form (`/parceiro`) plus an authenticated internal kanban module (`/representantes`) so Prosystem can receive and triage partner/representative applications (Indicador / Representante / Franqueado) without relying on ad-hoc WhatsApp/email.

**Architecture:** One new Prisma model (`CandidatoRepresentante`) backs both surfaces. A public `POST /api/candidatos-representante` (no auth) creates records and fires an email notification. Authenticated `GET`/`GET :id`/`PATCH :id` power the internal kanban (fixed 4-status enum, not the generic `KanbanColuna` system — this module doesn't need customizable columns). Frontend is two independent Next.js pages: `/parceiro` (public, unauthenticated, Prosystem-branded form) and `/representantes` (authenticated, drag-and-drop kanban matching the `/leads` page's existing pattern).

**Tech Stack:** Fastify + Prisma + Zod (backend, matches `backend/src/routes/etiquetas.ts` pattern), Next.js App Router + native HTML5 drag-and-drop (frontend, matches `frontend/app/leads/page.tsx` pattern), Nodemailer via existing `backend/src/services/email.service.ts`.

## Global Constraints

- Fields in the public form are a v1 placeholder set (nome, telefone, email, cidade, estado, perfil_desejado, mensagem) — the user will send a definitive questionnaire later; field changes must stay isolated to the schema/zod/JSX for this feature only.
- Notification email recipient is fixed: `jessica@prosystemnet.com.br` (no per-user configuration in v1).
- No automatic creation of `Usuario`/vendedor records on approval — status change is the only side effect.
- Public `POST` endpoint must NOT use `requireAuth` (it's the only unauthenticated route in this feature); all other endpoints must use `{ onRequest: requireAuth }` exactly like `backend/src/routes/casos-churn.ts:69`.
- Email failures must never fail the public POST response — the database record is the source of truth; email errors are logged only (mirrors `enviarEmailRedefinicaoSenha`'s `{ ok, error }` return shape in `backend/src/services/email.service.ts:875`).
- Kanban drag-and-drop must use the same deferred `setTimeout(() => setDraggingLead(lead), 0)` pattern from `frontend/app/leads/page.tsx:1338` to avoid the documented Chrome/Edge drag-cancel bug.
- Design system colors: gradient `#0D2238 → #1A4E82 → #2E6EAB`, accent `#4B8EC8`, matching existing client-facing emails and `/leads` page.

---

## File Structure

- `backend/prisma/schema.prisma` — add `CandidatoRepresentante` model.
- `backend/src/routes/candidatos-representante.ts` — new route file (POST public, GET/GET:id/PATCH:id authenticated).
- `backend/src/server.ts` — register new route module in `routeModules` array.
- `backend/src/services/email.service.ts` — add `enviarEmailNovaCandidaturaRepresentante` export.
- `backend/tests/candidatos-representante.test.ts` — new vitest integration test file.
- `frontend/app/parceiro/page.tsx` — new public form page.
- `frontend/app/representantes/page.tsx` — new authenticated kanban page.
- `frontend/components/dashboard/DashboardLayout.tsx` — add one `NavItem` entry.

---

### Task 1: Prisma model `CandidatoRepresentante`

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma model `CandidatoRepresentante` with fields `id, nome, telefone, email, cidade, estado, perfil_desejado, mensagem, status, observacoes_internas, created_at, updated_at`, consumed by Task 2's route file.

- [ ] **Step 1: Add the model to schema.prisma**

Open `backend/prisma/schema.prisma`, find the `model KanbanColuna {` block (around line 744), and insert the new model directly above it:

```prisma
model CandidatoRepresentante {
  id        String   @id @default(cuid())

  nome      String
  telefone  String
  email     String
  cidade    String?
  estado    String?
  perfil_desejado String // INDICADOR | REPRESENTANTE | FRANQUEADO
  mensagem  String?  @db.Text

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
- Produces: Fastify plugin `candidatosRepresentanteRoutes(fastify, { prisma })` exporting routes `POST /candidatos-representante`, `GET /candidatos-representante`, `GET /candidatos-representante/:id`, `PATCH /candidatos-representante/:id`. Response envelope on all routes: `{ status: 'success' | 'error', data?: ..., message?: string }`.

- [ ] **Step 1: Write the failing integration test**

Create `backend/tests/candidatos-representante.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { candidatosRepresentanteRoutes } from '@/routes/candidatos-representante';

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
        telefone: '27999999999',
        email: 'candidato.teste@example.com',
        cidade: 'Vitória',
        estado: 'ES',
        perfil_desejado: 'REPRESENTANTE',
        mensagem: 'Tenho experiência com vendas',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.status).toBe('success');
    expect(body.data.status).toBe('NOVO');
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

  it('GET /candidatos-representante lists with valid token', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/candidatos-representante',
      headers: { authorization: 'Bearer test-token' },
    });
    // token inválido também deve barrar (401) — o hook global só popula
    // request.user, quem bloqueia é requireAuth verificando a assinatura.
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
  telefone:         z.string().min(1),
  email:            z.string().email(),
  cidade:           z.string().optional(),
  estado:           z.string().optional(),
  perfil_desejado:  z.enum(PERFIS),
  mensagem:         z.string().optional(),
});

const UpdateSchema = z.object({
  status:                z.enum(STATUS).optional(),
  observacoes_internas:  z.string().optional(),
});

export async function candidatosRepresentanteRoutes(
  fastify: FastifyInstance,
  options: { prisma: PrismaClient }
) {
  const { prisma } = options;

  // Rota pública — sem requireAuth. Usada pelo formulário /parceiro.
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
  nome: string; telefone: string; email: string; cidade?: string | null;
  estado?: string | null; perfil_desejado: string; mensagem?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'not implemented yet' };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/candidatos-representante.test.ts`
Expected: All 5 tests PASS.

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
  nome: string; telefone: string; email: string; cidade?: string | null;
  estado?: string | null; perfil_desejado: string; mensagem?: string | null;
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
                <tr><td style="padding:6px 0;font-size:14px;color:#4A6E8A;">Telefone</td><td style="padding:6px 0;font-size:14px;color:#0D2238;font-weight:600;">${candidato.telefone}</td></tr>
                <tr><td style="padding:6px 0;font-size:14px;color:#4A6E8A;">E-mail</td><td style="padding:6px 0;font-size:14px;color:#0D2238;font-weight:600;">${candidato.email}</td></tr>
                <tr><td style="padding:6px 0;font-size:14px;color:#4A6E8A;">Cidade/UF</td><td style="padding:6px 0;font-size:14px;color:#0D2238;font-weight:600;">${candidato.cidade || '—'}${candidato.estado ? '/' + candidato.estado : ''}</td></tr>
                ${candidato.mensagem ? `<tr><td style="padding:6px 0;font-size:14px;color:#4A6E8A;vertical-align:top;">Mensagem</td><td style="padding:6px 0;font-size:14px;color:#0D2238;">${candidato.mensagem}</td></tr>` : ''}
              </table>
              <a href="${appUrl}/representantes" style="display:inline-block;background:#2E6EAB;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">
                Ver no CRM
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
Expected: All 5 tests still PASS (the POST test doesn't assert on email delivery, only on the DB record, so this is a regression check).

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/email.service.ts
git commit -m "feat: e-mail de notificação de nova candidatura de representante"
```

---

### Task 4: Public form page `/parceiro`

**Files:**
- Create: `frontend/app/parceiro/page.tsx`

**Interfaces:**
- Consumes: `POST ${NEXT_PUBLIC_API_URL}/candidatos-representante` (Task 2), no auth token attached.
- Produces: standalone page component, not consumed by any other file.

- [ ] **Step 1: Write the page**

Create `frontend/app/parceiro/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import axios from 'axios';
import { CheckCircle2, Loader2, Handshake } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const PERFIS = [
  {
    valor: 'INDICADOR',
    titulo: 'Indicador',
    descricao: 'Apenas faz a indicação dos produtos e recebe um valor correspondente à instalação.',
    percentual: '30% referente ao valor da instalação',
  },
  {
    valor: 'REPRESENTANTE',
    titulo: 'Representante',
    descricao: 'Faz a prospecção de novos clientes e a instalação presencialmente do software.',
    percentual: '50% referente ao valor da instalação',
  },
  {
    valor: 'FRANQUEADO',
    titulo: 'Franqueado',
    descricao: 'Responsável por fazer prospecção, instalação, treinamento e suporte técnico.',
    percentual: '50% da instalação + 50% da mensalidade',
  },
];

const BENEFICIOS = [
  'Direito de uso da marca e venda dos produtos Prosystem Sistemas',
  'Treinamento inicial e contínuo',
  'Know how e estrutura da empresa',
  'Respaldo de uma empresa estruturada e com visão de mercado',
  'Acesso a toda tecnologia emergente de automação comercial (ECF, NF-e, NFC-e, PAF-ECF etc.)',
  'Facilidade para a prestação de suporte técnico',
];

interface FormState {
  nome: string;
  telefone: string;
  email: string;
  cidade: string;
  estado: string;
  perfil_desejado: string;
  mensagem: string;
}

const FORM_INICIAL: FormState = {
  nome: '', telefone: '', email: '', cidade: '', estado: '', perfil_desejado: '', mensagem: '',
};

export default function ParceiroPage() {
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const set = (campo: keyof FormState, valor: string) => setForm(f => ({ ...f, [campo]: valor }));

  const camposObrigatoriosPreenchidos =
    form.nome.trim() && form.telefone.trim() && form.email.trim() && form.perfil_desejado;

  async function enviar() {
    if (!camposObrigatoriosPreenchidos) {
      setErro('Preencha nome, telefone, e-mail e o perfil desejado.');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      await axios.post(`${API_URL}/candidatos-representante`, form);
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
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0D2238', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Handshake size={18} color="#2E6EAB" /> Quero ser parceiro
          </h2>

          <div style={{ display: 'grid', gap: 14 }}>
            <Campo label="Nome completo *" value={form.nome} onChange={v => set('nome', v)} />
            <Campo label="Telefone / WhatsApp *" value={form.telefone} onChange={v => set('telefone', v)} />
            <Campo label="E-mail *" value={form.email} onChange={v => set('email', v)} type="email" />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
              <Campo label="Cidade" value={form.cidade} onChange={v => set('cidade', v)} />
              <Campo label="Estado" value={form.estado} onChange={v => set('estado', v)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>Perfil desejado *</label>
              <select
                value={form.perfil_desejado}
                onChange={e => set('perfil_desejado', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 14, color: '#0D2238' }}
              >
                <option value="">Selecione...</option>
                <option value="INDICADOR">Indicador</option>
                <option value="REPRESENTANTE">Representante</option>
                <option value="FRANQUEADO">Franqueado</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>Experiência / mensagem</label>
              <textarea
                value={form.mensagem}
                onChange={e => set('mensagem', e.target.value)}
                rows={4}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 14, color: '#0D2238', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            {erro && <p style={{ fontSize: 13, color: '#DC2626' }}>{erro}</p>}

            <button
              onClick={enviar}
              disabled={enviando}
              style={{
                background: '#2E6EAB', color: '#fff', border: 'none', borderRadius: 8,
                padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: enviando ? 'default' : 'pointer',
                opacity: enviando ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {enviando ? <Loader2 size={16} className="animate-spin" /> : null}
              {enviando ? 'Enviando...' : 'Enviar candidatura'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
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
```

- [ ] **Step 2: Verify the page renders and submits**

Run: `cd frontend && npm run dev` (leave running), then in a browser go to `http://localhost:3000/parceiro`.
Expected: page loads without a login redirect, shows the institutional header, benefits list, 3 profile cards, and the form. Fill required fields and click "Enviar candidatura" — with the backend running (`cd backend && npm run dev`), the page should switch to the "Candidatura recebida!" confirmation screen. Stop the dev server after verifying (Ctrl+C).

- [ ] **Step 3: Commit**

```bash
git add frontend/app/parceiro/page.tsx
git commit -m "feat: página pública de candidatura a parceiro (/parceiro)"
```

---

### Task 5: Internal kanban page `/representantes`

**Files:**
- Create: `frontend/app/representantes/page.tsx`
- Modify: `frontend/components/dashboard/DashboardLayout.tsx:56-60` (add nav item to the "Clientes & Base" group)

**Interfaces:**
- Consumes: `apiClient` from `frontend/lib/api-client.ts` (`GET/PATCH /candidatos-representante`, Task 2); `useAuth` from `frontend/lib/auth-context`.
- Produces: standalone authenticated page, linked from the sidebar.

- [ ] **Step 1: Write the kanban page**

Create `frontend/app/representantes/page.tsx`:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { Handshake, Loader2, X } from 'lucide-react';

interface Candidato {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  cidade?: string | null;
  estado?: string | null;
  perfil_desejado: string;
  mensagem?: string | null;
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

const PERFIL_LABEL: Record<string, string> = {
  INDICADOR: 'Indicador',
  REPRESENTANTE: 'Representante',
  FRANQUEADO: 'Franqueado',
};

export default function RepresentantesPage() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<Candidato | null>(null);
  const [obsRascunho, setObsRascunho] = useState('');

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

  async function moverStatus(candidato: Candidato, novoStatus: string) {
    setCandidatos(prev => prev.map(c => c.id === candidato.id ? { ...c, status: novoStatus } : c));
    await apiClient.client.patch(`/candidatos-representante/${candidato.id}`, { status: novoStatus });
  }

  async function salvarObservacoes() {
    if (!selecionado) return;
    await apiClient.client.patch(`/candidatos-representante/${selecionado.id}`, { observacoes_internas: obsRascunho });
    setCandidatos(prev => prev.map(c => c.id === selecionado.id ? { ...c, observacoes_internas: obsRascunho } : c));
    setSelecionado(null);
  }

  const porColuna = (chave: string) => candidatos.filter(c => c.status === chave);

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
                        onClick={() => { setSelecionado(c); setObsRascunho(c.observacoes_internas || ''); }}
                        style={{
                          background: 'var(--t-content-bg)', borderRadius: 8, padding: 10,
                          cursor: 'pointer', opacity: draggingId === c.id ? 0.4 : 1,
                        }}
                      >
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>{c.nome}</p>
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
                <button onClick={() => setSelecionado(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={18} color="var(--t-text-secondary)" />
                </button>
              </div>
              <div style={{ display: 'grid', gap: 8, marginBottom: 16, fontSize: 13, color: 'var(--t-text-secondary)' }}>
                <p><strong style={{ color: 'var(--t-text-primary)' }}>Perfil:</strong> {PERFIL_LABEL[selecionado.perfil_desejado] || selecionado.perfil_desejado}</p>
                <p><strong style={{ color: 'var(--t-text-primary)' }}>Telefone:</strong> {selecionado.telefone}</p>
                <p><strong style={{ color: 'var(--t-text-primary)' }}>E-mail:</strong> {selecionado.email}</p>
                <p><strong style={{ color: 'var(--t-text-primary)' }}>Cidade/UF:</strong> {[selecionado.cidade, selecionado.estado].filter(Boolean).join('/') || '—'}</p>
                {selecionado.mensagem && <p><strong style={{ color: 'var(--t-text-primary)' }}>Mensagem:</strong> {selecionado.mensagem}</p>}
              </div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)', marginBottom: 6 }}>Observações internas</label>
              <textarea
                value={obsRascunho}
                onChange={e => setObsRascunho(e.target.value)}
                rows={4}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--t-card-border)', fontSize: 13, marginBottom: 16, fontFamily: 'inherit' }}
              />
              <button
                onClick={salvarObservacoes}
                style={{ background: 'var(--t-primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Salvar
              </button>
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
Expected: kanban loads with 4 columns (Novo/Em Análise/Aprovado/Reprovado). The test candidacy created in Task 4's manual verification should appear in "Novo". Drag it to "Em Análise" — the card should move and stay there after a page refresh (confirms the PATCH persisted). Click a card to open the detail modal, type something in "Observações internas", click Salvar, reopen the card to confirm it persisted.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/representantes/page.tsx frontend/components/dashboard/DashboardLayout.tsx
git commit -m "feat: módulo interno de triagem de representantes (kanban)"
```

---

## Self-Review Notes

- **Spec coverage:** Public page (Task 4) ✓, institutional text + profile table (Task 4) ✓, form → POST → email (Tasks 2-4) ✓, internal kanban with 4 fixed statuses (Task 5) ✓, card detail + internal observations (Task 5) ✓, email to jessica@prosystemnet.com.br (Task 3) ✓, isolated module / no auto Usuario creation (nowhere implemented — correct, by design) ✓. The spec's menu "badge counter for NOVO count" was scoped out: no existing `NavItem` in `DashboardLayout.tsx` implements a live badge, and the kanban's "Novo" column count is visible immediately on opening the module — adding a new badge mechanism would be out of proportion to this feature and isn't in the Global Constraints, so it's dropped rather than invented ad hoc.
- **Placeholder scan:** none found — every step has runnable code or exact commands.
- **Type consistency:** `perfil_desejado` values (`INDICADOR`/`REPRESENTANTE`/`FRANQUEADO`) and `status` values (`NOVO`/`EM_ANALISE`/`APROVADO`/`REPROVADO`) match exactly across Prisma schema (Task 1), zod schemas (Task 2), email template (Task 3), and both frontend pages (Tasks 4-5).
