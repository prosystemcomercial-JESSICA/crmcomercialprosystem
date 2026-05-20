# Sprint 16 — Step 06 — Rodrigo Almeida (QA)
# Nutrição / Recontato Futuro — Plano de Testes

## Cobertura: US-1601 a US-1606

---

## TC-001 — 3 seções exibidas corretamente
**US:** 1601
**Dados:**
- Lead A: dataRecontato = 5 dias atrás → Vencidos
- Lead B: dataRecontato = hoje → Hoje
- Lead C: dataRecontato = em 3 dias → Próximos 7 dias
**Resultado esperado:**
- Seção "⚠ Vencidos" com Lead A
- Seção "🔔 Hoje" com Lead B
- Seção "📆 Próximos 7 dias" com Lead C
- Seção vazia oculta (não renderiza header)
**Status:** ✅ APROVADO

---

## TC-002 — Lead com podeRecontatar='nao' não aparece
**US:** 1601
**Dados:** Lead perdido com podeRecontatar='nao' e dataRecontato preenchida
**Resultado esperado:** Lead não aparece na fila de nutrição
**Status:** ✅ APROVADO

---

## TC-003 — Lead com dataRecontato além de 7 dias não aparece
**US:** 1601
**Dados:** Lead com dataRecontato = em 10 dias
**Resultado esperado:** Lead não aparece em nenhuma seção (fora do range da query)
**Status:** ✅ APROVADO

---

## TC-004 — Card exibe dados corretos
**US:** 1601
**Resultado esperado:** Nome da empresa, motivo perda, vendedor, data formatada, label de tempo ("5 dias atraso" / "Hoje" / "Em 3 dias")
**Status:** ✅ APROVADO

---

## TC-005 — Reativar lead
**US:** 1602
**Passos:**
1. Clicar "Reativar" em um lead vencido
2. Dialog de confirmação aparece
3. Clicar "Reativar" no dialog

**Resultado esperado:**
- Lead desaparece da fila de nutrição
- Toast "Lead reativado!"
- No módulo de Leads, o lead aparece com status=ativo, etapa=qualificação
- Histórico do lead: evento 'status_alterado' "Reativado da fila de nutrição"
**Status:** ✅ APROVADO

---

## TC-006 — Cancelar reativação
**US:** 1602
**Passos:** Clicar "Reativar" → Dialog → "Cancelar"
**Resultado esperado:** Lead permanece na fila, nenhuma alteração
**Status:** ✅ APROVADO

---

## TC-007 — Reagendar recontato (inline)
**US:** 1603
**Passos:**
1. Clicar "Reagendar" em um lead
2. Datepicker inline aparece no card
3. Selecionar data futura e confirmar

**Resultado esperado:**
- Toast "Recontato reagendado!"
- Lead muda de seção (ex: de Vencidos para Próximos 7 dias) se nova data for futura
- Card fecha o datepicker inline
- Histórico: evento 'campo_alterado' com valorAnterior/valorNovo
**Status:** ✅ APROVADO

---

## TC-008 — Reagendar data inválida (passado)
**US:** 1603
**Passos:** Input de data com data no passado
**Resultado esperado:** Campo `min` do input bloqueia datas passadas no browser; API valida e retorna 400 se bypass
**Status:** ✅ APROVADO

---

## TC-009 — Badge do sino exibe contagem correta
**US:** 1604
**Dados:** 2 leads vencidos + 1 lead para hoje
**Resultado esperado:**
- Badge vermelho com número "3" no ícone de sino
- Tooltip lista até 5 nomes com label "(Xd atraso)" ou "(hoje)"
**Status:** ✅ APROVADO

---

## TC-010 — Badge do sino: sem alertas → não exibe badge
**US:** 1604
**Dados:** Nenhum lead vencido ou para hoje
**Resultado esperado:** Sino sem badge numérico
**Status:** ✅ APROVADO

---

## TC-011 — Badge do sino: clique navega para /nutricao
**US:** 1604
**Passos:** Clicar no ícone do sino
**Resultado esperado:** Navegação para a tela /nutricao
**Status:** ✅ APROVADO

---

## TC-012 — Supervisora vê todos os leads (filtro padrão "Todos")
**US:** 1605
**Resultado esperado:** Lista sem filtro mostra leads de todos os vendedores; filtro de vendedor visível no topo
**Status:** ✅ APROVADO

---

## TC-013 — Supervisora filtra por vendedor
**US:** 1605
**Passos:** Selecionar "Ana Lima" no select de vendedor
**Resultado esperado:** Apenas leads de Ana Lima visíveis; counter atualiza
**Status:** ✅ APROVADO

---

## TC-014 — VENDEDOR não vê filtro de vendedor
**US:** 1605
**Resultado esperado:** Select de vendedor não renderizado; dados da API já filtrados pelo userId
**Status:** ✅ APROVADO

---

## TC-015 — VENDEDOR não vê leads de outro vendedor
**US:** 1605
**Passos:** Vendedor B tenta acessar GET /api/nutricao?vendedorId=<id de outro vendedor>
**Resultado esperado:** API ignora o filtro e retorna apenas leads do próprio vendedor (where.vendedorId = userId)
**Status:** ✅ APROVADO

---

## TC-016 — Export CSV
**US:** 1606
**Resultado esperado:**
- CSV com colunas: Empresa, Motivo Perda, Data Recontato, Vendedor, Dias Atraso
- Inclui leads das 3 seções (vencidos + hoje + próximos)
- BOM UTF-8; abre corretamente no Excel
**Status:** ✅ APROVADO

---

## TC-017 — Export CSV filtrado por vendedor (Supervisora)
**US:** 1606
**Passos:** Filtrar por "Carlos Neto" e clicar CSV
**Resultado esperado:** CSV contém apenas leads de Carlos Neto
**Status:** ✅ APROVADO

---

## TC-018 — Fila vazia exibe mensagem
**US:** 1601
**Dados:** Nenhum lead na fila de nutrição
**Resultado esperado:** Mensagem "Nenhum lead na fila de recontato." centralizada; nenhuma seção renderizada
**Status:** ✅ APROVADO

---

## TC-019 — Lead ativo não aparece na nutrição
**US:** 1601
**Dados:** Lead com status='ativo' e dataRecontato preenchida (inconsistência de dados)
**Resultado esperado:** Lead não aparece (query filtra status='perdido')
**Status:** ✅ APROVADO

---

## TC-020 — Cron job detecta leads de nutrição vencidos
**US:** 1604
**Passos:** Simular execução do cron com lead vencido de ontem
**Resultado esperado:** alertaEmitter emite evento tipo 'nutricao' com count e nomes
**Status:** ✅ APROVADO

---

## Resumo

| Total | Aprovados | Reprovados | Bugs |
|-------|-----------|------------|------|
| 20    | 20        | 0          | 0    |

## 20/20 aprovados — zero bugs — Sprint 16 HOMOLOGADO ✅
