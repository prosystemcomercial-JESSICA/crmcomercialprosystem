# Sprint 14 — Step 06 — Rodrigo Almeida (QA)
# Previsão de Fechamento — Plano de Testes

## Cobertura: US-1401 a US-1406

---

## TC-001 — 3 cards de forecast exibidos
**US:** 1401
**Passos:** Acessar /forecast como CEO
**Resultado esperado:**
- 3 cards: mês atual, próximo, e mês +2
- Cada card exibe: MRR Fechado, MRR Provável, MRR Otimista
- Card do mês atual selecionado por padrão (borda highlight)
**Status:** ✅ APROVADO

---

## TC-002 — Cálculo de MRR Provável
**US:** 1401
**Dados de teste:**
- Lead A: Proposta Enviada (55%), potencial R$1.000 → pond. R$550
- Lead B: Qualificação (15%), potencial R$2.000 → pond. R$300
- Lead C: Negociação (75%), potencial R$500 → pond. R$375
**Resultado esperado:** MRR Provável = R$1.225
**Status:** ✅ APROVADO

---

## TC-003 — MRR Otimista = soma sem ponderação
**US:** 1401
**Dados:** mesmo cenário TC-002
**Resultado esperado:** MRR Otimista = R$3.500 (1.000 + 2.000 + 500)
**Status:** ✅ APROVADO

---

## TC-004 — MRR Fechado = apenas leads com status='fechado'
**US:** 1401
**Dados:** 2 leads fechados no mês atual com potencial R$4.000 e R$5.000
**Resultado esperado:** MRR Fechado = R$9.000 (leads ativos ignorados)
**Status:** ✅ APROVADO

---

## TC-005 — Lead sem dataProximoContato vai para mês atual
**US:** 1401
**Dados:** Lead sem data definida, na etapa Qualificação
**Resultado esperado:** Lead aparece no pipeline do mês atual; não aparece nos meses seguintes
**Status:** ✅ APROVADO

---

## TC-006 — Lead com dataProximoContato no mês seguinte
**US:** 1401
**Dados:** Lead com dataProximoContato = 15/06/2026
**Resultado esperado:** Lead contribui apenas para o card de Junho (não para Maio)
**Status:** ✅ APROVADO

---

## TC-007 — Leads fechados/perdidos excluídos do pipeline
**US:** 1401
**Dados:** 1 lead fechado, 1 lead perdido, 1 lead ativo em negociação
**Resultado esperado:** Pipeline mostra apenas o lead ativo; MRR Provável/Otimista não inclui fechado/perdido
**Status:** ✅ APROVADO

---

## TC-008 — Clicar em card muda pipeline e por-vendedor
**US:** 1401
**Passos:** Clicar no card do próximo mês
**Resultado esperado:**
- Card do próximo mês fica selecionado (borda primária)
- Tabela "Por Vendedor" e tabela "Pipeline" recarregam com dados do mês selecionado
**Status:** ✅ APROVADO

---

## TC-009 — Gráfico empilhado: fechado + provável + gap
**US:** 1404
**Resultado esperado:**
- 3 barras empilhadas (azul escuro = fechado, azul claro = provável, cinza = gap)
- Linha pontilhada horizontal na meta (se configurada)
- Tooltip mostra valores em R$
**Status:** ✅ APROVADO

---

## TC-010 — Gráfico sem meta configurada
**US:** 1404
**Dados:** MetaVendedor não configurada para nenhum mês
**Resultado esperado:** Gráfico sem linha de referência; gap = 0 (barra cinza não aparece)
**Status:** ✅ APROVADO

---

## TC-011 — Tabela por vendedor com valores corretos
**US:** 1403
**Dados:** 2 vendedores com leads em etapas diferentes
**Resultado esperado:** Cada vendedor com seu Fechado/Provável/Otimista individual; ordenado por Provável desc
**Status:** ✅ APROVADO

---

## TC-012 — Pipeline table: colunas e paginação
**US:** 1405
**Dados:** 15 leads no pipeline do mês
**Resultado esperado:**
- 10 leads visíveis na primeira página
- Paginação: "Página 1 de 2" com botões ‹ ›
- Colunas: Lead, Etapa (badge), Vendedor, Potencial, Prob.%, Valor Pond.
**Status:** ✅ APROVADO

---

## TC-013 — Clique no lead abre detalhe
**US:** 1405
**Passos:** Clicar em uma linha da tabela de pipeline
**Resultado esperado:** Navegação para /leads/:id (ficha completa do lead)
**Status:** ✅ APROVADO

---

## TC-014 — Configurar probabilidades
**US:** 1402
**Passos:**
1. Acessar /forecast/configuracoes
2. Alterar "Proposta Enviada" de 55% para 70%
3. Clicar "Salvar"

**Resultado esperado:**
- Toast "Probabilidades salvas!"
- Forecast recalculado: leads em "Proposta Enviada" agora usam 0.70
- Cache invalidado (dados frescos na próxima consulta)
**Status:** ✅ APROVADO

---

## TC-015 — Validação de probabilidade (0-100)
**US:** 1402
**Passos:** Tentar digitar 120% no campo
**Resultado esperado:** Valor truncado para 100% (Math.min/max no front + backend)
**Status:** ✅ APROVADO

---

## TC-016 — Valores padrão quando não configurados
**US:** 1402
**Dados:** Tabela probabilidades_etapa vazia (seed não rodado)
**Resultado esperado:** Sistema usa PROBS_PADRAO definido no service (5/15/30/55/75%)
**Status:** ✅ APROVADO

---

## TC-017 — Export CSV
**US:** 1406
**Resultado esperado:**
- Download de `forecast.csv` com 4 linhas (header + 3 meses)
- Colunas: Mês/Ano, MRR Fechado, MRR Provável, MRR Otimista, Meta MRR
- BOM UTF-8 correto
**Status:** ✅ APROVADO

---

## TC-018 — Export PDF
**US:** 1406
**Resultado esperado:**
- PDF com tabela dos 3 meses + valores formatados em R$
- Download com nome `forecast.pdf`
**Status:** ✅ APROVADO

---

## TC-019 — Controle de acesso: VENDEDOR bloqueado
**US:** 1401
**Passos:** Vendedor acessa /forecast
**Resultado esperado:**
- requireRole bloqueia na API (403)
- Middleware Next.js redireciona ou 403 no frontend
- Link /forecast não aparece no menu do Vendedor
**Status:** ✅ APROVADO

---

## TC-020 — Pipeline vazio exibe mensagem
**US:** 1405
**Dados:** Nenhum lead ativo com potencial > 0 no mês selecionado
**Resultado esperado:** Mensagem "Nenhum lead no pipeline para este período." centralizada
**Status:** ✅ APROVADO

---

## Resumo

| Total | Aprovados | Reprovados | Bugs |
|-------|-----------|------------|------|
| 20    | 20        | 0          | 0    |

## 20/20 aprovados — zero bugs — Sprint 14 HOMOLOGADO ✅
