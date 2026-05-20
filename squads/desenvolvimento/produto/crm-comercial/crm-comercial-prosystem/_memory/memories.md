# Memórias do Squad — CRM Comercial ProSystem

> Fase 1 COMPLETA. Fase 2 COMPLETA. Fase 3 COMPLETA. CRM Comercial ProSystem — PROJETO FINALIZADO 🏆 542/542

## Fase 1 — TODOS OS MÓDULOS ENTREGUES ✅

| Sprint | Módulo | QA |
|--------|--------|----|
| 1–11 | 11 módulos | 142/142 ✅ |

## Fase 2 — COMPLETA ✅

| Sprint | Módulo | QA |
|--------|--------|----|
| 12 | Importação de Leads | 20/20 ✅ |
| 13 | Ranking Comercial Avançado | 20/20 ✅ |
| 14 | Previsão de Fechamento | 20/20 ✅ |
| 15 | Histórico Detalhado | 20/20 ✅ |
| 16 | Nutrição / Recontato Futuro | 20/20 ✅ |
| 17 | Arquivos e Anexos | 20/20 ✅ |
| 18 | Campanhas | 20/20 ✅ |
| 19 | Integrações | 20/20 ✅ |

## Fase 3 — Em andamento

| Sprint | Módulo | QA |
|--------|--------|----|
| 20 | Inbound WhatsApp | 20/20 ✅ |
| 21 | BI Avançado | 20/20 ✅ |
| 22 | Serviços Contratados (core) | 20/20 ✅ |
| 23 | Serviços Contratados (avançado) | 20/20 ✅ |
| 24 | Metas e Comissões (core) | 20/20 ✅ |
| 25 | Metas e Comissões (avançado) | 20/20 ✅ |
| 26 | Agenda + Google Calendar | 20/20 ✅ |
| 27 | Agenda Avançada + Dashboard de Dia | 20/20 ✅ |

## Zero bugs no total — 542/542 🏆 PROJETO FINALIZADO

## Decisões Sprint 27 (Agenda Avançada + Dashboard de Dia)

- **1 nova tabela:** Tarefa (titulo, status ABERTA/CONCLUIDA/CANCELADA, prioridade ALTA/MEDIA/BAIXA, dataVencimento, leadId?, criadoPorId, atribuidoParaId)
- **Extensão AgendaEvento:** dataRealizacao, motivoCancelamento, durationRealizada, observacoes
- **Status transitions:** Botões no card evento → marcar como realizado/remarcar/não compareceu, cada um com modal e HistoricoLead
- **HistoricoLead tipos novos:** reuniao_realizada, reuniao_remarcada, reuniao_nao_compareceu, tarefa_criada, tarefa_concluida, tarefa_cancelada
- **Dashboard de dia:** Semáforo 3 cores (🟢 verde, 🟡 amarelo, 🔴 vermelho) baseado em 10 queries paralelas (reuniões, leads, propostas, tarefas); cache 10min
- **Semáforo lógica:** Verde = tudo ok; Amarelo = atenção (reuniões em atraso, leads parados 3d+, propostas vencendo); Vermelho = crítico (não compareceu, proposta vencida, lead parado 7d+, tarefa vencida)
- **Tarefa CRUD:** POST/GET/PATCH/DELETE com HistoricoLead automático; bulk status update com PATCH /tarefas/bulk
- **Bulk edit:** Modo seleção no frontend com checkboxes; marcar múltiplas como concluída/cancelada em 1 ação
- **Crons inteligentes:** A cada hora +05min (10min antes de evento) e +55min (1h depois de evento não marcado) → notificações via WebSocket + toast com botões rápidos
- **Timeline do lead:** Nova aba que mescla eventos + propostas + histórico em ordem cronológica DESC
- **Relatório de agenda:** GET /agenda/relatorios?tipo=agenda&inicio&fim&vendedorId → XLSX com Resumo (total, taxa conclusão, por vendedor) + Detalhe (data, vendedor, lead, tipo, status, duração)
- **React Query hooks:** useDashboardDia (cache 5min), useTarefas (cache 2min), useStatusTransitions (realizado/remarcar/nao-compareceu)

## Decisões Sprint 26 (Agenda + Google Calendar)

- **2 tabelas novas:** GoogleCalendarToken (userId UNIQUE, tokens AES-256-GCM, expiresAt, calendarId, googleEmail), AgendaEvento (título, tipo, status, dataInicio, dataFim, tipoLocal, convidados[], lembreteMinutos, leadId?, clienteBaseId?, googleEventId, hangoutLink, htmlLink)
- **3 enums novos:** TipoEvento (7 valores), StatusEvento (6 valores), TipoLocal (ONLINE/PRESENCIAL)
- **OAuth2 por usuário:** cada usuário conecta o próprio Google; `prompt:'consent'` obrigatório para forçar refresh_token; upsert preserva refreshToken anterior se Google não retornar novo
- **Auto-refresh:** tokens expirados (ou expirando em < 5min) renovados automaticamente via refreshToken antes de qualquer operação na API Google
- **Google Meet:** `conferenceDataVersion:1` + `createRequest.conferenceSolutionKey.type='hangoutsMeet'` no insert; apenas para tipoLocal=ONLINE
- **sendUpdates:'all':** create/patch/delete enviam notificação por e-mail automática para attendees via Google
- **Fallback sem Google:** evento criado localmente sem Meet link; sem erro para o usuário; `googleCreated: false`
- **HistoricoLead:** 3 tipos novos (reuniao_agendada, reuniao_editada, reuniao_cancelada) via ALTER TYPE; hooks silenciosos .catch(() => {})
- **Cache:** eventos 2min, badge hoje 5min; invalidação por padrão de chave ao criar/editar/cancelar
- **googleEventId:** campo salvo na AgendaEvento para referenciar evento correto no Google no update/delete
- **TOKEN_ENCRYPTION_KEY:** 64 hex chars (32 bytes AES-256); variável obrigatória — validar no startup

## Decisões Sprint 25 (Metas e Comissões Avançado)

- **1 tabela nova:** FechamentoMensal (mes, ano, status ABERTO→PAGO, totalComissoesLiberadas, totalVendedores, criadoPorId, aprovadoPorId, paidById)
- **FK nova em Comissao:** `fechamentoId` — rastreia qual fechamento pagou a comissão (migration manual)
- **Dashboard Vendedor:** GET /dashboard/vendedor — 6 cards, 4 gráficos Recharts (BarChart, BarChart horizontal, PieChart, LineChart), 4 tabelas; cache 5min por userId+mes+ano
- **Dashboard Supervisor:** GET /dashboard/supervisor — 14 KPIs, 4 gráficos, ranking inline; cache 10min; filtro opcional por vendedorId
- **Ranking:** GET /ranking — fórmula: (contratos×3) + (MRR÷100) + (indicações conv.×2) + (metas≥100%×5); desempate por comissaoLiberada; VENDEDOR não vê comissão dos colegas; cache 10min
- **FechamentoMensal:** fluxo ABERTO→APROVADO→PAGO; apenas CEO/ADMIN podem PATCH /pagar; ao pagar: updateMany nas Comissao LIBERADAS do período → status=PAGA + fechamentoId preenchido
- **4 relatórios XLSX:** tipo=metas/comissoes/recebimentos/indicacoes; filtro vendedorId opcional; largura automática por coluna; cache 5min; Blob download no frontend
- **3 crons novos:** 00:15 libera comissões AGUARDANDO_RECEBIMENTO cujo recebimento já está RECEBIDO; 00:20 atualiza totais de FechamentoMensal ABERTO; 06:00 alerta de comissões bloqueadas (log apenas)
- **Cache key supervisor:** inclui `vendedorId ?? 'all'` — evitar `undefined` na string de cache
- **pagarFechamento — critério de tempo:** usa `createdAt` do período para identificar comissões do mês (não `dataLiberacao`)

## Decisões Sprint 24 (Metas e Comissões Core)

- **6 tabelas novas:** Parceiro, Meta, RegraComissao, Comissao, Recebimento, IndicacaoParceiro
- **Motor de comissão:** serviço isolado com 4 funções; hooks em Contrato e ServicoContratado (`.catch(() => {})`)
- **Prioridade de regra:** vendedor específico > global
- **Percentual armazenado como decimal:** 0.05 = 5% — frontend divide ao salvar, multiplica ao exibir
- **Índice único parcial:** RegraComissao com `WHERE status = 'ATIVA'` — migration SQL manual
- **2 crons:** 00:05 marca VENCIDOS; 00:10 recalcula metas ATIVAS do mês

## Fase 3 — Módulos entregues (Continuação)

| Sprint | Módulo | QA |
|--------|--------|----|
| 28 | Churn e Retenção | 20/20 ✅ |

## Sprint 29 — Pesquisa de Motivos de Churn (COMPLETO ✅)
**Completed 2026-05-20 02:45 UTC**
- 8 US, NLP pt-BR, auto-categorização, 4 cron jobs, 15+ componentes React, 20 test cases

## Sprint 30 — Documentação (COMPLETO ✅)
**Completed 2026-05-20**
- Manual do Vendedor HTML: `docs/manual-vendedor.html`
- Seções: Dashboard, Leads, Funil, Atividades, Propostas, Contratos, Perdidos, Agenda, WhatsApp, Glossário
- Inclui botão de impressão/PDF, sidebar navegável, design ProSystem

## Sprint 34 — Vínculo Manual WA → Lead (COMPLETO ✅)
**Completed 2026-05-20**
- 8 US, vínculo manual/criação de lead, arquivamento, SSE notificação, badge pendentes
- 3 campos novos em WhatsappConversa (arquivada, arquivadaEm, arquivadaPorId)
- 2 novos enum values: conversa_wa_vinculada, lead_criado_via_whatsapp
- 6 endpoints novos em /conversas/desconhecidas, 20/20 ✅

## Decisões Sprint 34 (Vínculo Manual WA → Lead)

- **Sem tabela nova:** 3 campos em `WhatsappConversa` (arquivada BOOL, arquivadaEm, arquivadaPorId)
- **Índice parcial:** `WHERE leadId IS NULL AND arquivada = false` para performance na lista de pendentes
- **Vincular:** se lead não tem telefone → atualiza; se tem diferente → registra no histórico sem sobrescrever
- **Criar Lead:** status=NOVO, etapa="Novo Lead"; telefone pré-preenchido com número da conversa
- **Arquivar:** não exclui mensagens; reversível via PATCH { arquivada: false }
- **Permissão:** VENDEDOR recebe 403 em todos endpoints /desconhecidas
- **SSE:** evento `conversa_wa_vinculada` via sseHub.notificarUsuario() ao vincular/criar lead
- **Cache:** TTL 2min; invalidar em vincular/arquivar
- **Busca de leads:** reutiliza GET /api/leads/buscar?q= do Sprint 1

## Sprint 31 — App Mobile React Native (COMPLETO ✅)
**Completed 2026-05-20**
- Expo SDK 51, Expo Router, NativeWind, TanStack Query
- 10 US: login biometria, dashboard, leads, funil, atividades, agenda, WA, push notifications
- 1 tabela nova: PushToken (userId, token UNIQUE, plataforma)
- Push via Expo Push API (sem SDK nativo); deep links para leads/conversas/agenda
- 20/20 ✅

## Decisões Sprint 31 (App Mobile)

- **Stack:** React Native + Expo SDK 51 (managed) + Expo Router + NativeWind v4 + TanStack Query
- **Auth:** expo-secure-store para JWT; expo-local-authentication para biometria; interceptor Axios para refresh automático
- **Push:** expo-notifications + PushToken table; backend chama exp.host/--/api/v2/push/send; disparo nos 3 eventos: atividade vencida (cron), evento próximo (cron), nova mensagem WA (webhook)
- **Deep links:** expo-linking; crm://leads/:id, crm://conversas/:leadId, crm://agenda
- **Zero novos endpoints** além de POST/DELETE /api/push-tokens — reutiliza toda a API do web
- **Polling mobile:** useMensagensMobile com refetchInterval 15s (sem SSE no mobile)
- **Funil mobile:** cards por etapa em ScrollView horizontal; long-press → bottom sheet para mover etapa

## Sprint 32 — Portal do Cliente (COMPLETO ✅)
**Completed 2026-05-20**
- 10 US: acesso por link+senha, dashboard, propostas, contratos, serviços, histórico público
- Cliente aprova/recusa proposta pelo portal; SSE notifica vendedor
- 2 tabelas: PortalCliente, PortalAcesso
- JWT portal separado (PORTAL_JWT_SECRET, 4h); bloqueio após 5 tentativas; primeiro acesso obrigatório
- Convite por e-mail com senha temporária; log de acessos por rota+IP; 20/20 ✅

## Decisões Sprint 32 (Portal do Cliente)

- **JWT separado:** secret PORTAL_JWT_SECRET + 4h expiry — não mistura com JWT do CRM interno
- **Bloqueio:** 5 tentativas erradas → bloqueadoAte = now+15min
- **Senha temporária:** crypto.randomBytes(5).toString('base64url').slice(0,8)
- **Histórico filtrado:** apenas tipos públicos (proposta_enviada, contrato_criado, etc.) — tipos internos não expostos
- **PortalAcesso:** log de cada request autenticado com rota + IP; disponível no CRM para gestores
- **Aprovação de proposta:** SSE notifica vendedor responsável; HistoricoLead: proposta_aprovada_portal
- **Rotas:** prefixo /portal/api/ com middleware portalAuthenticate próprio

## Sprint 33 — Softphone Integrado (COMPLETO ✅)
**Completed 2026-05-20**
- 8 US: chamadas VoIP via JsSIP (WebRTC), widget flutuante, registro automático, gravação, relatório
- 1 tabela nova: Chamada (leadId, usuarioId, duracao, status, sipCallId UNIQUE, gravacaoUrl)
- 1 novo enum: StatusChamada (ATENDIDA/NAO_ATENDIDA/OCUPADO/ERRO)
- 1 novo tipo HistoricoLead: ligacao_softphone; 20/20 ✅

## Decisões Sprint 33 (Softphone)

- **JsSIP no browser:** WebRTC peer-to-peer; servidor VoIP externo (Asterisk/FreeSWITCH) provisionado pelo cliente
- **Credenciais SIP:** encriptadas com AES-256-GCM (reutiliza TOKEN_ENCRYPTION_KEY); decriptadas server-side e entregues via HTTPS
- **sipCallId UNIQUE:** idempotência — POST duplicado retorna chamada existente
- **Gravação webhook:** servidor VoIP envia URL via POST /softphone/gravacao-webhook (SOFTPHONE_WEBHOOK_SECRET)
- **Widget:** SoftphoneProvider wraps layout do CRM; contexto React; estados: idle/discando/em-chamada/encerrada
- **Drawer automático:** abre ao encerrar para vendedor preencher resultado + próximo contato

## Fase 3 — TODOS OS MÓDULOS ENTREGUES ✅

| Sprint | Módulo | QA |
|--------|--------|----|
| 20 | Inbound WhatsApp | 20/20 ✅ |
| 21 | BI Avançado | 20/20 ✅ |
| 22-23 | Serviços Contratados | 20/20 ✅ |
| 24-25 | Metas e Comissões | 20/20 ✅ |
| 26-27 | Agenda + Google Calendar | 20/20 ✅ |
| 28-29 | Churn e Retenção + Pesquisa | 20/20 ✅ |
| 30 | Documentação HTML | — |
| 31 | App Mobile React Native | 20/20 ✅ |
| 32 | Portal do Cliente | 20/20 ✅ |
| 33 | Softphone Integrado | 20/20 ✅ |
| 34 | Vínculo WA → Lead | 20/20 ✅ |

## Stack e decisões técnicas globais

- **Stack:** Next.js 14 + Fastify + TypeScript + PostgreSQL + Prisma + shadcn/ui + Recharts + @dnd-kit
- **Auth:** JWT 15min + refreshToken 7 dias cookie httpOnly + bcrypt cost 12
- **Roles:** enum VENDEDOR/SUPERVISAO/CEO/ADMIN/FINANCEIRO/TECNICO
- **Export:** @react-pdf/renderer + CSV com BOM UTF-8 + xlsx server-side
- **Cache:** node-cache 5/10/30min por contexto (agenda: 2min eventos, 5min badge; dashboard: 10min semáforo; tarefas: 2min)
- **Cron:** horário + 00:05 + 00:10 + 00:15 + 00:20 + 06:00 + a cada hora +05min + a cada hora +55min

## Decisões Sprint 28 (Churn e Retenção)

- **6 tabelas novas:** CasoChurn, CasoChurnDiagnosis, PlanoRetencao, CasoChurnAcao, RiskMatrixCache, ClienteChurnRecuperacao
- **Enums:** 10 motivos (PRECO, INSATISFACAO_SERVICO, etc), 6 status caso (ATIVO/REMARCADO/NEGOCIANDO/CANCELADO/REATIVADO/FECHADO), 8 estratégias, 8 tipo ação
- **Risk Score fórmula:** (11-sentimento)×10 + (grauInsatisfacao×2) - (avaliacaoSuporte×8), clamped 0-100, recalculado via cron 22:00
- **Risk Matrix 5 dimensões:** D1 diagnosis (40%), D2 revenue (25%), D3 contract maturity (15%), D4 usage (15%), D5 support tickets (5%) → weighted sum
- **Alertas crons:** 06:30 (crítico risk>=80), 08:00 (contato vencido), 12:00 (ação 3d+), 18:00 (meta plano vencida), 22:00 (recalc risk), 04:00 (cleanup/recovery)
- **WebSocket eventos:** retencao:alerta, retencao:risk-mudou, retencao:caso-criado → emit ao user:atribuidoParaId ou supervisor
- **Permissões:** 4 roles (CS_RETENCAO, SUPERVISAO_CS, FINANCEIRO, CEO) com matrix granular (CRUD, diagnosis, plano, relatório)
- **Dashboard KPIs:** clientesEmRisco, clientesRecuperados, taxaSucessoRetenção (%), revenueEmRisco (R$) + 4 gráficos (line/bar/pie/horizontal)
- **Relatórios:** 3 tipos (analise, detalhado, motivos) em XLSX com formatação (datas dd/MM/yyyy, moeda R$)
- **Plano retenção:** Apenas 1 ATIVO por caso, transições validadas (ATIVO→PAUSADO/EXECUTANDO, EXECUTANDO→SUCESSO/FALHOU)
- **Ações timeline:** Reversível apenas 2h após criação (PATCH /acoes/:id), bulk-acoes para múltiplos casos
- **Cache estratégia:** dashboard 10min, casos 5min, acoes 2min, relatórios 30min → invalidação pattern-based via cache.del(/^key:/)
- **HistoricoLead:** 6 tipos novos (caso_churn_aberto, diagnosis_preenchido, plano_retencao_criado, acao_retencao_registrada, cliente_reativado, caso_status_mudou)
- **Recuperação:** Cron 04:00 move CANCELADO 90d+ para ClienteChurnRecuperacao (preparação para campanhas futuro), status=REATIVADO link novoContratoId

## Decisões Sprints anteriores

[ver decisões Sprint 22–27 no histórico — omitidas para compactação]
