# Sprint 13 — Step 06 — Rodrigo Almeida (QA)
# Ranking Comercial Avançado — Plano de Testes

## Cobertura: US-1301 a US-1306

---

## TC-001 — Ranking ordenado por MRR (padrão)
**US:** 1301
**Passos:**
1. Acessar /ranking como Supervisora
2. Observar tabela inicial

**Resultado esperado:**
- Primeira coluna "#" mostra posições com 🥇/🥈/🥉 para os 3 primeiros
- Linhas ordenadas por MRR Fechado decrescente
- Todas as colunas visíveis: MRR, Fechamentos, Propostas, Conversão, Abordados
**Status:** ✅ APROVADO

---

## TC-002 — Ordenação por coluna ao clicar no header
**US:** 1301
**Passos:**
1. Clicar no header "Fechamentos"
2. Clicar novamente em "Fechamentos"

**Resultado esperado:**
- 1º clique: ordena crescente com seta ↑
- 2º clique: inverte para decrescente com seta ↓
- Posições no # se atualizam conforme nova ordem
**Status:** ✅ APROVADO

---

## TC-003 — Variação vs mês anterior
**US:** 1303
**Passos:**
1. Vendedor A: MRR atual R$5.000, mês anterior R$4.000
2. Vendedor B: MRR atual R$3.000, mês anterior R$3.200
3. Observar coluna MRR no ranking

**Resultado esperado:**
- Vendedor A: "+25,0% ↑" em verde
- Vendedor B: "-6,3% ↓" em vermelho
**Status:** ✅ APROVADO

---

## TC-004 — Taxa de conversão calculada corretamente
**US:** 1301
**Dados:** 6 fechamentos, 11 propostas
**Resultado esperado:** 54,5% (6/11 × 100)
**Status:** ✅ APROVADO

---

## TC-005 — Linha expandida: metas e sparkline
**US:** 1301 + 1302
**Passos:**
1. Clicar em uma linha do ranking
2. Observar a linha expandida

**Resultado esperado:**
- Seção "Metas do mês" com barras de progresso por indicador
- Sparkline de MRR dos últimos 6 meses
- Badges do vendedor com tooltips ao hover
**Status:** ✅ APROVADO

---

## TC-006 — Linha expandida sem meta configurada
**US:** 1302
**Passos:**
1. Nenhuma meta cadastrada para o mês para o vendedor X
2. Expandir linha do vendedor X

**Resultado esperado:**
- Mensagem "Meta não configurada para este mês" (itálico)
- Sparkline ainda renderiza normalmente
**Status:** ✅ APROVADO

---

## TC-007 — Filtro de período: mês anterior
**US:** 1306
**Passos:**
1. Clicar na tab "Mês anterior"

**Resultado esperado:**
- Dados do mês anterior carregados
- Cache anterior não interfere
- Ordenação e expansão funcionam normalmente
**Status:** ✅ APROVADO

---

## TC-008 — Filtro de período: trimestre e ano
**US:** 1306
**Passos:** Clicar em "Trimestre" e "Ano"
**Resultado esperado:** Dados acumulados do período correto em ambos os casos
**Status:** ✅ APROVADO

---

## TC-009 — Badge 🥇 Campeão do Mês
**US:** 1304
**Dados:** Vendedor A tem MRR mais alto do mês
**Resultado esperado:** Badge 🥇 no vendedor A; tooltip "1º lugar em MRR no mês"
**Status:** ✅ APROVADO

---

## TC-010 — Badge 🎯 Meta Batida
**US:** 1304
**Dados:** Meta = 10 fechamentos; vendedor tem 10
**Resultado esperado:** Badge 🎯 com tooltip correto
**Status:** ✅ APROVADO

---

## TC-011 — Badge 📈 Crescimento
**US:** 1304
**Dados:** MRR atual R$5.000 > mês anterior R$4.000
**Resultado esperado:** Badge 📈
**Status:** ✅ APROVADO

---

## TC-012 — Badge 🔥 Em Chamas
**US:** 1304
**Dados:** 3 fechamentos nos últimos 7 dias
**Resultado esperado:** Badge 🔥 exibido
**Status:** ✅ APROVADO

---

## TC-013 — Configurar metas mensais (Supervisora)
**US:** 1302
**Passos:**
1. Acessar /ranking/metas
2. Alterar meta de fechamentos de Ana Lima para 12
3. Clicar "Salvar metas"

**Resultado esperado:**
- Toast "Metas salvas!"
- Ao voltar para /ranking e expandir linha da Ana Lima, barra de Fechamentos reflete meta 12
- Upsert correto: salvar 2x no mesmo mês/ano não duplica
**Status:** ✅ APROVADO

---

## TC-014 — Navegar entre meses nas metas
**US:** 1302
**Passos:**
1. Em /ranking/metas, clicar "< Mês anterior"
2. Alterar meta
3. Clicar "> Mês seguinte"

**Resultado esperado:**
- Metas carregam corretamente por mês/ano
- Mês seguinte carrega dados separados (unique vendedorId+mes+ano)
**Status:** ✅ APROVADO

---

## TC-015 — Visão do Vendedor (/meu-desempenho)
**US:** 1304
**Passos:**
1. Fazer login como Vendedor
2. Acessar /ranking

**Resultado esperado:**
- Redirecionamento automático para /ranking/meu-desempenho
- Posição exibida: "🥈 2º de 3"
- Apenas dados do próprio vendedor visíveis (não vê ranking do time)
**Status:** ✅ APROVADO

---

## TC-016 — Histórico 6 meses no meu-desempenho
**US:** 1304
**Resultado esperado:**
- Card com Sparkline exibindo MRR dos 6 meses anteriores
- Eixo X com rótulos MM/AA
- Cor verde se tendência crescente, vermelho se decrescente
**Status:** ✅ APROVADO

---

## TC-017 — Export CSV
**US:** 1305
**Passos:**
1. Clicar "Exportar" → "CSV"

**Resultado esperado:**
- Download inicia automaticamente
- Arquivo abre no Excel com colunas: Posição, Vendedor, MRR, Fechamentos, Propostas, Taxa Conversão, Ticket Médio, Variação MRR, Abordados
- Encoding UTF-8 com BOM; caracteres especiais corretos
**Status:** ✅ APROVADO

---

## TC-018 — Export PDF
**US:** 1305
**Passos:** Clicar "Exportar" → "PDF"
**Resultado esperado:**
- PDF gerado com título "Ranking Comercial — mes-atual"
- Tabela com todos os vendedores e colunas
- Arquivo nomeado `ranking-mes-atual.pdf`
**Status:** ✅ APROVADO

---

## TC-019 — Controle de acesso: VENDEDOR não acessa /ranking/metas
**US:** 1304
**Passos:** Vendedor tenta acessar /ranking/metas diretamente
**Resultado esperado:** 403 Forbidden — requireRole bloqueia na API; frontend não exibe botão "Configurar metas"
**Status:** ✅ APROVADO

---

## TC-020 — Ranking com vendedor sem nenhum dado no período
**US:** 1301
**Dados:** Vendedor C não teve fechamentos, propostas ou abordados no mês
**Resultado esperado:**
- Vendedor C aparece na tabela (não é omitido)
- MRR = R$0, Fechamentos = 0, Propostas = 0, Conversão = 0%
- Posicionado no último lugar
**Status:** ✅ APROVADO

---

## Resumo

| Total | Aprovados | Reprovados | Bugs |
|-------|-----------|------------|------|
| 20    | 20        | 0          | 0    |

## 20/20 aprovados — zero bugs — Sprint 13 HOMOLOGADO ✅
