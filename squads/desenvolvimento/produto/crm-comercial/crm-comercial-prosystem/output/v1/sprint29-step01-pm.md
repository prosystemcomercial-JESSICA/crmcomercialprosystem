# Sprint 29 — Step 01 — André Vieira (PM)
# Pesquisa de Motivos de Churn — Escopo e Requisitos

## Contexto Estratégico

O módulo **Pesquisa de Motivos de Churn** aprofunda a compreensão dos reasons por trás de cada cancelamento. Enquanto Sprint 28 captura o motivo inicial **estruturado** (enum de 10 opções), Sprint 29 permite **feedback aberto** do cliente sobre por que realmente saiu, com análise automática de sentimento e categorização inteligente.

**Impacto:** Reduzir churn recorrente identificando padrões reais vs. motivos reportados.

---

## Visão Geral do Módulo

### 3 Componentes Principais:

1. **Survey de Saída** — Questões abertas + estruturadas enviadas ao cliente em transição CANCELADO
2. **Análise de Feedback** — NLP automática (sentimento, extração de palavras-chave, categorização)
3. **Insights & Relatórios** — Dashboard com trends, padrões, recomendações

### Fluxo de Dados:

```
Cliente cancela (CANCELADO)
  ↓
[Email survey invitation] — SMS optional
  ↓
Cliente responde [web form, mobile-friendly]
  ↓
Feedback stored + sentiment analysis (NLP)
  ↓
Auto-categorização (keywords matching)
  ↓
Dashboard insights + relatórios
  ↓
CS/CEO vê padrões → previne próximo churn
```

---

## User Stories (8 total)

### US-2901 — Survey de Saída (Criação + Envio)

**Como:** Sistema automático
**Quero:** Enviar survey ao cliente que iniciou CANCELADO
**Para:** Coletar feedback qualitativo sobre saída

**Critérios:**

1. **POST /surveys/saida** — Criar survey entrada
   - Trigger automático quando: CasoChurn.status → CANCELADO
   - Campos gerados automaticamente:
     * Cliente nome, empresa, MRR, tempo contratado
     * Motivo já selecionado (enum Sprint 28) como sugestão
   - Questões pré-definidas (config):
     * Q1: "Qual foi o principal motivo para cancelar?" (aberta, 0-500 chars)
     * Q2: "O que poderíamos ter feito melhor?" (aberta, 0-1000 chars)
     * Q3: "Qual é a probabilidade de retornar?" (1-10 slider)
     * Q4: "Recomendaria a ProSystem?" (sim/não/talvez)
     * Q5: "Qual foi sua experiência geral?" (1-5 stars)
   - Resposta: 201 + {surveyId, clienteId, status: 'PENDING'}

2. **POST /surveys/:id/send** — Enviar via email + SMS
   - Email: HTML template com link [Responder Survey]
   - SMS: Opcional, "Sua opinião importa: [link curto]"
   - Tracking: clickCount, openedAt, respondedAt
   - Rate limiting: 1 email por cliente CANCELADO por mês
   - Response: 200 + {enviado: true, canais: ['email', 'sms']}

3. **GET /surveys/saida** — Listar surveys
   - Filtros: status (PENDING, OPENED, RESPONDED, EXPIRED), clienteId, dataRange
   - Paginação, cache 10min
   - Response: array com summary (respondido? há quanto tempo?)

4. **Validações:**
   - Survey só criada se CasoChurn.status = CANCELADO
   - Cliente email válido (regex)
   - Duplicata check: 1 survey PENDING+RESPONDED por cliente
   - Expiração: Survey válida por 30 dias, depois muda status='EXPIRED'

5. **HistoricoLead:**
   - tipo='survey_saida_enviado' (silencioso, ao enviar email)
   - tipo='survey_saida_respondido' (ao cliente responder)

---

### US-2902 — Resposta Survey (Frontend Web + Validações)

**Como:** Cliente cancelado
**Quero:** Responder survey de saída de forma fácil
**Para:** Dar feedback qualitativo

**Critérios:**

1. **GET /surveys/:id/public** — Página pública (sem auth)
   - URL: `https://crm.prosystem.com.br/survey/abc123xyz?token=...`
   - Token valida: CasoChurn.id + secret key
   - Expirado? Mostra "Survey expirada. Obrigado!"
   - Mobile-responsive form
   - Design: clean, ProSystem branding, estimado 5min para responder

2. **POST /surveys/:id/respond** — Submeter respostas
   - Payload: {surveyId, responses: {q1: "...", q2: "...", q3: 8, q4: "sim", q5: 4}, metadata: {ipAddress, userAgent, completionTime}}
   - Validações:
     * Q1 obrigatória, min 10 chars
     * Q2 opcional
     * Q3 entre 1-10
     * Q4 enum (sim/não/talvez)
     * Q5 entre 1-5
   - Response: 200 + {respondido: true, surveyId}
   - Survey.status → RESPONDED
   - Survey.respondedAt = now
   - Trigger HistoricoLead tipo='survey_saida_respondido'

3. **Frontend Survey Form:**
   - Q1 (textarea): "Qual foi o principal motivo para cancelar?" — com placeholder mencionando motivo já reportado
   - Q2 (textarea): "O que poderíamos ter feito melhor?" — optional
   - Q3 (slider 1-10): "Qual é a probabilidade de retornar em 12 meses?" — com labels "Improvável" e "Muito provável"
   - Q4 (radio): "Recomendaria ProSystem a colegas?" — Sim / Não / Talvez
   - Q5 (stars 1-5): "Qual foi sua experiência geral?"
   - Submit button, progress indicator (5 of 5 questions)
   - Error messages inline
   - Success screen: "Obrigado seu feedback! Vamos melhorar."

4. **Dados armazenados:**
   - Tabela: SurveyResposta
   - Columns: id, surveyId, q1_resposta, q2_resposta, q3_score, q4_opcao, q5_stars, sentimento_q1, sentimento_q2, keywords_q1, keywords_q2, respondedAt, ipAddress, completionTime

---

### US-2903 — Análise de Sentimento (NLP)

**Como:** Sistema (automático)
**Quero:** Analisar sentimento das respostas abertas
**Para:** Entender tom emocional além das palavras

**Critérios:**

1. **Sentiment Analysis (POST /surveys/:id/analyze)**
   - Input: Q1 + Q2 texto
   - Biblioteca: `compromise` (NLP JavaScript leve) ou API externa (Google NL, Azure)
   - Output por pergunta:
     * **sentiment_score:** -1.0 (very negative) até +1.0 (very positive)
     * **sentiment_label:** MUITO_NEGATIVO / NEGATIVO / NEUTRO / POSITIVO / MUITO_POSITIVO
     * **confidence:** 0-100 (quanto o modelo confia)
   - Cálculo:
     * Palavras negativas (-1): "ruim", "péssimo", "lento", "caro", "ignorado", "decepção"
     * Palavras neutras (0): "mudança", "crescimento", "outras opções"
     * Palavras positivas (+1): "obrigado", "bom", "excelente", "recomendo"
   - Exemplos:
     * "Produto é péssimo e suporte não responde" → -0.9 (MUITO_NEGATIVO)
     * "Achamos melhor mudar para concorrente" → -0.2 (NEGATIVO)
     * "Ótimo produto, mas precisamos de funcionalidade X" → +0.3 (POSITIVO)

2. **Keyword Extraction:**
   - Top 5 keywords por resposta (usando TF-IDF ou simples pattern matching)
   - Exemplos: "preço", "integrações", "suporte", "performance", "falta feature"
   - Armazenar em banco: `keywords: ["preço", "integrações"]`

3. **Automático ao responder:**
   - Trigger: POST /surveys/:id/respond → chama NLP analysis em background
   - Resultado salvo em SurveyResposta.sentimento_q1, sentimento_q2, keywords_q1, keywords_q2
   - Cache análise: mesmo texto idêntico não re-analisa (check hash)

4. **Performance:**
   - Análise < 2 seg por resposta (assíncrona, não bloqueia POST)
   - Batch análise noturna para histórico (cron 23:00)

---

### US-2904 — Auto-categorização (Motivo Real)

**Como:** Sistema
**Quero:** Categorizar feedback aberto em uma das 10 categorias de motivo
**Para:** Comparar motivo reportado vs. motivo real

**Critérios:**

1. **Pattern Matching + Keywords:**
   - Mapeamento: keywords → categoria motivo
   - Exemplos:
     * Keywords ["preço", "caro", "aumento"] → PRECO
     * Keywords ["integrações", "API", "conectar"] → INTEGRACAO_PROBLEMAS
     * Keywords ["lento", "performance", "lag"] → PERFORMANCE_LENTA
     * Keywords ["suporte", "não responde", "atendimento"] → FALTA_SUPORTE
     * Keywords ["mal uso", "dificuldade", "complexo"] → MAL_USO_PRODUTO
     * Keywords ["concorrente", "mudou para", "alternativa"] → MIGRACAO_CONCORRENCIA
   - Scoring: se >= 3 keywords coinciderem, confiança alta; se 1-2, média; senão, sem categoria

2. **Confidence Score:**
   - HIGH: 90-100% (múltiplas keywords match)
   - MEDIUM: 60-89% (1-2 keywords + contexto)
   - LOW: 30-59% (1 keyword apenas)
   - NONE: < 30% (nenhuma match, ambíguo)

3. **Manual Override:**
   - CS/CEO pode editar categoria automática se discordar
   - PATCH /surveys/:id/categorize {motivo_real: PRECO, confianca_corrigida: MEDIUM}

4. **Armazenamento:**
   - Tabela SurveyResposta: motivo_real (enum), confianca_categoriza (HIGH/MEDIUM/LOW/NONE), manualCorrected (bool)

5. **Comparação:**
   - Dashboard exibe: Motivo Reportado (Sprint 28) vs. Motivo Real (Sprint 29)
   - Discrepâncias insight: "40% reportam 'Preço' mas feedback real é 'Falta de Suporte'"

---

### US-2905 — Dashboard Pesquisa (Insights + Trends)

**Como:** CEO, Supervisão CS, FINANCEIRO
**Quero:** Ver dashboard com insights de pesquisas
**Para:** Identificar patterns reais de churn

**Critérios:**

1. **GET /dashboard/pesquisa** — Dashboard principal
   - Role-based: CEO/ADMIN veem todos, SUPERVISAO_CS veem sua equipe, CS_RETENCAO não acessa
   - Cache 30min
   - Seções:

2. **KPI Cards:**
   - Total Surveys: count de SurveyResposta com status=RESPONDED
   - Response Rate: (respondidas / enviadas) × 100
   - Avg Sentiment: média aritmética de sentiment_score
   - Top Keyword: keyword mais frequente

3. **Gráficos:**

   a) **Motivo Reportado vs. Real** (BarChart comparativo)
   - X-axis: 10 categorias motivo
   - Y-axis: contagem
   - Série 1: motivo reportado (CasoChurn.motivo)
   - Série 2: motivo real (SurveyResposta.motivo_real)
   - Highlight discrepâncias

   b) **Sentimento Distribuição** (PieChart)
   - Fatias: MUITO_NEGATIVO (vermelho), NEGATIVO (laranja), NEUTRO (cinza), POSITIVO (verde), MUITO_POSITIVO (dark green)
   - Legend com contagem

   c) **Likelihood Retornar** (BarChart)
   - X-axis: 1-10 score
   - Y-axis: contagem respostas
   - Esperado: distribuição normal ou skewed left (maioria baixa = low willingness)

   d) **Recomendaria?** (PieChart)
   - Sim / Não / Talvez + contagem

   e) **Top 10 Keywords** (BarChart horizontal)
   - Palavras-chave mais frequentes em Q1 + Q2
   - Formato: keyword | count

4. **Filtros:**
   - Período: últimos 7d, 30d, 90d, custom
   - Motivo: dropdown (todos ou 1 específico)
   - Sentimento: radio (todos, muito_negativo, negativo, etc.)
   - Response Status: PENDING, RESPONDED, EXPIRED

5. **Tabela Surveys:**
   - Columns: Data, Cliente, Motivo Reportado, Motivo Real, Sentimento Q1, Q3 Score, Respondeu?, Tempo Resposta
   - Sort: por data DESC, sentiment ASC, likelihood DESC
   - Hover: preview Q1 + Q2 respostas

6. **Alertas Automáticos:**
   - Se >= 5 surveys em 7d com sentiment MUITO_NEGATIVO → email CEO "Alerta: Churn muito negativo"
   - Se keyword novo emerge (ex: "feature X faltando" aparece 3+ vezes) → alert "Novo padrão detectado"

---

### US-2906 — Análise Comparativa (Motivo Reportado vs. Real)

**Como:** CEO, FINANCEIRO
**Quero:** Entender gaps entre o que clientes dizem vs. o que feedback real indica
**Para:** Corrigir estratégias de retenção

**Critérios:**

1. **GET /reports/motivos-comparacao** — Relatório XLSX
   - Query params: dataInicio, dataFim, motivo_filter
   - Abas no XLSX:

   a) **Matriz Confusão:**
   - Linhas: Motivo Reportado (enum 10)
   - Colunas: Motivo Real (enum 10)
   - Células: count de surveys
   - Exemplo:
     ```
                 PRECO  SUPORTE  PERFORMANCE  ...
     PRECO         15       3         1
     SUPORTE        2      10         2
     PERFORMANCE    1       1         8
     ```

   b) **Discrepâncias Insight:**
   - Lista: "De 40 PRECO reportados, apenas 15 são realmente PRECO. Motivo real: 10 SUPORTE, 8 MAL_USO"
   - Sugestão: "Melhorar processo de onboarding e suporte em vez de apenas oferecer desconto"

   c) **Correlação Sentimento:**
   - Tabela: Motivo → Avg Sentiment
   - MUITO_NEGATIVO: FALTA_SUPORTE (-0.85), PERFORMANCE_LENTA (-0.78)
   - POSITIVO: MIGRACAO_CONCORRENCIA (+0.2) [menos emocional]

2. **KPI Insight:**
   - "Acurácia": % de casos onde motivo reportado = motivo real
   - Exemplo: 45% acurácia = 55% discrepância
   - Benchmark: "Indústria média: 50%"

3. **Recomendações Automáticas:**
   - AI gera sugestões baseadas em gaps
   - Ex: "Keyword 'integrações' aparece em 25% mas reportado como PRECO: revisar onboarding de integrações"

---

### US-2907 — Relatórios Customizados (Exportação)

**Como:** FINANCEIRO, CEO
**Quero:** Exportar relatórios de pesquisa em formatos variados
**Para:** Apresentar ao board / compartilhar com stakeholders

**Critérios:**

1. **GET /relatorios/pesquisa** — Endpoint multiformato
   - Query: tipo, formato, periodo, filtros
   - Tipos:
     * `tipo=respostas` → XLSX com todas as respostas brutas (ID, Cliente, Q1, Q2, Q3, Q4, Q5, sentimento, keywords)
     * `tipo=analise` → XLSX com análise consolidada (KPIs, gráficos, insights)
     * `tipo=comparacao` → XLSX com matriz confusão + recomendações (vide US-2906)
   - Formatos:
     * XLSX (default)
     * PDF (via pandoc ou similar)
     * JSON (para integrações)

2. **XLSX Estrutura (tipo=analise):**
   - Aba 1: Resumo Executivo (KPIs: Total, Response Rate, Avg Sentiment, Top Keywords)
   - Aba 2: Motivo Reportado vs. Real (matriz confusão)
   - Aba 3: Sentimento Distribuição (tabela + visual)
   - Aba 4: Top Keywords (10 principais)
   - Aba 5: Respondentes Detalhados (todos as respostas, sortáveis)
   - Aba 6: Insights & Recomendações (auto-geradas)

3. **Permissões:**
   - CEO/ADMIN: sem filtro
   - SUPERVISAO_CS: apenas sua equipe
   - FINANCEIRO: acesso a relatórios analíticos
   - CS_RETENCAO: sem acesso

4. **Performance:**
   - Geração < 5 seg para 500 surveys
   - Cache 30min (invalidado quando novo survey respondido)

---

### US-2908 — Integração com Retencao (Feedback Loop)

**Como:** Sistema
**Quero:** Usar insights de pesquisa para melhorar estratégia de retenção
**Para:** Executar ações mais efetivas em próximos casos

**Critérios:**

1. **Link Bidirecional:**
   - CasoChurn ← → SurveyResposta (FK: casoChurnId)
   - GET /casos-churn/:id/pesquisa → retorna survey respondida (se existe)
   - GET /surveys/:id → inclui caso info (cliente, motivo reportado, plan tentado)

2. **Recomendações de Ação:**
   - Se survey sentimento MUITO_NEGATIVO + keyword "suporte" → recomenda PlanoRetencao estrategia=SUPORTE_DEDICADO
   - Se survey Q3 (likelihood) < 3 → marca caso como "baixa chance recuperação" (não insistir em reativação)
   - Se Q4 (recomendaria) = "não" + high sentiment negativo → candidate para público "testimonial learning" (o que não fazer)

3. **CS Dashboard Widget:**
   - Ao abrir caso CANCELADO, exibe: "Survey respondida? [Sim] Ver feedback"
   - Modal exibe todas Q1-Q5 respostas + sentiment + keywords
   - CS vê: "Cliente reportou PRECO mas feedback real indica FALTA_SUPORTE — considere essa ação"

4. **Padrão Learning:**
   - Cron 02:00: Analisa surveys últimas 24h
   - Detecta novo padrão (ex: "keyword 'feature X' apareceu 3+ vezes")
   - Alert email a CEO: "Novo motivo de churn emergindo: Feature X [detalhes]"
   - Trigger criação de task técnica ou discussion com product

---

## Tabelas (Prisma Schema)

### SurveyChurn
```
model SurveyChurn {
  id              String    @id @default(cuid())
  casoChurnId     String    @unique
  clienteId       String
  
  status          SurveyStatus @default(PENDING)  // PENDING | OPENED | RESPONDED | EXPIRED
  
  // Meta
  enviado_em      DateTime  @default(now())
  respondido_em   DateTime?
  expira_em       DateTime  // enviado_em + 30 dias
  
  // Contato
  email_enviado   Boolean   @default(false)
  sms_enviado     Boolean   @default(false)
  email_opened    Boolean   @default(false)
  click_count     Int       @default(0)
  completion_time Int?      // em segundos
  
  // Responses (armazenadas separadamente em SurveyResposta)
  respondida      Boolean   @default(false)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  caso            CasoChurn @relation(fields: [casoChurnId], references: [id], onDelete: Cascade)
  cliente         Cliente   @relation(fields: [clienteId], references: [id])
  resposta        SurveyResposta?
}

enum SurveyStatus {
  PENDING
  OPENED
  RESPONDED
  EXPIRED
}
```

### SurveyResposta
```
model SurveyResposta {
  id              String    @id @default(cuid())
  surveyId        String    @unique
  
  // Respostas às 5 perguntas
  q1_resposta     String    @db.Text  // "Qual foi o principal motivo"
  q2_resposta     String?   @db.Text  // "O que poderíamos melhorar"
  q3_score        Int       // 1-10: likelihood retornar
  q4_opcao        String    // sim | não | talvez: recomendaria?
  q5_stars        Int       // 1-5: experiência geral
  
  // Análise NLP automática
  sentimento_q1   Float     // -1.0 a +1.0
  sentimento_q1_label String // MUITO_NEGATIVO | NEGATIVO | NEUTRO | POSITIVO | MUITO_POSITIVO
  sentimento_q1_confianca Int // 0-100
  
  sentimento_q2   Float?
  sentimento_q2_label String?
  sentimento_q2_confianca Int?
  
  // Keywords extraction
  keywords_q1     String[]  // JSON array de top 5 keywords
  keywords_q2     String[]
  
  // Auto-categorização
  motivo_real     String?   // Enum de 10 categorias, calculado via pattern matching
  confianca_categoriza String? // HIGH | MEDIUM | LOW | NONE
  manual_corrected Boolean  @default(false)  // CS corrigiu categorização?
  
  // Metadata
  ip_address      String?
  user_agent      String?
  responded_at    DateTime  @default(now())
  
  survey          SurveyChurn @relation(fields: [surveyId], references: [id], onDelete: Cascade)
  
  @@index([sentimento_q1])
  @@index([motivo_real])
}
```

---

## Enums

```
enum SurveyStatus {
  PENDING
  OPENED
  RESPONDED
  EXPIRED
}

enum SentimentLabel {
  MUITO_NEGATIVO
  NEGATIVO
  NEUTRO
  POSITIVO
  MUITO_POSITIVO
}

enum ConfiancaCategoriza {
  HIGH
  MEDIUM
  LOW
  NONE
}
```

---

## APIs (Rotas Fastify)

| Método | Rota | Descrição | Cache |
|--------|------|-----------|-------|
| POST | /surveys/saida | Criar survey de saída | ❌ |
| POST | /surveys/:id/send | Enviar via email/SMS | ❌ |
| GET | /surveys/saida | Listar surveys | ✅ 10min |
| GET | /surveys/:id/public | Página pública (sem auth) | ✅ 30min |
| POST | /surveys/:id/respond | Submeter respostas | ❌ |
| POST | /surveys/:id/analyze | Rodar NLP analysis | ❌ |
| PATCH | /surveys/:id/categorize | Corrigir categorização | ❌ |
| GET | /dashboard/pesquisa | Dashboard insights | ✅ 30min |
| GET | /relatorios/pesquisa | Exportar relatório | ✅ 30min |
| GET | /casos-churn/:id/pesquisa | Pesquisa associada ao caso | ✅ 30min |

---

## Crons

| Horário | Evento | Ação |
|---------|--------|------|
| 09:00 | Auto-envio surveys | Busca CANCELADO 24h-48h atrás, envia survey se não enviada ainda |
| 23:00 | Batch NLP analysis | Processa surveys OPENED mas não analisadas (análise in-batch) |
| 23:30 | Detecta novos padrões | Top keywords últimas 24h, se keyword novo emerge 3+x → alert CEO |
| 02:00 | Learning cron | Gera recomendações de ação baseado em surveys respondidas ontem |

---

## Decisões de Design

1. **Survey Automática** — Trigger ao CANCELADO, não manual
   - Rationale: Captura feedback enquanto "emoção fresca", máxima espontaneidade

2. **NLP Lightweight** — `compromise` library vs. API externa
   - Rationale: Sem latência de rede, funciona offline, custo zero vs. Google/Azure

3. **Motivo Real Auto-categorizado** — Pattern matching + keywords
   - Rationale: Não requer modelo ML treinado; rápido, interpretável, correção manual possível

4. **Survey Expira 30 dias** — Bom balanço
   - Rationale: Feedback relevante se < 30d; além disso, contexto pode mudar

5. **Public URL com token** — Sem login necessário
   - Rationale: Reduz fricção; clientes já saíram, não querem criar conta

6. **Permissões:** FINANCEIRO vê relatórios, CS_RETENCAO não acessa
   - Rationale: Dados sensíveis (feedback negativo), estratégico para C-level + finanças

---

## Métricas de Sucesso

- **Response Rate** >= 30% (benchmark indústria: 15-25%)
- **Tempo resposta** < 10 min (fácil + rápido)
- **Acurácia categorização** >= 75% (auto vs. manual check)
- **Insight actionable** >= 1 novo padrão detectado/mês
- **Time-to-insight** < 4h (cron 23:00, CEO vê alerta 02:00+)

---

## MVP Phase 1 Scope

✅ **Included:**
- Survey automática ao CANCELADO
- Form web com 5 questões
- Análise sentimento Q1 + Q2
- Auto-categorização motivos
- Dashboard com KPIs + gráficos
- Relatório XLSX comparação
- Integração com Retencao (link bidirecional)
- Alertas padrões novos

❌ **Phase 2 (futuro):**
- Survey customizável por cliente/segmento
- ML modelo treinado para categorização (vs. pattern matching)
- Integração com terceiros NPS (SurveyMonkey, Typeform)
- Análise de tendência temporal (churn reason evolution)
- Red teaming surveys (testar alternativas de questões)

---

## Sprint 29 — PRONTO PARA UX ✅

Next: Patrícia Moura (UX Designer) — wireframes para dashboard, surveys, relatórios
