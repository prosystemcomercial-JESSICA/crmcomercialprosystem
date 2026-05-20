# CRM Comercial ProSystem — Implementation Roadmap

**Objetivo:** Do setup → MVP funcional em 3 sprints  
**Timeline:** 3-4 semanas  
**Equipe:** 2-3 devs (Backend + Frontend + DevOps)

---

## 📅 Semana 1 — Sprint 28: Churn e Retenção

### Dia 1-2: Setup Base
- [ ] Clonar repo e executar DEV_SETUP.md
- [ ] Database PostgreSQL rodando (via Docker ou local)
- [ ] Backend: GET /health retornando 200
- [ ] Frontend: Homepage carregando
- [ ] Prisma Studio funcionando
- [ ] First commit: "chore: initial project setup"

**Time:** 4-6 horas (1 dev full-stack ou 1 backend + 1 frontend)

---

### Dia 3: Services Backend (Sprint 28 US01-03)

**CasoChurnService:**
```bash
# Implementar
src/services/caso-churn.service.ts
├─ create(clienteId, motivo)
├─ list(filters, page)
├─ getById(id)
├─ updateStatus(id, status)
└─ delete(id)

# Testes
tests/caso-churn.service.test.ts
├─ TC1.1: Criar caso válido
├─ TC1.2: Validar status transitions
└─ TC1.3: Validar permissões
```

**Commit:** `feat(churn): implement CasoChurnService [US01-US03]`

**Time:** 6-8 horas (backend dev)

---

### Dia 4: Fastify Routes (Sprint 28 US01)

**Routes:**
```bash
src/routes/casos-churn.ts
├─ POST /casos-churn (create)
├─ GET /casos-churn (list with filters)
├─ GET /casos-churn/:id (getById)
├─ PATCH /casos-churn/:id (update status)
└─ DELETE /casos-churn/:id (soft delete)

# Validações
├─ Zod schemas: CreateCasoDTO, UpdateCasoDTO
├─ Auth middleware: requireAuth
└─ Role middleware: requireRole(['CEO', 'SUPERVISAO'])
```

**Testes:**
```bash
tests/routes/casos-churn.test.ts
├─ TC2.1: POST 201 valid create
├─ TC2.2: GET 200 with filters
├─ TC2.3: PATCH status transitions
└─ TC2.4: 403 permission denied
```

**Time:** 4-6 horas (backend dev)

**Commit:** `feat(churn): add CasoChurn routes and validations [US01]`

---

### Dia 5: Frontend Components (Sprint 28)

**Components:**
```bash
components/retencao/
├─ DashboardRetencao.tsx
├─ ListaCasos.tsx
├─ CasoCard.tsx
├─ KPICard.tsx
└─ Filters.tsx

# Hooks
hooks/
├─ useCasoChurn.ts (useQuery + useMutation)
├─ useCasosList.ts (useQuery with pagination)
└─ useDashboardRetencao.ts (useQuery auto-refresh)
```

**Pages:**
```bash
app/retencao/
├─ page.tsx (Dashboard)
└─ casos/
   ├─ page.tsx (List)
   └─ [id]/page.tsx (Detail)
```

**Time:** 8 horas (frontend dev)

**Commit:** `feat(retencao): add dashboard and list components`

---

### Dia 6-7: Integração + Testes

**Backend:**
- [ ] Testes unitários passando (80%+ coverage)
- [ ] Testes integração API rodando
- [ ] Error handling implementado
- [ ] Logging estruturado

**Frontend:**
- [ ] API integration (lib/api/casos-churn.ts)
- [ ] React Query setup e cache strategy
- [ ] Loading states + error boundaries
- [ ] Componentes responsivos

**Commit:** `test(churn): add unit and integration tests [Sprint28]`

**Demo:** Ver dashboard + listar casos + criar caso novo

---

## 📅 Semana 2 — Sprint 29: Pesquisa de Motivos

### Dia 8-9: NLP Service

**NLPSentimentService:**
```typescript
src/services/nlp-sentiment.service.ts
├─ analyzeSentiment(text: string)
│  ├─ Compromise.js tokenization
│  ├─ PT-BR dictionary matching
│  └─ Score normalization (-1 to +1)
├─ extractKeywords(text, topN=5)
│  ├─ TF-IDF calculation
│  └─ Return top keywords
└─ unit tests (TC3.1, TC3.2)
```

**Queuing (NLP Async):**
```typescript
src/queue/nLP.job.ts
├─ processNLPAnalysis(respostaId)
├─ Retry logic (max 3x)
└─ Logging
```

**Time:** 6-8 horas (backend dev)

**Commit:** `feat(pesquisa): implement NLP sentiment analysis [Sprint29]`

---

### Dia 10: Survey Routes

**SurveyChurnService:**
```typescript
src/services/survey-churn.service.ts
├─ create(casoChurnId)
├─ send(surveyId) → send email
├─ respond(surveyId, data) → queue NLP
├─ getPublicSurvey(surveyId, token)
└─ Dashboard KPIs
```

**Routes:**
```bash
POST /surveys/saida (public)
GET /surveys/:id/public (public, token)
POST /surveys/:id/respond (public)
GET /dashboard/pesquisa (CEO/SUPERVISAO_CS)
GET /relatorios/pesquisa (CEO)
```

**Time:** 6 horas (backend dev)

**Commit:** `feat(pesquisa): add survey endpoints and services`

---

### Dia 11-12: Frontend Survey Form + Dashboard

**Survey Pages:**
```bash
app/surveys/
├─ [id]/ (public survey form)
│  ├─ SurveyForm.tsx (multi-step)
│  ├─ SurveyQuestion.tsx
│  └─ SurveyThankYou.tsx
└─ admin/
   └─ page.tsx (dashboard)

components/pesquisa/
├─ DashboardPesquisa.tsx
├─ SentimentoChart.tsx
├─ MotivosChart.tsx
└─ Modals/
```

**Time:** 8 horas (frontend dev)

**Commit:** `feat(pesquisa): add survey form and admin dashboard`

---

### Dia 13-14: Email + Crons

**Sendgrid Integration:**
```typescript
src/lib/sendgrid.ts
├─ sendEmail(to, subject, html, tracking=true)
├─ Webhook handler POST /webhooks/sendgrid
│  ├─ Handle 'open', 'click', 'bounce'
│  └─ Update SurveyResposta fields
└─ Testing with mock
```

**Crons (node-schedule):**
```typescript
src/crons/
├─ auto-send-surveys.cron.ts (09:00)
├─ batch-nlp.cron.ts (23:00)
├─ detect-patterns.cron.ts (23:30)
└─ cache-cleanup.cron.ts (02:00)
```

**Time:** 6 horas (backend dev)

**Commit:** `feat(pesquisa): add Sendgrid integration and crons [Sprint29]`

**Demo:** Enviar survey → Responder → Ver análise NLP + motivos

---

## 📅 Semana 3 — Sprint 30: Campanhas + Testes

### Dia 15-16: Campanhas Service

**CampanhaService + AcaoService:**
```typescript
src/services/
├─ campanha.service.ts (create, list, ativar, pausar)
├─ segmentacao.service.ts (filtrar clientes por critérios)
├─ campanha-acao.service.ts (criar, executar, sequenciar)
└─ dashboard-campanha.service.ts (KPIs, charts)
```

**Routes (12 total):**
```bash
POST /campanhas
GET /campanhas
PATCH /campanhas/:id
POST /campanhas/:id/ativar
POST /campanhas/:id/segmentacao/filtrar
POST /campanhas/:id/acoes
GET /campanhas/:id/dashboard
... (see sprint30-step03-techlead.md)
```

**Time:** 8 horas (backend dev)

**Commit:** `feat(campanhas): implement campaign services and routes [Sprint30]`

---

### Dia 17-18: Frontend Campanhas

**Components:**
```bash
components/campanhas/
├─ CampanhaListPage.tsx
├─ CampanhaFormModal.tsx (multi-step)
├─ DashboardCampanha.tsx
├─ SegmentacaoStep.tsx
├─ AcoesStep.tsx
└─ Charts/ (Tendencia, Motivos)

hooks/
├─ useCampanha.ts
├─ useCampanhas.ts
├─ useSegmentacao.ts
└─ useDashboardCampanha.ts
```

**Pages:**
```bash
app/campanhas/
├─ page.tsx (list)
├─ nova/ (form)
└─ [id]/ (dashboard)
```

**Time:** 8 horas (frontend dev)

**Commit:** `feat(campanhas): add campaign UI and components`

---

### Dia 19-20: Testes + Refinements

**QA:**
- [ ] Run 60 test cases (20 per sprint)
- [ ] Coverage 80%+
- [ ] All routes tested
- [ ] E2E flows working
- [ ] Performance <500ms p95

**DevOps:**
- [ ] Docker working
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Staging ready
- [ ] API docs (Swagger/OpenAPI)

**Time:** 8-10 horas (QA + DevOps)

**Commit:** `test(all): comprehensive test suite and CI/CD`

---

### Dia 21: Demo + Documentation

- [ ] Deploy staging
- [ ] Create API docs
- [ ] Write deployment guide
- [ ] Demo para stakeholders
- [ ] Collect feedback

**Time:** 4 horas

---

## 📊 Summary por Sprint

| Sprint | Dias | Features | LOC | Tests |
|--------|------|----------|-----|-------|
| 28 | 7 | Dashboard, CRUD Casos, Diagnosis, Risk Matrix | 2000 | 20 |
| 29 | 7 | Survey, NLP, Sendgrid, Crons | 1800 | 20 |
| 30 | 7 | Campanhas, Segmentação, Ações | 1500 | 20 |
| **Total** | **21 dias** | **26 US** | **5300** | **60** |

---

## 🎯 Milestones

- **EOD Semana 1:** Sprint 28 MVP (Dashboard + CRUD Cases)
- **EOD Semana 2:** Sprint 29 MVP (Survey + NLP + Email)
- **EOD Semana 3:** Sprint 30 MVP (Campanhas + Filtros) + Full QA

---

## 👥 Alocação Recomendada

**Opção 1: Equipe de 3**
- **Backend Dev (40h):** Services + Routes + Crons (primária)
- **Frontend Dev (40h):** Components + Pages + Hooks (primária)
- **QA/DevOps (20h):** Testes + CI/CD + Deploy (suporte)

**Opção 2: Equipe de 2**
- **Full-Stack Senior (60h):** Backend + estrutura Frontend
- **Frontend Dev (40h):** Components + polish + testes

---

## 📋 Checklist Diário

Cada dev deve fazer commit diário:
```
Day 1: ✅ Setup
Day 2: ✅ CasoChurnService + Routes
Day 3: ✅ Dashboard component
Day 4: ✅ List + Filters
Day 5: ✅ Tests + Integration
...
```

---

## 🚀 Pronto para Começar?

Execute isto AGORA:
```bash
# 1. Setup
cd backend && pnpm install && pnpm db:push && pnpm dev

# 2. Em outro terminal
cd frontend && pnpm install && pnpm dev

# 3. Quando estiver rodando
git checkout -b feature/sprint-28-churn
# Start coding...
```

**Próximo:** Vou criar a **primeira rota API** (POST /casos-churn) para começar.

Quer que eu:
1. **Implemente a primeira rota API** (CasoChurnService + routes) — 1-2 horas
2. **Crie os componentes básicos** do frontend — 2-3 horas
3. **Configure tests** — 1 hora
4. **Outra coisa** — diga aqui

?

