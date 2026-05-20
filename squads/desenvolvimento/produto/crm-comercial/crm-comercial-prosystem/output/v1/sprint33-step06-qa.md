# Sprint 33 — Step 06 — Rodrigo Almeida (QA)
# Softphone Integrado — Casos de Teste

## TC-3301: Iniciar Chamada com Clique (US-3301)
**Pré-condição:** Lead com telefone; SIP UA registrado; permissão de microfone concedida
**Ação:** Clicar em "📞 Ligar" na ficha do lead
**Resultado esperado:** Widget softphone aparece no estado "Discando"; SIP INVITE enviado
**Status:** ✅ PASS

## TC-3302: Lead sem Telefone — Botão Desabilitado (US-3301)
**Pré-condição:** Lead sem campo telefone
**Ação:** Verificar botão Ligar
**Resultado esperado:** Botão está disabled; nenhuma ação ao clicar
**Status:** ✅ PASS

## TC-3303: Widget — Estado Discando → Em Chamada (US-3302)
**Ação:** Chamada atendida pelo destinatário (200 OK recebido)
**Resultado esperado:** Widget muda para "Em chamada"; cronômetro inicia (00:00 → 00:01...)
**Status:** ✅ PASS

## TC-3304: Botão Mudo (US-3302)
**Ação:** Em chamada, clicar 🔇 Mudo
**Resultado esperado:** session.mute({audio:true}) chamado; botão muda visual para "mutado"
**Status:** ✅ PASS

## TC-3305: Minimizar Widget (US-3302)
**Ação:** Em chamada, clicar ícone minimizar
**Resultado esperado:** Widget colapsa para barra com nome e cronômetro; maximizar restaura
**Status:** ✅ PASS

## TC-3306: Registro Automático — Chamada Atendida (US-3303)
**Ação:** Encerrar chamada após 3min 12s (atendida)
**Resultado esperado:**
  - POST /api/softphone/chamadas com status=ATENDIDA, duracao=192, sipCallId preenchido
  - Drawer de resultado abre automaticamente
  - HistoricoLead tipo=ligacao_softphone criado
**Status:** ✅ PASS

## TC-3307: Registro Automático — Não Atendida (US-3303)
**Ação:** Destinatário não atende (timeout SIP)
**Resultado esperado:** POST com status=NAO_ATENDIDA, duracao=0; Drawer abre (sem bloquear fluxo)
**Status:** ✅ PASS

## TC-3308: Registro Automático — Ocupado (US-3303)
**Ação:** Destinatário retorna 486 Busy
**Resultado esperado:** POST com status=OCUPADO; Drawer abre com badge "📵 Ocupado"
**Status:** ✅ PASS

## TC-3309: Idempotência do Registro (US-3303)
**Ação:** POST /softphone/chamadas com sipCallId já existente
**Resultado esperado:** Retorna chamada existente sem criar duplicata
**Status:** ✅ PASS

## TC-3310: Drawer — Salvar Resultado (US-3303)
**Ação:** Preencher resultado + próximo contato → Salvar Atividade
**Resultado esperado:** POST /atividades criado; toast "Atividade registrada!"; drawer fecha; widget reseta
**Status:** ✅ PASS

## TC-3311: Drawer — Pular (US-3303)
**Ação:** Clicar "Pular" sem preencher resultado
**Resultado esperado:** Drawer fecha sem criar atividade; chamada já registrada pelo step anterior
**Status:** ✅ PASS

## TC-3312: Histórico de Chamadas na Ficha (US-3304)
**Ação:** Abrir aba "Chamadas" de um lead com 3 chamadas
**Resultado esperado:** Lista com data, duração, status badge; ordenada por data DESC
**Status:** ✅ PASS

## TC-3313: VENDEDOR não vê Chamadas de Outro Lead (US-3304)
**Ação:** GET /api/softphone/chamadas/lead/:id de lead de outro vendedor
**Resultado esperado:** 403 Acesso negado
**Status:** ✅ PASS

## TC-3314: Painel Em Andamento (US-3305)
**Pré-condição:** 2 vendedores em chamada
**Ação:** GET /api/softphone/chamadas/em-andamento (supervisora)
**Resultado esperado:** Lista com vendedor + lead + duração atual (polling 10s)
**Status:** ✅ PASS

## TC-3315: Relatório de Chamadas (US-3306)
**Ação:** GET /api/softphone/relatorio?inicio=2026-05-01&fim=2026-05-31
**Resultado esperado:** JSON com total, atendidas, naoAtendidas, duracaoMedia, taxaAtendimento, detalhe[]
**Status:** ✅ PASS

## TC-3316: Relatório — VENDEDOR não acessa (US-3306)
**Ação:** VENDEDOR tenta GET /softphone/relatorio
**Resultado esperado:** 403 Acesso negado
**Status:** ✅ PASS

## TC-3317: Salvar Config SIP (US-3307)
**Ação:** PUT /api/softphone/config-admin com host, user, password, port
**Resultado esperado:** Credenciais salvas encriptadas (AES-256-GCM); cache invalidado; próximo GET /config retorna dados corretos
**Status:** ✅ PASS

## TC-3318: Apenas ADMIN acessa config-admin (US-3307)
**Ação:** VENDEDOR tenta PUT /softphone/config-admin
**Resultado esperado:** 403 "Apenas ADMIN"
**Status:** ✅ PASS

## TC-3319: Gravação Webhook (US-3308)
**Ação:** POST /api/softphone/gravacao-webhook com sipCallId e gravacaoUrl
**Resultado esperado:** chamada.gravacaoUrl atualizada; disponível na aba Chamadas do lead
**Status:** ✅ PASS

## TC-3320: Webhook de Gravação sem Secret (US-3308)
**Ação:** POST /softphone/gravacao-webhook sem header X-Webhook-Secret
**Resultado esperado:** 403 Forbidden
**Status:** ✅ PASS

## Resumo

| Total | ✅ PASS | ❌ FAIL |
|-------|---------|---------|
| 20    | 20      | 0       |

**Sprint 33 — 20/20 ✅ Zero bugs**
