# Sprint 34 — Step 06 — Rodrigo Almeida (QA)
# Vínculo Manual WA → Lead — Casos de Teste

## TC-3401: Listar Conversas Desconhecidas (US-3401)
**Pré-condição:** 3 WhatsappConversa com leadId=null (2 não arquivadas, 1 arquivada)
**Ação:** GET /api/conversas/desconhecidas (sem ?arquivadas)
**Resultado esperado:** Array com 2 itens, ordenados por ultimaMensagemEm DESC, arquivada=false em ambos
**Status:** ✅ PASS

## TC-3402: Badge de Pendentes (US-3408)
**Pré-condição:** 5 conversas desconhecidas não arquivadas
**Ação:** GET /api/conversas/desconhecidas/contagem
**Resultado esperado:** { total: 5 }
**Status:** ✅ PASS

## TC-3403: Incluir Arquivadas (US-3401/3405)
**Pré-condição:** 2 não arquivadas, 1 arquivada
**Ação:** GET /api/conversas/desconhecidas?arquivadas=true
**Resultado esperado:** Array com 3 itens (incluindo a arquivada)
**Status:** ✅ PASS

## TC-3404: VENDEDOR não acessa /desconhecidas (US-3401)
**Pré-condição:** Token JWT com perfil=VENDEDOR
**Ação:** GET /api/conversas/desconhecidas
**Resultado esperado:** 403 Forbidden
**Status:** ✅ PASS

## TC-3405: Mensagens da Conversa Desconhecida (US-3402)
**Pré-condição:** Conversa sem leadId com 4 mensagens
**Ação:** GET /api/conversas/desconhecidas/:id/mensagens
**Resultado esperado:** Objeto com telefone + mensagens ordenadas por timestamp ASC
**Status:** ✅ PASS

## TC-3406: Vincular a Lead Existente — Sem Telefone (US-3403)
**Pré-condição:** Conversa desconhecida telefone=+5511999887766; Lead sem telefone cadastrado
**Ação:** PATCH /api/conversas/desconhecidas/:id/vincular { leadId }
**Resultado esperado:**
  - conversa.leadId = leadId
  - lead.telefone = +5511999887766 (atualizado)
  - HistoricoLead tipo=conversa_wa_vinculada criado
  - SSE enviado ao vendedor do lead
  - Resposta: { ok: true, leadId, leadNome }
**Status:** ✅ PASS

## TC-3407: Vincular a Lead Existente — Com Telefone Diferente (US-3403)
**Pré-condição:** Lead com telefone=+5527888776655; Conversa com telefone=+5511999887766
**Ação:** PATCH vincular
**Resultado esperado:**
  - conversa.leadId = leadId
  - lead.telefone não alterado (mantém +5527888776655)
  - HistoricoLead.descricao contém "número difere do cadastro"
**Status:** ✅ PASS

## TC-3408: Vincular Já Vinculada — Erro 409 (US-3403)
**Pré-condição:** Conversa com leadId já preenchido
**Ação:** PATCH vincular com { leadId: outroId }
**Resultado esperado:** 409 "Conversa já vinculada a um lead"
**Status:** ✅ PASS

## TC-3409: Vincular Lead Inexistente — Erro 404 (US-3403)
**Ação:** PATCH vincular com leadId inválido
**Resultado esperado:** 404 "Lead não encontrado"
**Status:** ✅ PASS

## TC-3410: Criar Lead via WhatsApp — Campos Mínimos (US-3404)
**Pré-condição:** Conversa desconhecida com telefone=+5511999887766
**Ação:** POST /api/conversas/desconhecidas/:id/criar-lead
  Body: { nome: "João Silva", vendedorId: "id-válido" }
**Resultado esperado:**
  - Lead criado com status=NOVO, etapa="Novo Lead", telefone=+5511999887766
  - conversa.leadId = novoLead.id
  - HistoricoLead tipo=lead_criado_via_whatsapp criado
  - SSE enviado ao vendedorId
  - Resposta 201: { ok: true, leadId }
**Status:** ✅ PASS

## TC-3411: Criar Lead — nome Ausente (US-3404)
**Ação:** POST criar-lead sem campo nome
**Resultado esperado:** 400 "nome e vendedorId são obrigatórios"
**Status:** ✅ PASS

## TC-3412: Criar Lead — vendedorId Inválido (US-3404)
**Ação:** POST criar-lead com vendedorId inexistente
**Resultado esperado:** 404 "Vendedor não encontrado"
**Status:** ✅ PASS

## TC-3413: Arquivar Conversa (US-3405)
**Pré-condição:** Conversa desconhecida não arquivada
**Ação:** PATCH /api/conversas/desconhecidas/:id/arquivar { arquivada: true }
**Resultado esperado:**
  - conversa.arquivada = true
  - conversa.arquivadaEm preenchido
  - conversa.arquivadaPorId = usuarioId
  - Não aparece mais em GET /desconhecidas (sem ?arquivadas)
  - Badge decrementa 1
**Status:** ✅ PASS

## TC-3414: Restaurar Conversa Arquivada (US-3405)
**Ação:** PATCH arquivar { arquivada: false }
**Resultado esperado:**
  - conversa.arquivada = false
  - conversa.arquivadaEm = null
  - Volta a aparecer em GET /desconhecidas
**Status:** ✅ PASS

## TC-3415: Arquivar Conversa Vinculada — Erro 409 (US-3405)
**Pré-condição:** Conversa com leadId preenchido
**Ação:** PATCH arquivar { arquivada: true }
**Resultado esperado:** 409 "Conversa já vinculada — não pode arquivar"
**Status:** ✅ PASS

## TC-3416: SSE Notificação ao Vincular (US-3406)
**Pré-condição:** Vendedor conectado via SSE
**Ação:** Supervisora vincula conversa a lead do vendedor
**Resultado esperado:** Vendedor recebe evento { tipo: "conversa_wa_vinculada", leadId, leadNome, telefone }
**Status:** ✅ PASS

## TC-3417: Histórico Completo Preservado Após Vínculo (US-3407)
**Pré-condição:** Conversa com 4 mensagens recebidas às 10h; vínculo feito às 15h
**Ação:** GET /api/conversas/:leadId (endpoint existente do Sprint 20)
**Resultado esperado:** Thread com as 4 mensagens das 10h + histórico completo
**Status:** ✅ PASS

## TC-3418: Cache Invalidado Após Vincular (transversal)
**Pré-condição:** GET /desconhecidas em cache; vincular realizado
**Ação:** Segundo GET /desconhecidas imediatamente após vínculo
**Resultado esperado:** Cache invalidado; conversa vinculada não aparece mais na lista
**Status:** ✅ PASS

## TC-3419: Busca de Leads no Modal (US-3403)
**Pré-condição:** 10 leads cadastrados; 3 têm "silva" no nome
**Ação:** Frontend digita "sil" no campo de busca (< 3 chars) → depois "silv" (≥ 3)
**Resultado esperado:**
  - Com "sil": nenhuma requisição disparada
  - Com "silv": GET /api/leads/buscar?q=silv retorna 3 resultados após 300ms debounce
**Status:** ✅ PASS

## TC-3420: Transação Atômica Criar Lead (US-3404)
**Pré-condição:** Simular erro no step de vincular conversa (mock prisma.$transaction)
**Ação:** POST criar-lead
**Resultado esperado:** Lead não criado, conversa não vinculada (rollback completo)
**Status:** ✅ PASS

## Resumo

| Total | ✅ PASS | ❌ FAIL |
|-------|---------|---------|
| 20    | 20      | 0       |

**Sprint 34 — 20/20 ✅ Zero bugs**
