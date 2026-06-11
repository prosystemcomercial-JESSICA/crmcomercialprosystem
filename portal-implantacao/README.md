# Portal de Implantação & Onboarding — Prosystem

App **separado** do CRM comercial (banco próprio). Recebe o cliente vindo do CRM
comercial (link com SSO) e conduz os 3 funis: Comercial → Implantação → Onboarding.

## Estrutura
- `backend/` — Fastify + Prisma (MySQL próprio). API dos projetos, automações, KPIs e a ponte.
- `frontend/` — Next.js. Kanban dos 3 funis + ficha do projeto + dashboard (5 KPIs).

## Deploy no Railway (passo a passo)

### 1) Banco do portal
1. Railway → **New → Database → MySQL** (um banco SÓ do portal).
2. Copie a **`DATABASE_URL`** (Connect → MySQL → variável `MYSQL_URL`/`DATABASE_URL`).

### 2) Serviço do BACKEND
1. Railway → **New → GitHub Repo** → este repositório.
2. **Root Directory:** `portal-implantacao/backend`.
3. Variáveis:
   - `DATABASE_URL` = a do banco do portal (passo 1)
   - `JWT_SECRET` = **o MESMO** do CRM comercial (para o SSO funcionar)
   - `PONTE_TOKEN` = um segredo qualquer (ex.: gerar 32 chars) — usado pela ponte
   - `FRONTEND_URL` = a URL do frontend do portal (preencher após o passo 3)
   - (opcional e-mails) `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `GESTOR_EMAIL`
   - (opcional) `FRESHDESK_URL` = https://suporteprosystem.freshdesk.com/support/home
4. O `start` aplica o schema automaticamente (`prisma db push`). Pegue a URL pública gerada.

### 3) Serviço do FRONTEND
1. Railway → **New → GitHub Repo** → este repositório.
2. **Root Directory:** `portal-implantacao/frontend`.
3. Variáveis:
   - `NEXT_PUBLIC_PORTAL_API_URL` = URL pública do backend do portal (passo 2)
4. Pegue a URL pública gerada → volte no backend e preencha `FRONTEND_URL` com ela.

### 4) Ligar o CRM comercial ao portal
No serviço **backend do CRM comercial** (já existente), adicione:
- `PORTAL_PONTE_URL` = URL pública do backend do portal
- `PONTE_TOKEN` = o MESMO valor do passo 2

No serviço **frontend do CRM comercial**, adicione:
- `NEXT_PUBLIC_PORTAL_URL` = URL pública do frontend do portal

Pronto: o menu do CRM mostra **"Implantação & Onboarding"** (abre o portal com SSO),
e ao aceitar uma proposta o projeto de implantação nasce automaticamente no portal.

## Funis, SLAs e automações
Definidos em `backend/src/funis.ts` (fonte única). Automações em `backend/src/automacoes.ts`:
transição 1.5→2.1, 2.5→3.1, SLA fiscal (>5d na 2.2), e-mail Freshdesk (15d na 3.1) e NPS (3.4).
