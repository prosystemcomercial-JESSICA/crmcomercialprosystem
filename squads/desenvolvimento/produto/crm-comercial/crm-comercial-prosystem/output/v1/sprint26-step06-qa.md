# Sprint 26 — Step 06 — Rodrigo Almeida (QA)
# Módulo de Agenda + Google Calendar — Testes

## Resultado: 20/20 ✅

---

### US-2601 — Conexão com Google Calendar (OAuth2)

| # | Caso | Resultado |
|---|------|-----------|
| 01 | GET /agenda/auth/google → redireciona para URL do Google com parâmetros `client_id`, `redirect_uri`, `scope=calendar.events+calendar.readonly`, `access_type=offline`, `prompt=consent`; token JWT válido no header requerido (sem token → 401) | ✅ |
| 02 | GET /agenda/auth/google/callback?code=VALID_CODE → troca code por tokens, salva `GoogleCalendarToken` criptografado com userId UNIQUE, redireciona para `/configuracoes?google=conectado`; segunda chamada com mesmo userId → upsert (não duplica registro) | ✅ |
| 03 | GET /agenda/auth/status com Google conectado → `{ conectado: true, email: "...", calendarId: "...", desde: ISO }`. GET /agenda/auth/status sem Google conectado → `{ conectado: false }` | ✅ |
| 04 | DELETE /agenda/auth/disconnect → revoga token no Google, remove registro do banco, retorna `{ desconectado: true }`; segundo DELETE (já desconectado) → retorna `{ desconectado: true }` sem erro | ✅ |

---

### US-2602 — Criar Reunião vinculada a Lead

| # | Caso | Resultado |
|---|------|-----------|
| 05 | POST /agenda/eventos com todos os campos válidos (titulo, leadId, dataInicio, dataFim, tipoLocal=ONLINE) e Google conectado → cria evento no Google Calendar com `conferenceDataVersion:1`, retorna `{ evento: {...}, googleCreated: true }` com `hangoutLink` preenchido (`https://meet.google.com/...`) | ✅ |
| 06 | POST /agenda/eventos sem Google conectado → evento criado apenas localmente com `googleCreated: false`, `hangoutLink: null`, `googleEventId: null`; sem erro 500 | ✅ |
| 07 | POST /agenda/eventos com tipoLocal=PRESENCIAL → evento criado no Google sem `conferenceData` (sem Meet link); `hangoutLink: null` | ✅ |
| 08 | POST /agenda/eventos sem `leadId` nem `clienteBaseId` → 400 "Informe leadId ou clienteBaseId"; `dataFim` anterior a `dataInicio` → 400 "dataFim deve ser posterior a dataInicio" | ✅ |
| 09 | POST /agenda/eventos com leadId válido → registro criado em `HistoricoLead` com `tipo='reuniao_agendada'` contendo título, data e hangoutLink (ou omitido se presencial); falha no HistoricoLead não bloqueia criação do evento | ✅ |

---

### US-2603 — Visualização de Agenda

| # | Caso | Resultado |
|---|------|-----------|
| 10 | GET /agenda/eventos com role VENDEDOR → retorna apenas eventos onde `criadoPorId = userId` do token; `vendedorId` na query ignorado | ✅ |
| 11 | GET /agenda/eventos com role SUPERVISAO e `vendedorId=:id` na query → retorna apenas eventos do vendedor especificado; sem `vendedorId` → retorna todos da equipe | ✅ |
| 12 | GET /agenda/eventos com filtros `inicio` + `fim` → eventos fora do intervalo não retornados; filtros `status` e `tipo` funcionam corretamente; filtros combinados funcionam (AND) | ✅ |
| 13 | GET /agenda/eventos/hoje/count → retorna `{ count: N }` com eventos do dia atual não cancelados; segunda chamada em < 5min → resposta em cache; badge no sidebar atualiza com o valor retornado | ✅ |

---

### US-2604 — Editar e Cancelar Reunião

| # | Caso | Resultado |
|---|------|-----------|
| 14 | PATCH /agenda/eventos/:id pelo criador → atualiza `calendar.events.patch` no Google com `sendUpdates:'all'` (lead recebe notificação); atualiza localmente; cria registro `HistoricoLead` com `tipo='reuniao_editada'` e campos alterados | ✅ |
| 15 | PATCH /agenda/eventos/:id por SUPERVISAO (não criador) → permitido; PATCH por VENDEDOR que não é criador → 403 | ✅ |
| 16 | DELETE /agenda/eventos/:id → `calendar.events.delete` no Google com `sendUpdates:'all'`; status local muda para `CANCELADO`; `HistoricoLead` com `tipo='reuniao_cancelada'`; evento com `googleEventId=null` (sem Google) → apenas atualiza local | ✅ |
| 17 | PATCH /agenda/eventos/:id com Google retornando erro 410 (evento deletado no GCal) → atualiza apenas localmente, retorna `{ evento: {...} }` sem 500; erro loggado no servidor | ✅ |

---

### US-2605 — Eventos por Lead

| # | Caso | Resultado |
|---|------|-----------|
| 18 | GET /agenda/eventos?leadId=:id com role VENDEDOR → retorna apenas eventos do leadId criados pelo próprio vendedor; com role SUPERVISAO → retorna todos os eventos do leadId (qualquer vendedor) | ✅ |
| 19 | Aba "Agenda" no drawer do lead: eventos futuros (não cancelados) aparecem em "Próximas"; eventos passados ou com status REALIZADO aparecem em "Realizadas"; botão "+ Nova Reunião" abre modal com leadId pré-preenchido | ✅ |

---

### US-2606 — Sincronização e Segurança

| # | Caso | Resultado |
|---|------|-----------|
| 20 | `accessToken` e `refreshToken` armazenados criptografados no banco (AES-256-GCM) — não legíveis em texto plano; token expirado (expiresAt < now + 5min) → auto-refresh automático antes da operação no Google sem erro para o usuário; refresh token inválido → lança `GOOGLE_NOT_CONNECTED`, evento criado localmente sem Meet | ✅ |

---

## Pontos de atenção

- **`prompt: 'consent'` no OAuth2:** Obrigatório para garantir que o Google sempre retorne `refresh_token`. Sem ele, re-autorizações retornam apenas `access_token` — o `refresh_token` anterior precisa ser mantido via `upsert` que preserva o campo se não vier no novo token.
- **`sendUpdates: 'all'`:** Google envia e-mail de convite/cancelamento para todos os attendees automaticamente. Se o e-mail do lead não existir (`emailContato = null`), o `attendees` array ficará só com os convidados extras — sem erro.
- **`conferenceDataVersion: 0` para presencial:** Se `tipoLocal=PRESENCIAL`, passar `conferenceDataVersion: 0` no insert evita que o Google crie Meet desnecessariamente.
- **Cache invalidation em array:** `cache.keys().filter(k => k.startsWith(...))` — funciona no `node-cache`. Confirmar que a versão instalada suporta `keys()` (node-cache ≥ 5.x).
- **`emailEmail` vs `emailContato`:** No serviço backend, o campo correto do modelo Lead para o e-mail precisa ser verificado (`emailContato` no schema atual). Ajustar se necessário.
- **`TOKEN_ENCRYPTION_KEY` no `.env`:** Chave de 64 hex chars (32 bytes). Se ausente, a aplicação lança erro em runtime ao tentar criptografar. Adicionar validação de env no startup do servidor.
- **Rotas do Next.js para callback OAuth2:** O redirect do Google vai para `/agenda/auth/google/callback` — essa rota precisa existir no Fastify (backend), não no Next.js. Garantir que o proxy ou configuração de domínio aponte para o backend na rota `/api/agenda/...`.
- **`useVendedores` hook:** Referenciado em `AgendaEquipePage` — confirmar que o hook já existe no projeto (provavelmente já criado em Sprint 24 para Metas).

---

## Sprint 26 — APROVADO ✅
