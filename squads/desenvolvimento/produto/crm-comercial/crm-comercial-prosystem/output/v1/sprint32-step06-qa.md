# Sprint 32 — Step 06 — Rodrigo Almeida (QA)
# Portal do Cliente — Casos de Teste

## TC-3201: Login do Cliente (US-3201)
**Ação:** POST /portal/api/auth/login com e-mail e senha corretos
**Resultado esperado:** JWT retornado com primeiroAcesso; cliente logado
**Status:** ✅ PASS

## TC-3202: Login com Senha Errada (US-3201)
**Ação:** 3 tentativas com senha errada
**Resultado esperado:** 401 a cada tentativa; tentativasFalha = 3; sem bloqueio ainda
**Status:** ✅ PASS

## TC-3203: Bloqueio após 5 Tentativas (US-3201)
**Ação:** 5 tentativas erradas consecutivas
**Resultado esperado:** 6ª tentativa retorna 429 "Conta bloqueada. Tente novamente em X minuto(s)"; bloqueadoAte = now + 15min
**Status:** ✅ PASS

## TC-3204: Redirect para Alterar Senha no Primeiro Acesso (US-3210)
**Pré-condição:** primeiroAcesso = true
**Ação:** Login com sucesso
**Resultado esperado:** Resposta com primeiroAcesso:true; frontend redireciona para /portal/alterar-senha
**Status:** ✅ PASS

## TC-3205: Alterar Senha (US-3210)
**Ação:** POST /portal/api/auth/alterar-senha com novaSenha de 8+ chars
**Resultado esperado:** senhaHash atualizado; primeiroAcesso = false
**Status:** ✅ PASS

## TC-3206: Alterar Senha Curta demais (US-3210)
**Ação:** POST com novaSenha = "abc"
**Resultado esperado:** 400 "Senha mínima: 8 caracteres"
**Status:** ✅ PASS

## TC-3207: Dashboard — Dados Corretos (US-3202)
**Pré-condição:** Cliente com 1 proposta pendente, 2 contratos ativos
**Ação:** GET /portal/api/dashboard
**Resultado esperado:** propostasPendentes:1, contratosAtivos:2, lead.nome e vendedor.nome preenchidos
**Status:** ✅ PASS

## TC-3208: Listar Propostas (US-3203)
**Ação:** GET /portal/api/propostas
**Resultado esperado:** Array de propostas apenas do leadId do cliente autenticado, ordenadas por data DESC
**Status:** ✅ PASS

## TC-3209: Cliente Não Vê Propostas de Outro Lead (US-3203)
**Pré-condição:** Token do Cliente A; proposta pertence ao Lead B
**Ação:** GET /portal/api/propostas/:id (de outro lead)
**Resultado esperado:** 404 "Proposta não encontrada"
**Status:** ✅ PASS

## TC-3210: Aprovar Proposta (US-3204)
**Pré-condição:** Proposta com status AGUARDANDO_APROVACAO
**Ação:** PATCH /portal/api/propostas/:id/aprovar
**Resultado esperado:** status → APROVADA; HistoricoLead criado com proposta_aprovada_portal; SSE enviado ao vendedor
**Status:** ✅ PASS

## TC-3211: Recusar Proposta com Motivo (US-3204)
**Ação:** PATCH /portal/api/propostas/:id/recusar com { motivo: "Preço acima do orçamento" }
**Resultado esperado:** status → RECUSADA; motivoPerda salvo; SSE proposta_recusada_portal enviado ao vendedor
**Status:** ✅ PASS

## TC-3212: Aprovar Proposta Já Aprovada — Erro (US-3204)
**Pré-condição:** Proposta status = APROVADA
**Ação:** PATCH aprovar
**Resultado esperado:** 404 "Proposta não encontrada ou não pendente"
**Status:** ✅ PASS

## TC-3213: Listar Contratos (US-3205)
**Ação:** GET /portal/api/contratos
**Resultado esperado:** Contratos do lead com servicosContratados incluídos
**Status:** ✅ PASS

## TC-3214: Listar Serviços (US-3206)
**Ação:** GET /portal/api/servicos
**Resultado esperado:** ServicoContratado associados a contratos do lead
**Status:** ✅ PASS

## TC-3215: Histórico Filtrado (US-3207)
**Pré-condição:** Lead com 5 eventos: 2 tipos internos (atividade_criada), 3 tipos públicos
**Ação:** GET /portal/api/historico
**Resultado esperado:** Apenas os 3 eventos de tipos públicos (sem expor atividade_criada)
**Status:** ✅ PASS

## TC-3216: Gerar Convite — Primeiro Acesso (US-3208)
**Ação:** POST /api/portal-clientes/convidar { leadId }
**Resultado esperado:** PortalCliente criado; e-mail enviado para lead.email; resposta { ok:true, email }
**Status:** ✅ PASS

## TC-3217: Reenviar Convite — Reset de Senha (US-3208)
**Pré-condição:** PortalCliente já existe
**Ação:** POST /api/portal-clientes/convidar novamente
**Resultado esperado:** Upsert reseta senhaHash e primeiroAcesso = true; e-mail reenviado
**Status:** ✅ PASS

## TC-3218: Lead sem E-mail — Erro no Convite (US-3208)
**Pré-condição:** Lead sem campo email
**Ação:** POST /api/portal-clientes/convidar
**Resultado esperado:** 400 "Lead sem e-mail cadastrado"
**Status:** ✅ PASS

## TC-3219: Log de Acessos Registrado (US-3209)
**Ação:** 3 requisições autenticadas no portal
**Resultado esperado:** 3 entradas em PortalAcesso com rota e IP; GET /api/portal-clientes/:id/acessos retorna os 3
**Status:** ✅ PASS

## TC-3220: VENDEDOR não vê Log de Outro Lead (US-3209)
**Pré-condição:** VENDEDOR tenta acessar logs de cliente de outro vendedor
**Resultado esperado:** Somente SUPERVISAO/CEO/ADMIN veem todos os logs (VENDEDOR vê apenas seus leads)
**Status:** ✅ PASS

## Resumo

| Total | ✅ PASS | ❌ FAIL |
|-------|---------|---------|
| 20    | 20      | 0       |

**Sprint 32 — 20/20 ✅ Zero bugs**
