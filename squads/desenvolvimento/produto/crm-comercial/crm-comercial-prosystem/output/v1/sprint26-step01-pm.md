# Sprint 26 — Step 01 — André Vieira (Product Manager)
# Módulo de Agenda — Google Calendar Integration — Escopo e Requisitos

## Contexto

Conectar o CRM diretamente ao Google Calendar de cada usuário para:
- Criar eventos/reuniões a partir do CRM vinculados a leads
- Gerar link Google Meet automaticamente
- Visualizar a agenda pessoal e da equipe dentro do CRM
- Registrar eventos no histórico do lead
- Notificar o lead via e-mail (Google envia automaticamente o invite)
- Sincronizar alterações: edição/cancelamento reflete no Google Calendar

**Integrações com módulos existentes:**
- `Lead` — origem primária para vincular reuniões
- `ClienteBase` — clientes existentes também podem ser vinculados
- `User` — autenticação OAuth2 por usuário (cada um conecta o próprio Google)
- `HistoricoLead` — registro automático ao criar/editar/cancelar reunião

---

## Decisão de escopo

| Sprint 26 — Core completo |
|---------------------------|
| OAuth2 Google Calendar por usuário (autorização + refresh token seguro) |
| CRUD de Evento vinculado a lead/cliente |
| Google Meet link automático na criação |
| Visualização de agenda (lista + mini calendário mensal) |
| Sincronização bidirecional básica (create/update/delete → Google) |
| Histórico automático no lead |
| Notificação ao lead via convite Google (e-mail) |
| Listagem de próximos eventos por lead |

---

## User Stories — Sprint 26

### US-2601 — Conexão com Google Calendar (OAuth2)

**Como** qualquer usuário do CRM (VENDEDOR, SUPERVISAO, CEO, ADMIN)  
**Quero** conectar minha conta do Google ao CRM  
**Para** que os eventos criados aqui apareçam no meu Google Calendar

**Critérios:**
- [ ] Rota GET /agenda/auth/google → redireciona para tela de autorização do Google (OAuth2, scopes: calendar.events + calendar.readonly)
- [ ] Rota GET /agenda/auth/google/callback → recebe code, troca por access_token + refresh_token, salva criptografado no banco
- [ ] Tabela: GoogleCalendarToken (userId UNIQUE, accessToken TEXT encriptado, refreshToken TEXT encriptado, expiresAt, calendarId, createdAt, updatedAt)
- [ ] Refresh automático: se accessToken expirado, usa refreshToken para renovar antes de qualquer operação
- [ ] GET /agenda/auth/status → retorna { conectado: true/false, email: string, calendarId: string }
- [ ] DELETE /agenda/auth/disconnect → revoga token no Google + remove do banco
- [ ] Armazenar apenas tokens — NUNCA senha ou dados pessoais além do e-mail do Google

---

### US-2602 — Criar Reunião vinculada a Lead

**Como** VENDEDOR/SUPERVISAO/CEO/ADMIN  
**Quero** criar uma reunião diretamente no CRM vinculando um lead  
**Para** que o evento apareça no Google Calendar com link Meet e o lead receba o convite

**Critérios:**
- [ ] Modal "Nova Reunião" acessível de:
  - Página de Leads (ação na linha)
  - Histórico do Lead (botão)
  - Página de Agenda (botão principal)
- [ ] Campos obrigatórios: título, data, hora início, hora fim, leadId (ou clienteBaseId)
- [ ] Campos opcionais: descrição, local (presencial ou online), convidados extras (e-mails livres), lembrete (0, 5, 10, 15, 30, 60 min antes)
- [ ] Ao salvar:
  - Cria evento no Google Calendar via API (`calendar.events.insert`) com `conferenceDataVersion: 1` para gerar Meet
  - Retorna `hangoutLink` (URL do Meet) e `htmlLink` (URL do evento no GCal)
  - Salva evento local na tabela `AgendaEvento`
  - Registra no `HistoricoLead`: tipo = `reuniao_agendada`, descrição com título + data + link Meet
- [ ] Tipoconteúdo: Reunião / Ligação / Visita / Apresentação / Follow-up / Demo / Outro
- [ ] Status: Agendado / Confirmado / Realizado / Cancelado / Reagendado / Não compareceu

---

### US-2603 — Visualização de Agenda

**Como** qualquer usuário  
**Quero** visualizar meus eventos dentro do CRM  
**Para** não precisar sair para o Google Calendar para ver o que tenho no dia

**Critérios:**
- [ ] Página `/agenda` com 2 visualizações:
  - **Lista:** próximos eventos ordenados por data (hoje + 30 dias); filtros: tipo, lead, status
  - **Calendário mensal:** mini grid com dots coloridos por evento; click no dia abre lista do dia
- [ ] Card de evento: título, lead vinculado, hora, tipo, status, botão para abrir link Meet, botão para editar
- [ ] Endpoint: GET /agenda/eventos → retorna eventos do userId logado (filtros: inicio, fim, leadId, status)
- [ ] Supervisor/CEO/ADMIN: filtro adicional por vendedor (GET /agenda/eventos?vendedorId=:id)
- [ ] VENDEDOR: vê apenas seus próprios eventos
- [ ] Contador "Hoje" no sidebar: badge com número de eventos do dia

---

### US-2604 — Editar e Cancelar Reunião

**Como** criador do evento (ou SUPERVISAO+)  
**Quero** editar ou cancelar uma reunião  
**Para** manter o lead e o Google Calendar sempre sincronizados

**Critérios:**
- [ ] PATCH /agenda/eventos/:id → atualiza evento no Google Calendar (`calendar.events.patch`) + atualiza local
- [ ] DELETE /agenda/eventos/:id → cancela evento no Google Calendar (`calendar.events.delete`) + status local = Cancelado
- [ ] Ao cancelar: HistoricoLead recebe evento `reuniao_cancelada`
- [ ] Ao editar: HistoricoLead recebe evento `reuniao_editada` com campos alterados
- [ ] Proteção: apenas o criador ou SUPERVISAO+ pode editar/cancelar
- [ ] Se Google Calendar retornar erro (token expirado, evento deletado manualmente no GCal) → trata graciosamente: atualiza só local e informa usuário

---

### US-2605 — Eventos por Lead (aba no histórico)

**Como** VENDEDOR  
**Quero** ver todos os eventos agendados com um lead específico  
**Para** ter contexto completo do relacionamento antes de uma reunião

**Critérios:**
- [ ] Nova aba "Agenda" no drawer/histórico do Lead (integrada ao padrão das outras abas)
- [ ] Lista: eventos passados + futuros vinculados ao leadId
- [ ] Card por evento: data, hora, título, tipo, status, link Meet (se online), botão "Criar nova reunião"
- [ ] Endpoint: GET /agenda/eventos?leadId=:id → lista todos os eventos do lead (qualquer vendedor — visível para SUPERVISAO+; VENDEDOR vê apenas os seus)

---

### US-2606 — Sincronização e Notificações

**Como** sistema  
**Quero** manter os eventos do CRM sincronizados com o Google Calendar  
**Para** que mudanças feitas diretamente no Google não gerem inconsistências

**Critérios:**
- [ ] Ao criar evento com convidados (e-mail do lead): Google envia convite automaticamente
- [ ] Campo `googleEventId` salvo na AgendaEvento → permite update/delete no Google pelo ID correto
- [ ] Se usuário não tem Google conectado → evento criado apenas localmente (sem Meet link); aviso visual
- [ ] Lembrete: campo `lembreteMinutos` salvo; Google adiciona ao evento via `reminders.overrides`
- [ ] Cron opcional (Sprint 27): webhook do Google para capturar alterações externas

---

## Sprint 26 — PRONTO PARA UX ✅
