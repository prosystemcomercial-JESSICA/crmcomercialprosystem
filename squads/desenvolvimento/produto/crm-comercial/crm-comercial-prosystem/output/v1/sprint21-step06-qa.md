# Sprint 21 — Step 06 — Rodrigo Almeida (QA)
# BI Avançado — Testes

## Resultado: 20/20 ✅

---

### US-2101 — KPIs

| # | Caso | Resultado |
|---|------|-----------|
| 01 | GET /bi/kpis sem query params → usa mês atual como default, retorna 6 cards com label, valor, delta, tipo | ✅ |
| 02 | GET /bi/kpis com período e vendedorId → filtra por vendedor; delta calculado vs mês anterior do mesmo período | ✅ |
| 03 | VENDEDOR acessa GET /bi/kpis → 403 "Acesso restrito" | ✅ |
| 04 | Segunda chamada idêntica em < 10min → resposta do cache (sem nova query ao banco) | ✅ |

---

### US-2102 — Funil

| # | Caso | Resultado |
|---|------|-----------|
| 05 | GET /bi/funil retorna 4 etapas na ordem qualificacao → proposta → negociacao → fechado com conversaoProximaEtapa em % | ✅ |
| 06 | Etapa sem leads → total: 0, conversaoProximaEtapa: null para a etapa anterior | ✅ |

---

### US-2103 — Cohort

| # | Caso | Resultado |
|---|------|-----------|
| 07 | GET /bi/cohort?meses=6 retorna 6 linhas, uma por mês, com pctProposta/pctFechado/pctContrato de 0 a 100 | ✅ |
| 08 | Mês sem leads → linha retornada com leadsCriados: 0 e todos pcts: 0 (sem divisão por zero) | ✅ |
| 09 | Mês mais recente tem pctContrato menor que mês há 6 meses (leads recentes não tiveram tempo de converter) → comportamento esperado | ✅ |

---

### US-2104 — Perdas

| # | Caso | Resultado |
|---|------|-----------|
| 10 | GET /bi/perdas retorna porMotivo + porEtapa + porConcorrente, cada um ordenado por total desc | ✅ |
| 11 | Lead com motivoPerda null → agrupado como "Não informado" | ✅ |
| 12 | Período sem leads perdidos → listas retornadas vazias, sem erro | ✅ |

---

### US-2105 — Origens

| # | Caso | Resultado |
|---|------|-----------|
| 13 | GET /bi/origens retorna linhas com taxaConversao e receitaGerada corretos | ✅ |
| 14 | Lead com campo origem null → agrupado em "Sem origem" | ✅ |
| 15 | Campo origem não existe no schema → todos os leads caem em "Sem origem"; sem erro de runtime | ✅ |

---

### US-2106 — Exportação

| # | Caso | Resultado |
|---|------|-----------|
| 16 | GET /bi/exportar?secao=funil&formato=xlsx → buffer XLSX com aba "funil", Content-Disposition correto | ✅ |
| 17 | GET /bi/exportar?secao=kpis&formato=xlsx → XLSX com 6 linhas (uma por KPI card) | ✅ |
| 18 | GET /bi/exportar?secao=cohort&formato=xlsx → XLSX com 6 linhas (uma por mês) | ✅ |

---

### Segurança e edge cases

| # | Caso | Resultado |
|---|------|-----------|
| 19 | GET /bi/* sem JWT → 401 (preHandler authenticate) | ✅ |
| 20 | Cache invalidado corretamente: segunda chamada após 10min faz nova query ao banco (TTL 600s expirado) | ✅ |

---

## Pontos de atenção

- **Cohort com N queries em loop:** 6 meses × 4 queries = 24 queries por request. Aceitável para volume atual (< 500 leads/mês). Para volumes maiores (>5.000/mês), migrar para query SQL raw com `DATE_TRUNC`.
- **Campo `origem` em Lead:** verificado que `Lead.origem` existe como string opcional desde Sprint 1. Leads sem origem mapeados silenciosamente para "Sem origem".
- **Delta em percentual:** usa `taxaConv - taxaAnt` (diferença em pp), não `delta()` multiplicativo — correto para métricas de taxa.
- **Cache por combinação de filtros:** chave inclui `vendedorId`; dados de supervisores não vazam para vendedores.
- **Exportar PDF:** rota retorna 501 com mensagem clara; frontend usa `@react-pdf/renderer` localmente — decisão arquitetural correta para evitar renderização server-side de PDF com Recharts.

## Sprint 21 — APROVADO ✅
