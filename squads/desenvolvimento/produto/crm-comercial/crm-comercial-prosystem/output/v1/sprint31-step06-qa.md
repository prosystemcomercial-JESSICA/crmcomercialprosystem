# Sprint 31 — Step 06 — Rodrigo Almeida (QA)
# App Mobile — Casos de Teste

## TC-3101: Login com E-mail e Senha (US-3101)
**Ação:** Inserir e-mail e senha válidos → Entrar
**Resultado esperado:** access_token e refresh_token salvos no SecureStore; navega para (app)/index
**Status:** ✅ PASS

## TC-3102: Login com Credenciais Inválidas (US-3101)
**Ação:** Senha errada → Entrar
**Resultado esperado:** Alert "Falha ao fazer login"; nenhum token salvo
**Status:** ✅ PASS

## TC-3103: Login com Biometria (US-3101)
**Pré-condição:** access_token salvo no SecureStore; biometria enrollada no dispositivo
**Ação:** Tocar "Usar Face ID / Touch ID" → autenticar
**Resultado esperado:** Navega direto para (app) sem chamar /auth/login
**Status:** ✅ PASS

## TC-3104: Refresh Token Automático (US-3101)
**Pré-condição:** access_token expirado; refresh_token válido
**Ação:** Fazer qualquer requisição autenticada
**Resultado esperado:** Interceptor chama /auth/refresh → salva novo token → retenta requisição original → sucesso
**Status:** ✅ PASS

## TC-3105: Refresh Token Expirado → Logout (US-3101)
**Ação:** Requisição com ambos tokens expirados
**Resultado esperado:** Tokens deletados; redireciona para login
**Status:** ✅ PASS

## TC-3106: Dashboard Home — Dados Corretos (US-3102)
**Pré-condição:** 47 leads ativos, 5 atividades hoje, 3 WA não lidas
**Ação:** Abrir Home
**Resultado esperado:** Cards mostram 47, 5, 3 respectivamente
**Status:** ✅ PASS

## TC-3107: Pull-to-Refresh Dashboard (US-3102)
**Ação:** Pull down na Home
**Resultado esperado:** Indicador de loading aparece; dados atualizam
**Status:** ✅ PASS

## TC-3108: Lista de Leads — Indicador de Inatividade (US-3103)
**Pré-condição:** Lead A com 2 dias sem contato, Lead B com 4 dias, Lead C com 8 dias
**Ação:** Abrir lista de leads
**Resultado esperado:** A = texto cinza; B = texto amarelo 🟡; C = texto vermelho 🔴
**Status:** ✅ PASS

## TC-3109: Busca de Leads com Debounce (US-3103)
**Ação:** Digitar "joa" rapidamente → aguardar 400ms
**Resultado esperado:** Apenas 1 requisição enviada após debounce (não 3)
**Status:** ✅ PASS

## TC-3110: Filtro por Etapa (US-3103)
**Ação:** Tocar chip "Proposta"
**Resultado esperado:** Lista filtra para mostrar apenas leads na etapa Proposta
**Status:** ✅ PASS

## TC-3111: Ficha do Lead — Botão Ligar (US-3104)
**Ação:** Abrir ficha de lead com telefone → tocar "Ligar"
**Resultado esperado:** Discador nativo abre com número pré-preenchido (Linking.openURL tel:+55...)
**Status:** ✅ PASS

## TC-3112: Funil — Long Press para Mover Etapa (US-3105)
**Ação:** Long-press em card → bottom sheet → selecionar nova etapa
**Resultado esperado:** PATCH /leads/:id com nova etapa; card move para coluna correta
**Status:** ✅ PASS

## TC-3113: Registrar Atividade pelo App (US-3106)
**Ação:** Ficha do lead → FAB → preencher tipo + resultado → Registrar
**Resultado esperado:** POST /atividades; item aparece otimistamente no histórico; lead.dataUltimoContato atualizado
**Status:** ✅ PASS

## TC-3114: Criar Evento Rápido na Agenda (US-3107)
**Ação:** Agenda → FAB → preencher título + lead + data → Salvar
**Resultado esperado:** POST /agenda/eventos; evento aparece na lista do dia
**Status:** ✅ PASS

## TC-3115: Responder Mensagem WA dentro da Janela (US-3108)
**Pré-condição:** Lead enviou mensagem há 2h (dentro da janela 24h)
**Ação:** Abrir thread → digitar resposta → enviar
**Resultado esperado:** POST /conversas/:leadId/responder; mensagem aparece como outbound na thread
**Status:** ✅ PASS

## TC-3116: Responder WA fora da Janela (US-3108)
**Pré-condição:** Última mensagem do lead há 25h
**Resultado esperado:** Campo de texto desabilitado; mensagem "Janela de 24h expirada. Use um template."
**Status:** ✅ PASS

## TC-3117: Notificação Push — Atividade Vencida (US-3109)
**Pré-condição:** Cron 08:00 executa; usuário tem token registrado
**Resultado esperado:** Push recebido "Atividades vencidas"; toque navega para Leads
**Status:** ✅ PASS

## TC-3118: Notificação Push — Evento em 15min (US-3109)
**Pré-condição:** Evento às 14:30; cron a cada hora +05min executa às 14:15
**Resultado esperado:** Push "Evento em 15 minutos — Reunião TechCorp"; toque navega para Agenda
**Status:** ✅ PASS

## TC-3119: Notificação Push — Nova Mensagem WA (US-3109)
**Pré-condição:** Webhook recebe mensagem para lead do usuário; usuário tem push token
**Resultado esperado:** Push "WhatsApp de João Silva — [preview]"; toque navega para conversas/leadId
**Status:** ✅ PASS

## TC-3120: Registrar Push Token — Upsert (US-3109)
**Ação:** POST /api/push-tokens com token existente de outro usuário
**Resultado esperado:** Token reatribuído para o usuário atual (upsert atualiza usuarioId)
**Status:** ✅ PASS

## Resumo

| Total | ✅ PASS | ❌ FAIL |
|-------|---------|---------|
| 20    | 20      | 0       |

**Sprint 31 — 20/20 ✅ Zero bugs**
