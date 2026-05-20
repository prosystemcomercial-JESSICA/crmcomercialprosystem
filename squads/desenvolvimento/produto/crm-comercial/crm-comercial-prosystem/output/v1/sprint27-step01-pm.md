# Sprint 27 — Step 01 — André Vieira (Product Manager)
# Agenda Avançada + Dashboard de Dia — Escopo e Requisitos

## Contexto

Sprint 26 entregou o core da agenda com Google Calendar. Agora expandimos para:
- **Gestão completa do ciclo de vida** de reuniões (concluída, remarcada, cancelada, não compareceu)
- **Dashboard na entrada do CRM** mostrando o status do dia (semáforo)
- **Checklist de tarefas** integrado com a agenda
- **Relatório completo** de agendas com KPIs de conclusão

**Integrações existentes:** Agenda (Sprint 26), Lead, HistoricoLead, Proposta, User

---

## Decisão de Escopo

| Sprint 27 — Avançado |
|----------------------|
| Status transitions com HistoricoLead automático (realizado, remarcado, cancelado, não compareceu) |
| Dashboard na homepage: semáforo do dia + próximas reuniões + indicadores (leads, propostas, tarefas) |
| Tarefa vinculada a lead/proposta, com status e atribuição |
| Agenda do dia no sidebar: 3 próximas reuniões + x tarefas pendentes |
| Relatório XLSX: agenda com taxa de conclusão, reagendamentos, no-shows, breakdown por vendedor |
| Notificações inteligentes: 10min antes, 1h depois se não marcou como concluída |
| Bulk edit: marcar múltiplas reuniões como realizadas em 1 ação |
| Visão timeline do lead: agenda + propostas + histórico na mesma visualização |

---

## User Stories — Sprint 27

### US-2701 — Status Transitions + Histórico Automático

**Como** vendedor ou supervisor  
**Quero** atualizar o status de uma reunião (realizada, remarcada, cancelada, não compareceu)  
**Para** rastrear o ciclo de vida completo e manter o lead sempre atualizado

**Critérios:**
- [ ] Botões de ação no card de evento: [✅ Realizada] [📅 Remarcar] [❌ Cancelada] [❌ Não compareceu]
- [ ] Modal de transição mostra: data/hora original, novo status, motivo (opcional), observações
- [ ] Ao confirmar:
  - Status local atualiza em `AgendaEvento`
  - Se houver `hangoutLink`, opção de "Copiar resumo da reunião" (link + notas)
  - `HistoricoLead` recebe entrada automática:
    - Realizada: `tipo='reuniao_realizada'` com duração aproximada + observações
    - Remarcada: `tipo='reuniao_remarcada'` com data/hora antiga → nova
    - Cancelada: `tipo='reuniao_cancelada'` com motivo
    - Não compareceu: `tipo='reuniao_nao_compareceu'` com tentativa de contato (sim/não)
- [ ] Modal de reagendamento abre a "Nova Reunião" com o leadId pré-preenchido

---

### US-2702 — Dashboard na Homepage (Semáforo do Dia)

**Como** vendedor  
**Quero** ver um painel na homepage com o status do meu dia  
**Para** priorizar ações e garantir que nada importante fica para trás

**Critérios:**
- [ ] Painel superior com 3 cores:
  - 🟢 **Verde (Tudo ok):** Agenda do dia cumprida 100%, leads avançaram, propostas no prazo
  - 🟡 **Amarelo (Atenção):** ≥1 reunião não realizada/remarcada, ≥1 lead sem movimento em 3 dias, ≥1 proposta em prazo de 7 dias
  - 🔴 **Vermelho (Crítico):** ≥1 reunião não compareceu, ≥1 proposta vencida, ≥1 lead parado > 7 dias, atraso em KPI
- [ ] Cards abaixo do semáforo:
  - **Hoje:** 5 eventos agendados · 2 realizados · 1 não apareceu · 2 faltando
  - **Leads:** 12 ativos · 3 em negociação · 1 em risco
  - **Propostas:** 4 ativas · 1 em decisão · 2 vencendo em <7d
  - **Tarefas:** 8 pendentes · 3 vencidas · 5 hoje
- [ ] Link para agenda/leads/propostas/tarefas em cada card
- [ ] Configurável por role: VENDEDOR vê seu painel, SUPERVISAO vê equipe

---

### US-2703 — Checklist de Tarefas

**Como** vendedor  
**Quero** criar e gerenciar tarefas vinculadas a leads ou propostas  
**Para** não esquecer ações de follow-up fora das reuniões

**Critérios:**
- [ ] Nova tabela: `Tarefa` (id, titulo, descricao, status ABERTA/CONCLUIDA/CANCELADA, prioridade ALTA/MEDIA/BAIXA, dataVencimento, leadId?, propostaId?, criadoPorId, atribuidoParaId, createdAt, updatedAt)
- [ ] Modal/drawer para criar tarefa (acessível de: lead drawer, proposta drawer, sidebar)
- [ ] Campos: título, descrição, prioridade, data vencimento, atribuído para (se supervisor cria)
- [ ] Status: ABERTA · CONCLUIDA · CANCELADA
- [ ] Cores: ALTA=vermelho, MEDIA=amarelo, BAIXA=azul
- [ ] GET /tarefas com filtros: status, prioridade, leadId, propostaId, dataVencimento
- [ ] Tarefas vencidas (dataVencimento < hoje && status ≠ CONCLUIDA) aparecem em vermelho
- [ ] Bulk edit: ✅ marcar várias como concluídas em 1 ação
- [ ] HistoricoLead ao concluir/cancelar tarefa se houver leadId

---

### US-2704 — Agenda do Dia no Sidebar

**Como** vendedor  
**Quero** ver rapidamente minha agenda do dia e tarefas pendentes no sidebar  
**Para** manter foco nas prioridades sem sair da página

**Critérios:**
- [ ] Widget no sidebar (colapsável):
  - **Hoje:** X reuniões restantes (próximas 3)
  - **Tarefas:** X pendentes (próximas 5)
- [ ] Clique em cada item leva para a página específica (agenda/tarefas)
- [ ] Atualização: auto-refresh a cada 2 min
- [ ] Badge com notificação: 🔴 se reunião em <30min ou tarefa vencida hoje
- [ ] Contexto supervisor: mostra 3 vendedores com mais eventos críticos

---

### US-2705 — Relatório de Agenda

**Como** CEO/SUPERVISAO  
**Quero** um relatório XLSX com métricas de agenda  
**Para** avaliar produtividade e adesão ao planejamento

**Critérios:**
- [ ] GET /agenda/relatorios?tipo=agenda&inicio&fim&vendedorId (opcional)
- [ ] Planilha com colunas:
  - Vendedor, Data, Hora, Lead, Tipo, Status, Duração (realizado - agendado), Taxa Conclusão %
- [ ] Resumo geral:
  - Total de reuniões agendadas / realizadas / não compareceu / remarcadas / canceladas
  - Taxa de conclusão por vendedor
  - Taxa de no-show (não compareceu / total)
  - Tempo médio entre agendamento e realização
- [ ] Formatação: datas dd/MM/yyyy, valores coloridos por status
- [ ] Cache 10min

---

### US-2706 — Notificações Inteligentes

**Como** sistema  
**Quero** notificar o vendedor 10min antes e 1h depois de reuniões  
**Para** minimizar ausências e garantir registro rápido

**Critérios:**
- [ ] Cron: 10min antes de cada evento não realizado/cancelado → toast no frontend "Reunião em 10min: [Lead]"
- [ ] Cron: 1h depois de evento que deve ter sido realizado (status=AGENDADO) → toast "Registre a reunião com [Lead]: [Botão rápido realizada/não compareceu]"
- [ ] Notificação browser (opcional): se usuário consentir
- [ ] Novas crons: 08:55, 09:05, 10:05, 11:05, ... (cada hora + 5 min, cada hora + 55 min)
- [ ] Não notifica se evento já foi marcado (status ≠ AGENDADO)

---

### US-2707 — Bulk Edit de Status

**Como** vendedor ou supervisor  
**Quero** marcar múltiplas reuniões como realizadas em uma ação  
**Para** acelerar o registro em dias movimentados

**Critérios:**
- [ ] Modo seleção na página de agenda: checkboxes em cada card de evento
- [ ] Botão "Marcar X como [✅/❌/📅]"
- [ ] Modal confirma: "Marcar 5 reuniões como realizadas?" + campo de observações (opcional, aplicado a todas)
- [ ] PATCH /agenda/eventos/bulk com array de IDs + status + observações
- [ ] Cada evento recebe HistoricoLead entry (sem repetição de observação em cada uma)
- [ ] Feedback: "5 reuniões atualizadas ✅"

---

### US-2708 — Timeline do Lead (Visualização Integrada)

**Como** vendedor  
**Quero** ver agenda + propostas + histórico do lead em uma timeline  
**Para** entender a jornada completa do relacionamento

**Critérios:**
- [ ] Nova aba "Timeline" no drawer do lead (ao lado de Agenda, Proposta, Histórico)
- [ ] Exibe em ordem cronológica (asc/desc):
  - 📅 Reuniões agendadas/realizadas/não compareceu
  - 📝 Propostas criadas/enviadas/perdidas
  - 📋 Histórico de ações (qualquer TipoHistorico)
  - ✅ Tarefas concluídas
  - 💬 Última conversa WhatsApp (se módulo existe)
- [ ] Cores por tipo: azul (evento), verde (proposta), cinza (histórico)
- [ ] Clique em item leva para edição

---

## Sprint 27 — PRONTO PARA UX ✅
