# Sprint 30 — Step 01 — André Vieira (Product Manager)
# Campanhas de Retenção — Especificação de Requisitos

## Visão Geral

**Objetivo:** Permitir supervisores e CEO criar e executar campanhas segmentadas de retenção para clientes em risco, identificados via Pesquisa de Churn (Sprint 29) e Risk Scoring (Sprint 28), com automação de ações e tracking de engajamento.

**Contexto:**
- Sprint 28 identificou clientes em risco com Risk Score (0-100)
- Sprint 29 coletou motivos reais via NLP sentimento + auto-categorização
- Sprint 30 executa intervenções com base nesses dados

**Público-alvo:** Supervisora, CEO, Vendedores (visualização)  
**Complexidade:** Alta (automação, tracking, integrações externas)

---

## User Stories

### US01 — Criar Campanha

**Como:** Supervisora  
**Quero:** Criar uma nova campanha de retenção com informações básicas  
**Para que:** Possa segmentar clientes e disparar ações automáticas

**Critérios de Aceitação:**
- [x] Formulário com campos: nome, descrição, data início, data fim, status (RASCUNHO|ATIVA|PAUSADA|FINALIZADA)
- [x] Status inicial: RASCUNHO
- [x] Validar: nome obrigatório, datas consistentes (fim > início)
- [x] Salvar em DB com created_by, created_at
- [x] Retornar campanha com ID para próximos passos
- [x] Supervisor pode editar campanha em RASCUNHO
- [x] Apenas CEO pode editar ATIVA/PAUSADA/FINALIZADA

**Fluxo:**
1. POST /campanhas com {nome, descricao, data_inicio, data_fim}
2. Validar dados
3. Criar Campanha.status='RASCUNHO'
4. Retornar 201 com campanha + URL para próximo passo (segmentação)

---

### US02 — Segmentação Dinâmica

**Como:** Supervisora  
**Quero:** Selecionar público alvo por filtros inteligentes  
**Para que:** Campanha atinja apenas clientes com necessidade real de retenção

**Critérios de Aceitação:**
- [x] Filtros disponíveis:
  - Risk Score: range (0-50, 50-75, 75-100)
  - Motivo Churn: checkboxes (PRECO, SUPORTE, PERFORMANCE_LENTA, etc - 10 opcões)
  - Data última interação: período (últimos 7d, 30d, 90d, 6m)
  - Vendedor: dropdown multi-select
  - Sentimento: (MUITO_NEGATIVO, NEGATIVO, NEUTRO, POSITIVO, MUITO_POSITIVO)
- [x] Preview: "125 clientes candidatos" antes de aplicar
- [x] Listar clientes com colunas: nome, risk_score, motivo, sentimento, email
- [x] Salvar segmento com nome para reutilização
- [x] Performance: carregar lista em <500ms para 1000 clientes

**Fluxo:**
1. GET /campanhas/:id/segmentacao (lista todos clientes candidatos sem filtro)
2. POST /campanhas/:id/segmentacao/filtrar com {risco_score, motivos, periodo, vendedores}
3. Retornar lista filtrada + count total
4. POST /campanhas/:id/segmentacao/salvar com {nome_segmento}
5. GET /segmentos para listar reutilizáveis

**Dados Esperados:**
- Query: clientes com CasoChurn.status != 'CANCELADO' e SurveyResposta não nula
- Join: Cliente → CasoChurn → DiagnosisChurn.risk_score + SurveyResposta.motivo_real + sentimento_q1

---

### US03 — Ações Automáticas por Trigger

**Como:** Supervisora  
**Quero:** Configurar ações que disparam automaticamente baseado em eventos  
**Para que:** Campanha execute sem intervenção manual

**Critérios de Aceitação:**
- [x] Tipo de trigger:
  - T1: Imediato (ao ativar campanha)
  - T2: Por horário (cron diário/semanal)
  - T3: Por webhook (integração Zapier/n8n)
- [x] Tipos de ação:
  - A1: Enviar email template
  - A2: Enviar SMS (mock para MVP)
  - A3: Criar task para vendedor
  - A4: Aplicar crédito/desconto cliente
  - A5: Webhook para integrações
- [x] Configurar: trigger + ação + destinatários (segmento ou manual)
- [x] Sequência: múltiplas ações em ordem (ação1 → espera 3h → ação2)
- [x] Limitar: máximo 5 ações por campanha
- [x] Log: rastrear execução de cada ação (sent_at, status, response)

**Fluxo:**
1. POST /campanhas/:id/acoes com {tipo_trigger, tipo_acao, configuracao, ordem}
2. Salvar em DB: CampanhaAcao
3. Se trigger=IMEDIATO e campanha.status=ATIVA: executar imediatamente
4. Se trigger=HORARIO: registrar cron job
5. GET /campanhas/:id/acoes/historico → log de execuções

**Exemplo:**
```json
{
  "trigger": "IMEDIATO",
  "tipo_acao": "ENVIAR_EMAIL",
  "config": {
    "template_id": "retenção_desconto",
    "variaveis": {nome_cliente, motivo_churn, oferta}
  }
}
```

---

### US04 — Email Templates para Retenção

**Como:** Supervisora/CEO  
**Quero:** Criar templates de email reutilizáveis com variáveis dinâmicas  
**Para que:** Emails personalizados sem duplicação de esforço

**Critérios de Aceitação:**
- [x] CRUD templates:
  - Nome, assunto, corpo (HTML editor + plaintext)
  - Variáveis: {cliente_nome}, {motivo_churn}, {oferta}, {desconto_percentual}, {link_campanha}
  - Tags de segmentação: para qual motivo cada template é indicado
- [x] Preview com dados reais (carregar cliente de exemplo do segmento)
- [x] Validar: assunto obrigatório, corpo > 10 chars
- [x] Versionamento: histórico de edições
- [x] Tracking automático: adicionar pixel + URL tracking para clicks
- [x] Performance: renderizar preview em <200ms

**Fluxo:**
1. POST /templates com {nome, assunto, corpo, variaveis_tag}
2. GET /templates/{id}/preview com cliente_id para visualizar
3. GET /templates para listar todos
4. PATCH /templates/{id} para editar (versionamento automático)
5. Ao enviar via campanha: substituir variáveis + adicionar tracking pixel

**Template Exemplo:**
```html
Oi {cliente_nome},

Notamos que você cancelou conosco. Infelizmente temos uma limitação em {motivo_churn}.

Gostaríamos de oferecer: {oferta} com {desconto_percentual}% de desconto.

<a href="{link_rastreamento}">Voltar para nós</a>
```

---

### US05 — Dashboard de Campanha

**Como:** Supervisora/CEO  
**Quero:** Visualizar progresso e engajamento de campanha em tempo real  
**Para que:** Saiba se campanha está funcionando e faça ajustes se necessário

**Critérios de Aceitação:**
- [x] KPIs principais (4 cards):
  - Enviados: total de mensagens disparadas
  - Abertos: clientes que abriram email (via pixel)
  - Clicados: clientes que clicaram em CTA
  - Convertidos: clientes que retornaram para negociação
- [x] Taxa de Conversão: clicados/enviados %
- [x] Progresso por dia: linha temporal com eventos
- [x] Motivos dos não-convertidos: top 5 palavras-chave
- [x] Comparativo com retenção esperada: baseline vs real
- [x] Drill-down: clicar em KPI para listar clientes
- [x] Filtros: período, por ação executada
- [x] Atualização: real-time ou cache 5min

**Componentes:**
- KPI Cards (4): Enviados, Taxa Abertura, Taxa Clique, Conversão
- LineChart: Evolução temporal
- BarChart: Top 5 motivos dos não-convertidos
- Table: Listar clientes com status individual

**Fluxo:**
1. GET /campanhas/:id/dashboard retorna KPIs + charts data
2. Cálculos:
   - Enviados = count(CampanhaDisparo.status='ENVIADO')
   - Abertos = count(CampanhaDisparo.email_aberto=true)
   - Clicados = count(CampanhaDisparo.link_clicado=true)
   - Convertidos = count(relacionado CasoChurn.status != 'CANCELADO')
3. Cache 5min com invalidação ao novo disparo

---

### US06 — Relatório de Conversão

**Como:** CEO  
**Quero:** Gerar relatório detalhado de ROI de campanha  
**Para que:** Tome decisões sobre futuras campanhas e investimento em retenção

**Critérios de Aceitação:**
- [x] Formato: XLSX com múltiplas abas
  - Sheet1: Resumo executivo (KPIs, ROI estimado, recomendações)
  - Sheet2: Clientes convertidos (nome, motivo original, oferta aceita, data conversão)
  - Sheet3: Clientes perdidos (nome, motivo, por que não converteu)
  - Sheet4: Análise por motivo (tabela cruzada: motivo vs taxa conversão)
- [x] Análise: qual motivo teve maior ROI
- [x] Recomendações: próximas campanhas baseado em resultado
- [x] Período: selecionável (últimos 30d, 90d, 6m, custom)
- [x] Assinatura: criado_em, criado_por, logo da empresa

**Fluxo:**
1. GET /campanhas/:id/relatorio?tipo=xlsx&periodo=30dias
2. Gerar buffer XLSX com sheets
3. Retornar Content-Disposition: attachment
4. Filename: campanha_{id}_{data}.xlsx

**Dados esperados:**
- Conversão = cliente retornou com Caso novo OU pagou fatura pendente
- ROI estimado = (conversões × ticket médio cliente) - (custo emails)

---

### US07 — Integrações de Disparo (Email + SMS + Webhook)

**Como:** Supervisora  
**Quero:** Disparar emails/SMS via serviços externos e receber confirmação de entrega  
**Para que:** Garantia de entrega + tracking de bounce/erro

**Critérios de Aceitação:**

**Email (Sendgrid/Mailgun):**
- [x] Configurar chave API em variáveis de ambiente
- [x] Template renderizado + variáveis substituídas
- [x] Disparar para email cliente
- [x] Webhook de eventos (sent, opened, clicked, bounced, complained)
- [x] Atualizar CampanhaDisparo com events
- [x] Retry automático em case de falha (max 3x)
- [x] Logging: request + response

**SMS (Twilio mock por MVP):**
- [x] Mock: simular disparo (status=ENVIADO_MOCK)
- [x] Log para integração futura
- [x] Validar: telefone obrigatório para SMS
- [x] Template: máximo 160 chars

**Webhook (Zapier/n8n):**
- [x] URL customizável por campanha
- [x] Payload: {campanha_id, cliente_id, evento, timestamp}
- [x] Retry: max 3x com exponential backoff
- [x] Log: envio + response

**Fluxo:**
1. CampanhaAcao.tipo_acao='ENVIAR_EMAIL' trigga
2. Render template + variáveis
3. POST /email-provider/send (Sendgrid API)
4. Salvar CampanhaDisparo.status='ENVIADO', message_id
5. Webhook provider chama /campaigns/:id/eventos/{tipo_evento}
6. Atualizar CampanhaDisparo com opened_at, clicked_at, etc

---

### US08 — Permissões e Auditoria

**Como:** CEO  
**Quero:** Controlar quem pode criar/editar/executar campanhas e manter auditoria  
**Para que:** Garanta conformidade e rastreie responsabilidade

**Critérios de Aceitação:**

**Permissões:**
- [x] SUPERVISOR (Supervisora):
  - Criar campanha (status=RASCUNHO)
  - Editar própria campanha (RASCUNHO)
  - Visualizar segmentação + preview
  - Executar (mudar RASCUNHO → ATIVA)
  - Visualizar própria campanha dashboard
- [x] CEO:
  - TUDO acima +
  - Visualizar todas as campanhas
  - Editar/pausar campanha ativa de outro supervisor
  - Finalizar campanha (marcar FINALIZADA)
  - Acessar relatórios + ROI
- [x] VENDEDOR:
  - Visualizar apenas suas campanhas (by vendedor filter)
  - Visualizar tarefas criadas por campanha
  - Não pode criar/editar
- [x] ADMIN:
  - Acesso total + deletar campanhas

**Auditoria:**
- [x] Tabela AuditoriaCompanha: log todas mudanças
  - campos: campanha_id, usuario_id, acao (CREATE, UPDATE, ATIVA, PAUSADA, etc), dados_antes, dados_depois, timestamp
- [x] GET /campanhas/:id/auditoria para listar histórico
- [x] Imutável: uma vez criada, não pode ser deletada (apenas arquivada)
- [x] Sensível: logs de quem executou, quando

**Fluxo:**
1. Middleware checkPermission('CREATE_CAMPANHA') em POST /campanhas
2. Toda mutação cria AuditoriaCompanha entry
3. GET /campanhas com filtro: if role=SUPERVISOR, mostrar apenas próprias
4. GET /campanhas/:id/auditoria retorna timeline de mudanças

---

## Dados e Modelos (Tech Lead define schema, aqui é referência)

### Entidades Principais

```
Campanha
├─ id, nome, descricao
├─ data_inicio, data_fim
├─ status (RASCUNHO|ATIVA|PAUSADA|FINALIZADA|ARQUIVADA)
├─ created_by (Usuario), created_at
├─ updated_by, updated_at
├─ segmento_id (FK Segmento, opcional - reutilizar)
└─ metadados: {objetivo, orçamento_estimado, etc}

Segmento
├─ id, nome, descricao
├─ filtros JSON (risco_score, motivos, periodo, vendedores)
├─ cliente_count (denormalized)
├─ created_by, created_at
└─ reutilizavel: bool

CampanhaAcao
├─ id, campanha_id (FK Campanha)
├─ tipo_trigger (IMEDIATO|HORARIO|WEBHOOK)
├─ tipo_acao (ENVIAR_EMAIL|ENVIAR_SMS|CRIAR_TASK|APLICAR_CREDITO|WEBHOOK)
├─ configuracao JSON (template_id, cron, webhook_url, etc)
├─ ordem: int (sequência de execução)
├─ status (CRIADA|AGENDADA|EXECUTANDO|COMPLETA|ERRO)
└─ ultima_execucao: datetime

CampanhaDisparo
├─ id, campanha_id, cliente_id, acao_id
├─ tipo (EMAIL|SMS|TASK|WEBHOOK)
├─ status (ENVIADO|ERRO|BOUNCE|COMPLAINED)
├─ message_id (provedor)
├─ sent_at, delivered_at
├─ email_aberto: bool, opened_at
├─ link_clicado: bool, clicked_at
└─ metadados JSON (resposta provedor, etc)

Template
├─ id, nome, assunto, corpo (HTML)
├─ variaveis_tag (array)
├─ versao: int (auto-increment)
├─ created_by, created_at
└─ tags_indicadas (motivos para qual usar)

AuditoriaCompanha
├─ id, campanha_id, usuario_id
├─ acao (CREATE|UPDATE|ATIVA|PAUSADA|FINALIZADA|DELETE_ACAO)
├─ dados_antes JSON, dados_depois JSON
├─ timestamp
└─ ip_address (auditoria avançada)
```

---

## Critérios de Sucesso

| Critério | Métrica | Target |
|----------|---------|--------|
| Funcionalidade | User Stories | 8/8 ✅ |
| Usabilidade | Telas bem-definidas | 5+ wireframes (UX) |
| Performance | API latência | <300ms p95 |
| Cobertura | Test cases | 20+ (QA) |
| Integração | Email delivery | 99% success |
| Auditoria | Logs completos | 100% de mutações |

---

## Dependências Técnicas

- Sprint 28: CasoChurn, DiagnosisChurn, RiskMatrix (dados existentes)
- Sprint 29: SurveyResposta com motivo_real + sentimento (dados para segmentação)
- Email Provider: Sendgrid ou Mailgun (API key needed)
- Variavelização: suportar {var} em templates

---

## Roadmap Futuro (fora do escopo Sprint 30)

- [ ] SMS real via Twilio
- [ ] AB Testing (variant A vs B)
- [ ] ML: recomendação automática de template por motivo
- [ ] WhatsApp Business API
- [ ] Integração com CRM externo (Salesforce, Hubspot)
- [ ] Análise de sentimento em resposta de clientes

---

## Sprint 30 Step 01 — PM PRONTO ✅

**Resumo:** 8 User Stories definidas, escopo claro, dependências mapeadas.

**Próximo:** Patrícia Moura (UX) — Desenhar 5+ wireframes de interfaces (Criar Campanha, Segmentação, Dashboard, Templates, Relatório)
