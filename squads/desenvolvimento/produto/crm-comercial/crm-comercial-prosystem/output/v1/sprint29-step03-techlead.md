# Sprint 29 — Step 03 — Daniel Mendes (Tech Lead)
# Pesquisa de Motivos de Churn — Arquitetura e Schema

## Stack & Decisões Técnicas

**Sentimento NLP:** `compromise` library (lightweight, JavaScript, offline)  
**Auto-categorização:** Pattern matching + TF-IDF keywords (vs ML model)  
**Database:** Prisma ORM + PostgreSQL (FK relations com Retencao)  
**Cache:** node-cache 10min dashboard, 30min relatórios  
**Async:** Background NLP analysis, não bloqueia POST /respond

---

## Prisma Schema (2 Tabelas Novas)

```prisma
model SurveyChurn {
  id              String    @id @default(cuid())
  casoChurnId     String    @unique
  clienteId       String
  
  status          SurveyStatus @default(PENDING)
  enviado_em      DateTime  @default(now())
  respondido_em   DateTime?
  expira_em       DateTime  // now + 30 dias
  
  email_enviado   Boolean   @default(false)
  sms_enviado     Boolean   @default(false)
  email_opened    Boolean   @default(false)
  click_count     Int       @default(0)
  
  respondida      Boolean   @default(false)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  caso            CasoChurn @relation(fields: [casoChurnId], references: [id], onDelete: Cascade)
  cliente         Cliente   @relation(fields: [clienteId], references: [id])
  resposta        SurveyResposta?
  
  @@index([status])
  @@index([respondida])
}

model SurveyResposta {
  id              String    @id @default(cuid())
  surveyId        String    @unique
  
  q1_resposta     String    @db.Text
  q2_resposta     String?   @db.Text
  q3_score        Int       // 1-10
  q4_opcao        String    // sim|não|talvez
  q5_stars        Int       // 1-5
  
  // NLP Analysis
  sentimento_q1   Float     // -1.0 a +1.0
  sentimento_q1_label String
  sentimento_q1_conf Int    // 0-100
  
  sentimento_q2   Float?
  sentimento_q2_label String?
  sentimento_q2_conf Int?
  
  keywords_q1     String[]  // JSON array
  keywords_q2     String[]
  
  // Auto-categorização
  motivo_real     String?   // Enum 10 categorias
  confianca       String?   // HIGH|MEDIUM|LOW|NONE
  manual_corrected Boolean  @default(false)
  
  ip_address      String?
  responded_at    DateTime  @default(now())
  
  survey          SurveyChurn @relation(fields: [surveyId], references: [id], onDelete: Cascade)
  
  @@index([sentimento_q1])
  @@index([motivo_real])
}

enum SurveyStatus {
  PENDING
  OPENED
  RESPONDED
  EXPIRED
}
```

---

## Services (3 principais)

### 1. SurveyChurnService
- `create(casoChurnId)` → SurveyChurn criada, status=PENDING
- `send(surveyId)` → email + SMS, tracking
- `list(filters)` → com paginação + cache 10min
- `checkExpiry()` → cron diária, move para EXPIRED se > 30d

### 2. NLPSentimentService
```typescript
async analyzeSentiment(text: string): Promise<{
  score: number,      // -1.0 a +1.0
  label: string,      // MUITO_NEGATIVO|NEGATIVO|NEUTRO|POSITIVO|MUITO_POSITIVO
  confidence: number  // 0-100
}>
```
- Usa `compromise` para word tokenization
- Dicionário de palavras positivas/negativas em português
- Cache análise (hash text → resultado)

### 3. AutoCategorizationService
```typescript
async categorize(keywords: string[]): Promise<{
  motivo: string,      // Enum 10 categorias
  confidence: string   // HIGH|MEDIUM|LOW|NONE
}>
```
- Pattern matching: keywords vs. dicionário por categoria
- HIGH: >= 3 keyword matches
- MEDIUM: 1-2 matches + contexto
- LOW: 1 keyword apenas
- NONE: nenhuma match

---

## Routes (10 Fastify)

| Método | Rota | Auth | Cache |
|--------|------|------|-------|
| POST | /surveys/saida | sys (trigger ao CANCELADO) | ❌ |
| POST | /surveys/:id/send | CEO/SYS | ❌ |
| GET | /surveys/saida | CEO/SYS | ✅ 10min |
| GET | /surveys/:id/public | public (token) | ✅ 30min |
| POST | /surveys/:id/respond | public | ❌ |
| POST | /surveys/:id/analyze | sys (background) | ❌ |
| PATCH | /surveys/:id/categorize | CEO/SYS | ❌ |
| GET | /dashboard/pesquisa | CEO/SUPERVISAO_CS/FINANCEIRO | ✅ 30min |
| GET | /relatorios/pesquisa | CEO/FINANCEIRO | ✅ 30min |
| GET | /casos-churn/:id/pesquisa | owner/supervisor | ✅ 30min |

---

## Crons (4 jobs)

| Horário | Evento |
|---------|--------|
| 09:00 | Auto-envio surveys (CANCELADO 24h-48h atrás) |
| 23:00 | Batch NLP (surveys OPENED não analisadas) |
| 23:30 | Detecta padrões (top keywords, alert CEO se novo) |
| 02:00 | Learning (gera recomendações, invalida cache) |

---

## Integration Points

- **CasoChurn:** FK casoChurnId em SurveyChurn
- **HistoricoLead:** Tipos novos: survey_enviado, survey_respondido
- **Cliente:** FK clienteId em SurveyChurn
- **Dashboard:** Query SurveyResposta para KPIs

---

## Sprint 29 Step 03 — Tech Lead PRONTO ✅

Next: Felipe Santos (Backend) — implementação services + routes
