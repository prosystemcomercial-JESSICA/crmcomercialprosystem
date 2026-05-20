# Sprint 15 — Step 06 — Rodrigo Almeida (QA)
# Histórico Detalhado — Plano de Testes

## Cobertura: US-1501 a US-1506

---

## TC-001 — Timeline exibida na aba Histórico
**US:** 1501
**Passos:**
1. Abrir ficha de um lead com eventos registrados
2. Clicar na aba "Histórico"
**Resultado esperado:**
- Aba "Histórico" disponível no drawer/página do lead
- Timeline vertical com eventos em ordem cronológica reversa
- Linha vertical conectora entre eventos
**Status:** ✅ APROVADO

---

## TC-002 — Evento etapa_alterada exibe De → Para
**US:** 1505
**Dados:** Lead movido de Qualificação → Proposta Enviada
**Resultado esperado:**
- Item com emoji ➡ e texto "etapa alterada"
- Badges: "Qualificação → Proposta Enviada"
**Status:** ✅ APROVADO

---

## TC-003 — Evento status_alterado exibe De → Para
**US:** 1505
**Dados:** Lead fechado (status ativo → fechado)
**Resultado esperado:**
- Item com emoji 🏁
- "ativo → fechado" em badges
**Status:** ✅ APROVADO

---

## TC-004 — Evento campo_alterado exibe valor riscado → novo
**US:** 1505
**Dados:** Campo "segmento" alterado de "Farmácia" para "Padaria"
**Resultado esperado:**
- Texto: "~~Farmácia~~ → Padaria"
- Tipo: "campo alterado"
**Status:** ✅ APROVADO

---

## TC-005 — Data relativa com tooltip de data absoluta
**US:** 1501
**Passos:** Hover sobre "há 2 dias" em um item
**Resultado esperado:** Tooltip mostra "14/05/2026 às 09:11"
**Status:** ✅ APROVADO

---

## TC-006 — Usuário responsável em cada evento
**US:** 1503
**Resultado esperado:**
- Eventos manuais: "por Ana Lima"
- Eventos de importação/sistema: "por Sistema" (itálico)
**Status:** ✅ APROVADO

---

## TC-007 — Adicionar anotação manual
**US:** 1502
**Passos:**
1. Digitar "Cliente pediu demo para semana que vem" no textarea
2. Clicar "Adicionar anotação"
**Resultado esperado:**
- Toast "Anotação adicionada!"
- Novo item 📝 aparece no topo da timeline sem recarregar a página
- Textarea limpo após envio
**Status:** ✅ APROVADO

---

## TC-008 — Anotação respeitando limite de 1000 caracteres
**US:** 1502
**Passos:** Digitar mais de 1000 caracteres
**Resultado esperado:** Textarea trunca em 1000; contador exibe "1000/1000"
**Status:** ✅ APROVADO

---

## TC-009 — Anotação vazia não é enviada
**US:** 1502
**Passos:** Clicar "Adicionar" com textarea vazio
**Resultado esperado:** Botão desabilitado (disabled); nenhuma requisição enviada
**Status:** ✅ APROVADO

---

## TC-010 — Filtro por tipo: etapa
**US:** 1504
**Passos:** Clicar no chip "Etapa"
**Resultado esperado:** Timeline mostra apenas eventos tipo 'etapa_alterada'; outros ocultados
**Status:** ✅ APROVADO

---

## TC-011 — Filtro multiselect: etapa + anotação
**US:** 1504
**Passos:** Clicar em "Etapa" e depois em "Anotação"
**Resultado esperado:** Ambos os tipos exibidos; outros filtrados
**Status:** ✅ APROVADO

---

## TC-012 — Filtro "Todos" reseta seleção
**US:** 1504
**Passos:** Com filtros aplicados, clicar em "Todos"
**Resultado esperado:** Todos os eventos retornam à timeline
**Status:** ✅ APROVADO

---

## TC-013 — Atividade concluída registra evento
**US:** 1501
**Passos:** Concluir uma atividade do lead (resultado = "Ligação feita")
**Resultado esperado:** Evento 'atividade_concluida' aparece no histórico: "Ligação concluída — 'Ligação feita'"
**Status:** ✅ APROVADO

---

## TC-014 — Lead importado registra evento de importação
**US:** 1501
**Passos:** Lead criado via importação de planilha
**Resultado esperado:** Dois eventos na timeline: 'importacao' ("Lead importado via clientes.csv") e 'lead_criado', ambos por "Sistema"
**Status:** ✅ APROVADO

---

## TC-015 — Campo alterado registra histórico
**US:** 1505
**Passos:** Editar campo "whatsapp" na ficha do lead
**Resultado esperado:** Evento 'campo_alterado' com valorAnterior e valorNovo corretos
**Status:** ✅ APROVADO

---

## TC-016 — Export PDF do histórico
**US:** 1506
**Passos:** Clicar no botão PDF na aba Histórico
**Resultado esperado:**
- PDF gerado com: nome do lead, etapa, vendedor no header
- Lista de todos os eventos em ordem cronológica
- "De → Para" nos eventos de etapa/status
**Status:** ✅ APROVADO

---

## TC-017 — Vendedor não vê histórico de lead de outro vendedor
**US:** 1503
**Passos:** Vendedor B tenta acessar /api/leads/:id/historico de lead do Vendedor A
**Resultado esperado:** 403 Forbidden (middleware de acesso no leads.service valida vendedorId)
**Status:** ✅ APROVADO

---

## TC-018 — Vendedor não pode anotar em lead de outro vendedor
**US:** 1502
**Passos:** POST /api/leads/:id/historico/anotacao por vendedor não proprietário
**Resultado esperado:** 403 Forbidden
**Status:** ✅ APROVADO

---

## TC-019 — Timeline vazia exibe mensagem
**US:** 1501
**Dados:** Lead recém-criado manualmente (sem eventos além do 'lead_criado')
**Resultado esperado:** 'lead_criado' visível; nenhuma outra mensagem "sem eventos"
**Status:** ✅ APROVADO

---

## TC-020 — Filtro sem resultados exibe mensagem
**US:** 1504
**Passos:** Filtrar por "Importação" em um lead sem eventos de importação
**Resultado esperado:** Mensagem "Nenhum evento encontrado." centralizada
**Status:** ✅ APROVADO

---

## Resumo

| Total | Aprovados | Reprovados | Bugs |
|-------|-----------|------------|------|
| 20    | 20        | 0          | 0    |

## 20/20 aprovados — zero bugs — Sprint 15 HOMOLOGADO ✅
