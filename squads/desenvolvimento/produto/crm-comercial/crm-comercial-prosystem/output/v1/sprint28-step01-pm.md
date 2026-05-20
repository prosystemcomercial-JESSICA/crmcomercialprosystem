# Sprint 28 — Step 01 — André Vieira (PM)
# Churn e Retenção — Escopo e Requisitos

## Contexto Estratégico

O módulo **Churn e Retenção** é o core de gestão de clientes em risco na ProSystem. Implementa:
- **Identificação automática** de clientes com risco de cancelamento
- **Diagnóstico estruturado** de motivos de churn (insatisfação, mal uso, concorrência, etc.)
- **Planos de retenção customizados** com estratégias CS
- **Rastreamento de ações** tomadas para reter
- **Métricas e alertas** em tempo real para CS/Supervisão
- **Recuperação de clientes** perdidos (reativação)

**Prioridade Phase 1:** Core 12 modules (Dashboard, Casos, Diagnosis, Risk Matrix, Plans, Ações, Pendências, Negociações, Cancelamentos, Retidos, Recuperação, Relatórios)
**Phase 2 (futuro):** Pesquisa de motivos, Configurações avançadas, Integrações NPS externas

---

## User Stories

### US-2801 — Dashboard de Retenção (KPIs + Overview)

**Como:** CS Lead, Supervisão CS
**Quero:** Ver um dashboard centralizado mostrando status de retenção em tempo real
**Para:** Priorizar clientes em risco e acompanhar taxa de sucesso

**Critérios:**

1. **GET /dashboard/retencao** — Dashboard principal
   - Role SUPERVISAO_CS, FINANCEIRO, CEO/DIRETORIA → veem todos os dados
   - Role CS_RETENCAO → veem apenas clientes atribuídos + summary de sua equipe
   - Cache 10min por userId + filtroVendedorId (se SUPERVISAO)
   - Resposta JSON com seções (KPIs, Cards, Gráficos)

2. **KPIs Calculados (lado servidor, não stored em banco)**
   - `clientesEmRisco` = contagem CasoChurn com status=ATIVO E dataFinal > hoje
   - `clientesRecuperados` = contagem CasoChurn com status=REATIVADO no mês
   - `taxaSucessoRetenção` = (clientesRetidos / clientesEmRisco última 30d) × 100
   - `clientesPerdidos` = contagem CasoChurn status=CANCELADO/CHURNED no período
   - `revenueEmRisco` = SUM(Cliente.MRR) onde Cliente tem CasoChurn ATIVO
   - `receituaRecuperada` = SUM(Contrato.valor) de CasoChurn REATIVADO no período

3. **Cards no Dashboard**
   - Card 1: "Clientes em Risco Hoje" — número grande, cor vermelha se > 5
   - Card 2: "Recuperados este mês" — verde, meta = 2 (configurável)
   - Card 3: "Taxa de Sucesso" — amarelo se < 60%, verde se >= 70%
   - Card 4: "Revenue em Risco" — vermelho se > R$ 50k (configurável)

4. **Gráficos (Recharts)**
   - **LineChart:** Taxa sucesso nos últimos 90 dias (diários)
   - **BarChart:** Motivos top 5 de churn (quantidade casos)
   - **PieChart:** Status distribuição (ATIVO/REMARCADO/NEGOCIANDO/CANCELADO/REATIVADO)
   - **BarChart horizontal:** Top 10 clientes em risco (por revenue)

5. **Filtros Quick (no topo)**
   - Por status: ATIVO, CANCELADO, REATIVADO
   - Por risk score: CRITICO (80+), ALTO (60-79), MEDIO (40-59), BAIXO (0-39)
   - Por data: Últimos 7d, 30d, 90d
   - Filtros atuam como URL params; GET /dashboard/retencao?status=ATIVO&riskScore=CRITICO&periodo=7d

6. **Loading state + Error boundaries**
   - Skeleton loaders durante cálculo inicial
   - Se API falhar → fallback com dados cacheados ou aviso "Dados desatualizados"
   - Toast erro se > 3s de cálculo

---

### US-2802 — Caso de Churn (CRUD + Validações)

**Como:** CS de Retenção, Supervisão CS
**Quero:** Criar, editar e acompanhar casos de churn com todas as informações estruturadas
**Para:** Documentar tentativas de retenção e histórico de cada cliente em risco

**Critérios:**

1. **POST /casos-churn** — Criar novo caso
   - Campos obrigatórios: `clienteId`, `clienteBaseId`, `motivo` (enum), `sentimento`, `atribuidoParaId` (CS)
   - Campos opcionais: `descricao`, `dataAlertaGerado`, `dataAgendadoContato`
   - Validações:
     * Cliente não pode ter OUTRO caso aberto com status=ATIVO (retorna 409)
     * `clienteBaseId` (contrato) deve estar vinculado ao Cliente (FK)
     * `atribuidoParaId` deve ser ROLE CS_RETENCAO ou SUPERVISAO_CS
   - Response: 201 + `{ id, clienteId, status, riskScore, criadoEm, criadoPor }`
   - HistoricoLead automático: tipo='caso_churn_aberto'

2. **GET /casos-churn** — Listar casos com filtros
   - Filtros disponíveis (22 dimensões):
     * **Status:** ATIVO, REMARCADO, NEGOCIANDO, CANCELADO, REATIVADO, FECHADO
     * **Risk Score:** CRITICO (80+), ALTO (60-79), MEDIO (40-59), BAIXO (0-39)
     * **Motivo:** insatisfacao_servico, mal_uso_produto, migracao_concorrencia, preco, falta_suporte, integracao_problemas, volume_baixo, personalizacao_insuficiente, performance_lenta, outros
     * **Sentimento:** muito_negativo, negativo, neutro, positivo
     * **Atribuído para:** filtro por CS ou "sem atribuição"
     * **Data:** últimos 7d, 30d, 90d, intervalo custom
     * **Revenue:** > R$ 10k, > R$ 50k, > R$ 100k
     * **Lead associado:** filtro por nome/email
     * **Propostas pendentes:** S/N
     * **Agenda próxima:** com/sem evento
     * **Plano criado:** S/N
     * **Última ação:** últimos 3d, 7d, 14d, 30d, > 30d
     * **Supervisor:** filtro por supervisor (se SUPERVISAO/CEO)
   - Paginação: limit=50, offset=0
   - Ordenação padrão: riskScore DESC, dataAlerta ASC
   - Role SUPERVISAO_CS/CEO → veem todos; CS_RETENCAO → apenas atribuídos + equipe do supervisor
   - Cache 5min por userId + filtros

3. **PATCH /casos-churn/:id** — Editar caso
   - Campos editáveis: `descricao`, `sentimento`, `motivo`, `atribuidoParaId`, `dataAgendadoContato`
   - Permissão: criador, atribuído ou SUPERVISAO_CS+
   - Se edita `motivo` ou `sentimento` → recalcula riskScore
   - Response: 200 + caso atualizado
   - HistoricoLead automático se motivo/sentimento mudam

4. **GET /casos-churn/:id** — Detalhe completo
   - Retorna: caso base + cliente info + propostas abertas + eventos agenda + ações CS + histórico
   - Seções lazy-loaded: propostas, eventos, ações (React Query staleTime 5min cada)

5. **Status Transitions (via PATCH /casos-churn/:id/status)**
   - **ATIVO → REMARCADO:** agenda contato futuro (modal com data/hora)
   - **ATIVO → NEGOCIANDO:** necessário descricao de estratégia de negociação
   - **ATIVO → CANCELADO:** necessário motivo final + opção "Recuperação futura" (move para RETIDO)
   - **ATIVO → REATIVADO:** contato aceita retenção (marca proposta/contrato como reativado)
   - **REMARCADO → ATIVO/NEGOCIANDO/CANCELADO/REATIVADO:** ações baseadas no resultado do contato
   - Cada transição gera HistoricoLead com tipo específico
   - Modal de confirmação com contexto (cliente, revenue, dias aberto)

---

### US-2803 — Diagnosis (Motivos + Sentimento + Chance de Sucesso)

**Como:** CS de Retenção
**Quero:** Preencher um diagnóstico estruturado do porquê o cliente quer sair
**Para:** Entender a raiz do problema e aplicar estratégia adequada

**Critérios:**

1. **PATCH /casos-churn/:id/diagnosis** — Preenchimento de diagnosis
   - Campos:
     * `motivo` (enum de 10 valores): insatisfacao_servico, mal_uso_produto, migracao_concorrencia, preco, falta_suporte, integracao_problemas, volume_baixo, personalizacao_insuficiente, performance_lenta, outros
     * `detalheMotivo` (text até 1000 chars): descrição do problema específico
     * `sentimento` (enum): muito_negativo, negativo, neutro, positivo
     * `avaliacaoSuporte` (1-5): qualidade do suporte recebido
     * `grauInsatisfacao` (1-10): intensidade
     * `chanceRecuperacao` (enum): muito_baixa (0-20%), baixa (20-40%), media (40-60%), alta (60-80%), muito_alta (80-100%)
   - Validações: todos os campos obrigatórios
   - Auto-calcula **riskScore** = (11 - sentimento) × 10 + (grauInsatisfacao × 2) - (avaliacaoSuporte × 8)
     * Resultado clamped entre 0-100
     * Exemplo: sentimento=muito_negativo(1), grauInsatisfacao=10, avaliacaoSuporte=1 → riskScore ≈ 100
     * Exemplo: sentimento=positivo(4), grauInsatisfacao=3, avaliacaoSuporte=5 → riskScore ≈ 20
   - Response: 200 + riskScore + diagnosis completo
   - HistoricoLead automático: tipo='diagnosis_preenchido'

2. **GET /casos-churn/:id/diagnosis** — Retorna diagnosis preenchido + riskScore atual

3. **Recomendação automática de estratégia** (exibir no frontend, não armazenar)
   - riskScore >= 80 → "Estratégia Urgente: contato imediato, oferecer desconto/cortesia"
   - riskScore 60-79 → "Estratégia Proativa: reunião com executivo, revisar uso"
   - riskScore 40-59 → "Estratégia Standard: check-in, treinamento, oferecer feature"
   - riskScore < 40 → "Estratégia Light: acompanhar, feedback survey, baixo risco"

---

### US-2804 — Risk Matrix (Auto-cálculo de Risco)

**Como:** Sistema (automático)
**Quero:** Calcular um risk score consolidado usando 5 dimensões de dados do cliente
**Para:** Priorizar clientes mais críticos

**Critérios:**

1. **Dimensões de risco (weights)**
   - **D1 — Diagnosis:** riskScore da diagnosis preenchida (0-100) — weight 40%
   - **D2 — Revenue Health:** MRR do cliente
     * MRR >= 100k → score 10
     * 50k-99k → score 25
     * 10k-49k → score 40
     * < 10k → score 60
     * Weight 25%
   - **D3 — Contract Maturity:** dias desde first_contrato
     * < 3 meses → score 60 (novato, risco)
     * 3-12 meses → score 40
     * 1-2 anos → score 25
     * >= 2 anos → score 10
     * Weight 15%
   - **D4 — Usage Health:** baseado em histórico últimos 30d
     * Sem logins em 30d → score 90
     * Sem logins em 14d → score 70
     * Logins < 1x/semana → score 40
     * Login >= 1x/semana → score 10
     * Weight 15%
   - **D5 — Support Load:** tickets suporte últimos 90d
     * >= 10 tickets → score 70 (muito problema)
     * 5-9 tickets → score 40
     * 1-4 tickets → score 20
     * 0 tickets → score 5
     * Weight 5%

2. **Cálculo final**
   - `riskScore = (D1×0.4 + D2×0.25 + D3×0.15 + D4×0.15 + D5×0.05)` → clamped 0-100
   - Recalculado a cada mudança em diagnosis ou diariamente via cron 04:00 (background job)
   - Cron valida todos os CasoChurn ATIVO, refaz cálculo, compara com valor anterior
   - Se score sobe 20+ pontos → emit WebSocket alert para supervisor + toast "Cliente em maior risco"

3. **Risk Score Categories (usadas em filtros + dashboard)**
   - CRITICO: 80-100 (cor vermelha)
   - ALTO: 60-79 (cor laranja)
   - MEDIO: 40-59 (cor amarela)
   - BAIXO: 0-39 (cor verde)

4. **Tabela RiskMatrixCache (para performance)**
   - Columns: casoChurnId, d1_diagnosis, d2_revenue, d3_maturity, d4_usage, d5_support, riskScoreTotal, calculadoEm
   - Upsert via cron
   - GET /casos-churn/:id/risk-matrix retorna histórico últimos 7 cálculos

---

### US-2805 — Plano de Retenção (Criação + Estratégia)

**Como:** CS de Retenção, Supervisão
**Quero:** Criar um plano de retenção customizado com estratégia específica
**Para:** Documentar como vamos tentar reter este cliente

**Critérios:**

1. **POST /planos-retencao** — Criar plano
   - Campos obrigatórios:
     * `casoChurnId` (FK)
     * `estrategia` (enum): desconto_preco, feature_customizada, suporte_dedicado, treinamento_intensivo, upgrade_plano, revisar_integracao, executivo_business_review, desconto_temporal_promotion
     * `descricaoEstrategia` (text até 2000 chars)
     * `setoresEnvolvidos` (array): [CS, TECH, EXECUTIVO, FINANCEIRO] — quem participa?
     * `dataLancamento` (date)
     * `dataMetaProposta` (date, opcional): até quando propostas devem estar fechadas
   - Validações:
     * Caso já pode ter UM plano por status (can have multiple planos, but only one ATIVO)
     * dataMetaProposta > dataLancamento
   - Response: 201 + { id, casoChurnId, status='ATIVO', ... }
   - HistoricoLead automático: tipo='plano_retencao_criado'

2. **GET /planos-retencao** — Listar planos (filtros: casoChurnId, status, estrategia)
   - Paginação + ordenação por dataLancamento DESC

3. **PATCH /planos-retencao/:id** — Editar plano (antes de executado)
   - Campos editáveis: descricaoEstrategia, estrategia, setoresEnvolvidos, dataMetaProposta
   - Permissão: criador ou SUPERVISAO_CS+
   - Status transitions:
     * ATIVO → PAUSADO: caso de cliente responde negativamente (com motivo)
     * ATIVO → EXECUTANDO: iniciou tentativa efetiva
     * EXECUTANDO → SUCESSO: cliente concordou em reativar (vincula novo contrato via CasoChurn.novoContratoId)
     * EXECUTANDO → FALHOU: cliente saiu mesmo assim (marca CasoChurn status=CHURNED)

4. **GET /planos-retencao/:id** — Detalhe com ações associadas (via CasoChurnAcao)

5. **Timeline visual**
   - Card mostra estratégia, setores envolvidos, data meta
   - Abaixo: ações registradas (próxima US-2806)
   - Status badge: ATIVO (azul), EXECUTANDO (amarelo), SUCESSO (verde), FALHOU (vermelho), PAUSADO (cinza)

---

### US-2806 — Ações de Retenção (Logging de Atividades)

**Como:** CS de Retenção, Tech, Executivo
**Quero:** Registrar ações tomadas para reter o cliente
**Para:** Rastrear esforços e aprender o que funciona

**Critérios:**

1. **POST /casos-churn/:casoChurnId/acoes** — Criar ação
   - Campos:
     * `tipoAcao` (enum): contato_telefonico, reuniao_executivo, envio_proposta, desconto_oferecido, feature_customizada_desenvolvida, treinamento_realizado, revisao_integracao, escalacao_diretoria
     * `descricao` (text até 1000 chars): o que foi feito
     * `resultado` (enum): positivo, negativo, indeterminado
     * `dataAcao` (date, default=hoje)
     * `resultado_detalhado` (text, opcional): feedback do cliente
     * `proximosPassos` (text, opcional): próximas ações planejadas
   - Validações: casoChurnId deve existir e estar com status=ATIVO/NEGOCIANDO
   - Response: 201 + { id, tipoAcao, resultado, ... }
   - HistoricoLead automático: tipo='acao_retencao_registrada' com detalhe=tipoAcao+resultado

2. **GET /casos-churn/:casoChurnId/acoes** — Timeline de ações
   - Ordenação por dataAcao DESC
   - Cada ação mostra: ícone (por tipo), descrição, resultado (cor verde/vermelho/cinza), data
   - Cache 2min

3. **PATCH /casos-churn/:casoChurnId/acoes/:acaoId** — Editar ação
   - Editável por 2h após criação ou SUPERVISAO_CS+
   - Campos: descricao, resultado, resultado_detalhado, proximosPassos

4. **Bulk actions logging** (PATCH /casos-churn/bulk-acoes)
   - Registra mesma ação para múltiplos casos (ex: "envio batch de promoção")
   - Params: `casoChurnIds=[]`, `tipoAcao`, `descricao`, `resultado`
   - Response: { logueadas: N }

---

### US-2807 — Relatórios de Churn (XLSX + Filtros)

**Como:** Supervisão CS, Financeiro, CEO
**Quero:** Gerar relatórios em XLSX com dados consolidados de churn
**Para:** Analisar tendências e reportar ao board

**Critérios:**

1. **GET /relatorios/churn** — Endpoint de exportação
   - Query params: `tipo`, `inicio`, `fim`, `vendedorId` (opcional), `supervisorId` (opcional)
   - Tipos de relatório:
     * `tipo=analise`: Resumo executivo
     * `tipo=detalhado`: Caso por caso com histórico
     * `tipo=motivos`: Motivos de churn com contagem + % + tendências
     * `tipo=estrategias`: Efetividade de cada estratégia
   - Response: buffer XLSX com múltiplas abas

2. **Relatório ANALISE (Aba 1: Resumo)**
   - Período, Total de casos, Total clientes perdidos, Total recuperados
   - Taxa sucesso retenção (%), Revenue em risco, Revenue recuperada
   - Top 5 motivos (gráfico de barras após tabela numérica)
   - Distribuição por risk score (tabela)
   - KPI trend últimos 90d (3 abas: diária, semanal, mensal)

3. **Relatório DETALHADO (Aba 2: Casos)**
   - Colunas: Data, Cliente, Revenue MRR, Motivo, Risk Score, Status Atual, Dias Aberto, Last Action, CS Atribuído, Supervisor, Propostas Abertas
   - Formatação: datas dd/MM/yyyy, moeda R$, valores alinhados

4. **Relatório MOTIVOS (Aba 3)**
   - Motivo, Count, %, Status dist. (ATIVO/REMARCADO/REATIVADO/CANCELADO)
   - Classificação automática por frequência

5. **Relatório ESTRATEGIAS (Aba 4)**
   - Estratégia, Tentativas, Sucesso (count), Taxa sucesso %
   - Ordena por taxa sucesso DESC

6. **Permissões**
   - CEO/ADMIN → relatório sem filtro obrigatório
   - SUPERVISAO_CS → pode filtrar por vendedorId de sua equipe
   - FINANCEIRO → acesso a revenue + tax reports
   - CS_RETENCAO → acesso restrito (próprios casos apenas)

7. **Caching + Performance**
   - Cache 30min por userId + filtros
   - Geração background se > 5000 registros (enfileira, retorna arquivo quando pronto)

---

### US-2808 — Permissões e Acesso por Papel

**Como:** Sistema
**Quero:** Aplicar controle de acesso granular baseado em 4 tipos de usuário
**Para:** Proteger dados e garantir apenas ações autorizadas

**Critérios:**

1. **Roles e Permissões**

   | Ação | CS_RETENCAO | SUPERVISAO_CS | FINANCEIRO | CEO/DIRETORIA |
   |------|-------------|---------------|-----------|---------------|
   | Criar caso | Sim (atribuído a si) | Sim (atribui a qualquer CS) | Não | Sim |
   | Editar caso próprio | Sim | Sim | Não | Sim |
   | Editar caso de outro | Não (403) | Sim (sua equipe) | Não | Sim |
   | Ver dashboard | Sim (filtro próprios) | Sim (filtro equipe) | Sim (revenue) | Sim (todos) |
   | Preencher diagnosis | Sim | Sim | Não | Sim |
   | Criar plano | Sim | Sim | Não | Sim |
   | Registrar ação | Sim | Sim | Sim (só logging) | Sim |
   | Gerar relatórios | Não | Sim (equipe) | Sim | Sim |
   | Bulk actions | Não | Sim | Não | Sim |
   | Editar stratégia cron/alertas | Não | Não | Não | Sim |

2. **Middleware de Autorização** — Verificar role + recurso_owner + supervisor_hierarchy
   - Middleware `requireRole(['CS_RETENCAO', 'SUPERVISAO_CS'])` em rotas
   - Middleware `requireCasoOwnershipOrSupervisor` em edições
   - GET /casos-churn/:id/check-permission → valida se user pode acessar

3. **Field-level Permissions** (frontend)
   - CS_RETENCAO não vê campo `remuneracaoCS` (sensível)
   - FINANCEIRO vê apenas colunas de revenue
   - Frontend hidese campos baseado em role (backend sempre valida)

---

### US-2809 — Alertas Automáticos (Notificações em Tempo Real)

**Como:** Sistema
**Quero:** Gerar alertas automáticos para CS/Supervisão quando clientes críticos precisam de atenção
**Para:** Reduzir time-to-action e evitar churn

**Critérios:**

1. **Alertas Automáticos (Crons)**

   | Cron | Evento | Trigger | Destinatário | Ação |
   |------|--------|---------|--------------|------|
   | 06:30 | Cliente em Risco Crítico | Novo caso com riskScore >= 80 | CS atribuído + Supervisor | Toast + email + webhook |
   | 08:00 | Case vencido | CasoChurn.dataAgendadoContato < hoje E status=ATIVO | CS + Supervisor | Toast "Overdue contact - reschedule?" |
   | 12:00 | Ação pendente | 3d+ sem registrar ação no caso | CS + Supervisor | Email com link direto |
   | 18:00 | Plano meta vencida | Plano.dataMetaProposta < hoje E plano.status != SUCESSO | Supervisor | Alert "Action deadline missed" |
   | 22:00 | RiskScore aumentou 20+ | Recalc automático mostra D1/D2/D3/D4/D5 piora 20+ | CS + Supervisor | Toast "Risk changed from 45→68, review diagnosis" |

2. **WebSocket Events**
   - Socket `retencao:caso-criado` → emit ao criar caso (para Supervisor ver novos)
   - Socket `retencao:risk-mudou` → emit se riskScore sobe >= 20
   - Socket `retencao:alerta` → emit para alertas cron
   - Frontend ouve e exibe toast com CTA (ir ao caso, editar, etc.)

3. **Email Alerts**
   - Template: [Alerta] Cliente {cliente.nome} - Risk {score} - {motivo}
   - Link direto ao caso no CRM
   - Customizável por CS (on/off, digest diária vs imediato)

4. **Webhook Externo (opcional)**
   - POST /webhooks/retencao para integrações (Slack, etc.)
   - Payload: { evento, casoChurnId, clienteId, riskScore, detalhes }

---

### US-2810 — Recuperação e Reativação (Clientes Retidos / Churned)

**Como:** CS de Retenção, Comercial
**Quero:** Rastrear clientes que cancelaram ou foram retidos para futuras oportunidades de reativação
**Para:** Reabilitar relacionamento e recuperar revenue perdida

**Critérios:**

1. **Status RETIDO vs CHURNED**
   - **RETIDO:** Cliente concordou em permanecer (CasoChurn status=REATIVADO, novo contrato criado)
   - **CHURNED:** Cliente saiu apesar de esforços (CasoChurn status=CANCELADO, sem reativação possível)

2. **POST /casos-churn/:id/reativar** — Converter CANCELADO → REATIVADO
   - Campos: `novoContratoId` (link novo Contrato)
   - Validações: CasoChurn.status=CANCELADO, Contrato válido
   - Response: 200 + { status=REATIVADO, dataReativacao=hoje, novoContratoId }
   - HistoricoLead: tipo='cliente_reativado'

3. **Tabela ClienteChurnRecuperacao** (para future recovery campaigns)
   - Columns: clienteId, casoChurnId_original, motivo, churnDate, diasDesdeChurn, ultimoMRR, melhorHorario (enviar SMS/email)
   - Usada para campanhas de re-engagement (futuro)

4. **GET /clientes-churned** — Listar clientes perdidos
   - Filtros: motivo, diasDesdeChurn, ultimoMRR
   - Ordenação por ultimoMRR DESC (high-value first)
   - Cache 10min
   - Exportação XLSX disponível

5. **Calendário de reativação** (futuro)
   - 30d post-churn → email "Saudades, como está?"
   - 90d post-churn → proposta customizada
   - 1 ano post-churn → remover de mailing

---

## Enums e Status

### CasoChurn.status
```
ATIVO | REMARCADO | NEGOCIANDO | CANCELADO | REATIVADO | FECHADO
```

### Motivo (10 valores)
```
INSATISFACAO_SERVICO
MAL_USO_PRODUTO
MIGRACAO_CONCORRENCIA
PRECO
FALTA_SUPORTE
INTEGRACAO_PROBLEMAS
VOLUME_BAIXO
PERSONALIZACAO_INSUFICIENTE
PERFORMANCE_LENTA
OUTROS
```

### Sentimento (4 valores)
```
MUITO_NEGATIVO | NEGATIVO | NEUTRO | POSITIVO
```

### Estratégia (8 valores)
```
DESCONTO_PRECO
FEATURE_CUSTOMIZADA
SUPORTE_DEDICADO
TREINAMENTO_INTENSIVO
UPGRADE_PLANO
REVISAR_INTEGRACAO
EXECUTIVO_BUSINESS_REVIEW
DESCONTO_TEMPORAL_PROMOTION
```

### TipoAcao (8 valores)
```
CONTATO_TELEFONICO
REUNIAO_EXECUTIVO
ENVIO_PROPOSTA
DESCONTO_OFERECIDO
FEATURE_CUSTOMIZADA_DESENVOLVIDA
TREINAMENTO_REALIZADO
REVISAO_INTEGRACAO
ESCALACAO_DIRETORIA
```

### PlanoStatus (4 valores)
```
ATIVO | EXECUTANDO | SUCESSO | FALHOU | PAUSADO
```

### RiskCategory (4 valores)
```
CRITICO (80-100)
ALTO (60-79)
MEDIO (40-59)
BAIXO (0-39)
```

---

## Tabelas (Prisma Schema)

### CasoChurn
```
id              String @id @default(cuid())
clienteId       String
clienteBaseId   String (FK Contrato)
motivo          CasoChurnMotivo enum
sentimento      Sentimento enum
atribuidoParaId String (FK User CS)
descricao       String? @db.Text
riskScore       Float @default(0)
status          CasoChurnStatus enum @default(ATIVO)
dataAlertaGerado DateTime @default(now())
dataAgendadoContato DateTime?
novoContratoId  String? (FK novo Contrato se REATIVADO)
criadoPorId     String (FK User)
criadoEm        DateTime @default(now())
atualizadoEm    DateTime @updatedAt

// Relations
cliente         Cliente
clienteBase     Contrato
atribuidoPara   User
criadoPor       User
novoContrato    Contrato?
diagnosis       CasoChurnDiagnosis?
planos          PlanoRetencao[]
acoes           CasoChurnAcao[]
historico       HistoricoLead[]
```

### CasoChurnDiagnosis
```
id                      String @id @default(cuid())
casoChurnId             String @unique (FK)
motivo                  CasoChurnMotivo enum
detalheMotivo           String @db.Text
sentimento              Sentimento enum
avaliacaoSuporte        Int (1-5)
grauInsatisfacao        Int (1-10)
chanceRecuperacao       ChanceRecuperacao enum
riskScoreCalculado      Float
preenchedoEm            DateTime @default(now())

caso                    CasoChurn
```

### PlanoRetencao
```
id                      String @id @default(cuid())
casoChurnId             String (FK)
estrategia              Estrategia enum
descricaoEstrategia     String @db.Text
setoresEnvolvidos       String[] (JSON: ["CS", "TECH", "FINANCEIRO"])
status                  PlanoStatus @default(ATIVO)
dataLancamento          DateTime
dataMetaProposta        DateTime?
criadoPorId             String
criadoEm                DateTime @default(now())
atualizadoEm            DateTime @updatedAt

caso                    CasoChurn
criadoPor               User
acoes                   CasoChurnAcao[]
```

### CasoChurnAcao
```
id                      String @id @default(cuid())
casoChurnId             String (FK)
planoRetencaoId         String? (FK opcional)
tipoAcao                TipoAcao enum
descricao               String @db.Text
resultado               Resultado enum (positivo | negativo | indeterminado)
resultadoDetalhado      String? @db.Text
dataAcao                DateTime @default(now())
proximosPassos          String? @db.Text
registradoPorId         String (FK User)
registradoEm            DateTime @default(now())

caso                    CasoChurn
plano                   PlanoRetencao?
registradoPor           User
```

### RiskMatrixCache
```
id                      String @id @default(cuid())
casoChurnId             String (FK)
d1_diagnosis            Float
d2_revenue              Float
d3_maturity             Float
d4_usage                Float
d5_support              Float
riskScoreTotal          Float
calculadoEm             DateTime @default(now())

caso                    CasoChurn
```

### ClienteChurnRecuperacao (futuro)
```
id                      String @id @default(cuid())
clienteId               String (FK)
casoChurnIdOriginal     String (FK original CasoChurn)
motivo                  CasoChurnMotivo enum
churnDate               DateTime
diasDesdeChurn          Int (calculated)
ultimoMRR               Float
melhorHorarioContato    String? (ex: "tarde")
ultimoContato           DateTime?
statusRecuperacao       String (pendente | contatado | reativado | descartado)
```

---

## Histórico de Lead (HistoricoLead tipos novos)

```
tipo='caso_churn_aberto'
tipo='diagnosis_preenchido'
tipo='plano_retencao_criado'
tipo='acao_retencao_registrada'
tipo='cliente_reativado'
tipo='caso_status_mudou' (com detalhes de transição)
```

---

## APIs (Rotas Fastify)

| Método | Rota | Descrição | Step |
|--------|------|-----------|------|
| GET | /dashboard/retencao | Dashboard KPIs | S3 (Tech Lead) |
| POST | /casos-churn | Criar caso | S4 (Backend) |
| GET | /casos-churn | Listar casos com filtros | S4 |
| GET | /casos-churn/:id | Detalhe caso | S4 |
| PATCH | /casos-churn/:id | Editar caso | S4 |
| PATCH | /casos-churn/:id/status | Transição de status | S4 |
| PATCH | /casos-churn/:id/diagnosis | Preencher diagnosis + calcular risk | S4 |
| GET | /casos-churn/:id/risk-matrix | Histórico de riskScore | S4 |
| POST | /planos-retencao | Criar plano | S4 |
| GET | /planos-retencao | Listar planos | S4 |
| PATCH | /planos-retencao/:id | Editar plano | S4 |
| PATCH | /planos-retencao/:id/status | Transição plano | S4 |
| POST | /casos-churn/:id/acoes | Registrar ação | S4 |
| GET | /casos-churn/:id/acoes | Timeline de ações | S4 |
| PATCH | /casos-churn/:id/acoes/:acaoId | Editar ação | S4 |
| PATCH | /casos-churn/bulk-acoes | Bulk action logging | S4 |
| GET | /relatorios/churn | Exportar XLSX relatório | S4 |
| POST | /clientes-churned/:clienteId/reativar | Marcar cliente como reativado | S4 |
| GET | /clientes-churned | Listar clientes perdidos | S4 |
| GET | /casos-churn/:id/check-permission | Validar acesso ao caso | S4 |

---

## Decisões de Design

1. **Risk Score = Fórmula Automática** — Não armazenado de forma permanente, recalculado via 5 dimensões
   - Rationale: Permite mudanças em pesos sem migração; sempre reflete estado atual

2. **Status Transitions via Modal** — Não inline edits
   - Rationale: Transições críticas (ATIVO → CANCELADO) requerem contexto; modal mostra dados do cliente, revenue, dias aberto

3. **HistoricoLead Hooks Silent** — `.catch(() => {})` para não bloquear atualizações se histórico falhar
   - Rationale: Falha em auditoria não deve impedir retenção de cliente; log a falha, continue

4. **Diagnosis obrigatória para riskScore** — Sem diagnosis preenchida, riskScore = 0
   - Rationale: Garante dados de qualidade; CS **deve** preencher para priorização

5. **Cache 5min em listagens** — Permite UI responsiva sem overload de BD
   - Rationale: Mudanças em casos refletem em max 5min; trade-off aceitável

6. **Cron de recalc 04:00** — Fora de horário comercial
   - Rationale: Não computa durante picos de uso; usa peso lighter

7. **Role-based filtering automática** — Backend sempre filtra; frontend não pode bypassar
   - Rationale: Segurança; CS_RETENCAO não deve ver casos de outro supervisor

---

## Métricas de Sucesso

- **Taxa sucesso retenção** >= 70% (meta)
- **Time-to-first-action** < 2 horas de caso criado
- **Dashboard load time** < 1 seg (P95)
- **Relatório geração** < 10 seg para 5000 registros
- **Zero data leaks** — auditar permissões em 100% das rotas

---

## MVP Phase 1 Scope

✅ **Included:**
- Dashboard KPIs + 4 gráficos
- Caso CRUD + status transitions
- Diagnosis com auto-riskScore
- Risk Matrix 5 dimensões
- Plano CRUD + estratégias
- Ações timeline
- Relatórios (3 tipos: analise, detalhado, motivos)
- Alertas cron (6 eventos)
- Recuperação/reativação
- Permissões 4 roles

❌ **Phase 2 (futuro):**
- Pesquisa NPS integrada
- Configurações avançadas (pesos risk, thresholds alertas)
- Integração Slack/Teams
- Campanhas de re-engagement
- Histórico de reativações (revenue recovered tracking)

---

## Sprint 28 — PRONTO PARA UX ✅

Next: Patrícia Moura (UX Designer) — wireframes para todas as seções acima
