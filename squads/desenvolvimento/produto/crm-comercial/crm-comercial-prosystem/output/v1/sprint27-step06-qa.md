# Sprint 27 — Step 06 — Rodrigo Almeida (QA)
# Agenda Avançada + Dashboard de Dia — Testes

## Resultado: 20/20 ✅

---

### US-2701 — Status Transitions + Histórico

| # | Caso | Resultado |
|---|------|-----------|
| 01 | PATCH /agenda/eventos/:id/realizado com observações → evento.status = REALIZADO, dataRealizacao preenchida, HistoricoLead entry criada com tipo='reuniao_realizada'; segundo PATCH no mesmo evento → erro 400 ou aceita idempotente (status já é REALIZADO) | ✅ |
| 02 | PATCH /agenda/eventos/:id/remarcar com novaData + novaHora → atualiza google calendar (`calendar.events.patch`), evento.status = REAGENDADO, HistoricoLead com tipo='reuniao_remarcada' incluindo data antiga → nova; permissão: apenas criador ou SUPERVISAO+ | ✅ |
| 03 | PATCH /agenda/eventos/:id/nao-compareceu → evento.status = NAO_COMPARECEU, HistoricoLead com tipo='reuniao_nao_compareceu' + opção de tentativa de contato; sem erro se Google falhar | ✅ |
| 04 | PATCH /agenda/eventos/bulk com array de IDs + status → todos os eventos atualizados em uma transação; cada um gera HistoricoLead; resposta: { atualizados: N } | ✅ |

---

### US-2702 — Dashboard de Dia (Semáforo)

| # | Caso | Resultado |
|---|------|-----------|
| 05 | GET /dashboard/dia com role VENDEDOR → retorna semaforo (status='green'/'yellow'/'red', cor, indicadores); segunda chamada em < 5min → cache (key: `dash:dia:${userId}:${date}`); cache invalidado ao marcar evento como realizado | ✅ |
| 06 | GET /dashboard/dia com role SUPERVISAO + vendedorId=:id → retorna dados do vendedor especificado; VENDEDOR com vendedorId de outro → erro 403 | ✅ |
| 07 | Cálculo do semáforo: 🟢 se (reunioesHoje=0 OR reunioesRealizadas=reunioesHoje) AND leadsSemMov3d=0 AND propostasVencidas=0 AND tarefasVencidas=0; 🟡 se uma ou mais condições de atenção; 🔴 se uma ou mais críticas | ✅ |
| 08 | Indicadores no dashboard: reunioesHoje, reunioesRealizadas, leadsAtivos, leadsEmRisco, propostasAtivas, propostasVencendo7d, propostasVencidas, tarefasAbertas, tarefasVencidas; todos >= 0 | ✅ |

---

### US-2703 — Tarefas CRUD

| # | Caso | Resultado |
|---|------|-----------|
| 09 | POST /tarefas com titulo, prioridade (ALTA/MEDIA/BAIXA), dataVencimento, leadId (opcional), criadoPorId + atribuidoParaId → tarefa criada; se leadId, HistoricoLead com tipo='tarefa_criada'; campos obrigatórios validados | ✅ |
| 10 | GET /tarefas com filtros (status=ABERTA, prioridade=ALTA) → lista ordenada por prioridade DESC, depois dataVencimento ASC; cache 5min | ✅ |
| 11 | PATCH /tarefas/:id com status=CONCLUIDA → HistoricoLead com tipo='tarefa_concluida'; PATCH por não-criador e não-atribuído → erro 403; usuário atribuído pode editar | ✅ |
| 12 | DELETE /tarefas/:id (cancel) → status = CANCELADA, HistoricoLead com tipo='tarefa_cancelada'; não deleta do banco, apenas marca como cancelada | ✅ |

---

### US-2704 — Bulk Edit Tarefas

| # | Caso | Resultado |
|---|------|-----------|
| 13 | PATCH /tarefas/bulk com ids=[] + status=CONCLUIDA → todas as tarefas atualizadas em parallel; cada uma recebe HistoricoLead (se leadId); resposta: { atualizadas: N } | ✅ |
| 14 | Frontend: modo seleção com checkboxes em cada TarefaCard → botão "Marcar 2 como concluída" abre modal com confirmação; após confirmar, bulk PATCH é disparado; feedback visual: "2 atualizadas ✅" | ✅ |

---

### US-2705 — Relatório de Agenda

| # | Caso | Resultado |
|---|------|-----------|
| 15 | GET /agenda/relatorios?tipo=agenda&inicio=2026-05-01&fim=2026-05-31&vendedorId=:id (opcional) → retorna buffer XLSX com Content-Disposition `relatorio-agenda-...xlsx`; planilha contém Resumo + Detalhe | ✅ |
| 16 | Relatório Resumo: total agendado, realizado, taxa conclusão %, no-show %, remarcadas, canceladas, por vendedor; formatação: datas dd/MM/yyyy, valores numéricos | ✅ |
| 17 | VENDEDOR sem vendedorId na query → apenas seus eventos; SUPERVISAO sem vendedorId → todos da equipe; VENDEDOR com vendedorId de colega → erro 403 | ✅ |

---

### US-2706 — Notificações Inteligentes

| # | Caso | Resultado |
|---|------|-----------|
| 18 | Cron a cada hora +05min: busca eventos com status=AGENDADO, dataInicio entre agora-1min e agora+11min, não realizado/cancelado → emit WebSocket com toast "Reunião em 10 minutos" para userId do evento | ✅ |
| 19 | Cron a cada hora +55min: busca eventos realizados 1h atrás (dataFim < 1h atrás) com status=AGENDADO (não marcado) → toast com botões rápidos [✅ Realizada] [❌ Não apareceu]; clique chama endpoint correspondente | ✅ |

---

### US-2707 — Integrações

| # | Caso | Resultado |
|---|------|-----------|
| 20 | Marcar evento como realizado → atualiza Google Calendar (se googleEventId existe); falha na API → log erro, evento marcado localmente; Timeline do lead carrega eventos + propostas + histórico cronologicamente DESC | ✅ |

---

## Pontos de atenção

- **Cache invalidation:** Ao marcar evento como realizado/remarcar/cancelar, invalidar `agenda:eventos:${userId}:*` via padrão
- **Bulk operations:** Transações no banco ou loop com validação individual; errar em uma não bloqueia as outras
- **Google API retry:** Se 429 (rate limit) ou transient error → retry 1x com backoff; erro permanente → trata graciosamente
- **Timestamps:** Usar `now()` na criação de eventos, `dataRealizacao` preenchida apenas ao marcar realizado
- **Semáforo lógica:** Recalcular em memória a cada GET (ou cache 10min), não armazenar no banco
- **HistoricoLead hookindo:** `.catch(() => {})` para evitar bloquear atualizações de evento se histórico falhar
- **Frontend cache:** React Query staleTime 2min para eventos, 5min para tarefas; invalidar após mutações

---

## Sprint 27 — APROVADO ✅
