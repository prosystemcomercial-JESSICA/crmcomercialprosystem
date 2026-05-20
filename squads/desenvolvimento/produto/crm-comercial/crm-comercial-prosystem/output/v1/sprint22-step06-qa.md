# Sprint 22 — Step 06 — Rodrigo Almeida (QA)
# Módulo de Serviços Contratados — Testes

## Resultado: 20/20 ✅

---

### US-2201 — Base de Clientes Prosystem

| # | Caso | Resultado |
|---|------|-----------|
| 01 | POST /clientes-base com CNPJ válido → cria registro com codigoInterno gerado automaticamente | ✅ |
| 02 | GET /clientes-base?q=farma → retorna todos os clientes cujo razaoSocial ou nomeFantasia contém "farma" (case insensitive) | ✅ |
| 03 | POST /clientes-base/importar com CSV separado por ponto-e-vírgula → cria novos + atualiza existentes por CNPJ; retorna `{criados, atualizados, erros}` | ✅ |
| 04 | VENDEDOR acessa POST /clientes-base → 403 "Sem permissão" | ✅ |

---

### US-2202 — Catálogo de Tipos de Serviço

| # | Caso | Resultado |
|---|------|-----------|
| 05 | POST /tipos-servico com todos os campos → cria com `valorPadrao`, `exigeAgendamento`, `exigeDesignacaoTecnica` corretos | ✅ |
| 06 | GET /tipos-servico?ativo=true → retorna somente tipos ativos ordenados por categoria + nome | ✅ |

---

### US-2203 — Lançamento de Serviço

| # | Caso | Resultado |
|---|------|-----------|
| 07 | POST /servicos → número gerado no formato `SRV-2026-00001`; `statusGeral` = "Lançado"; `valorPadrao` copiado do TipoServico | ✅ |
| 08 | Segundo POST /servicos → número `SRV-2026-00002` (sequência global, não reinicia) | ✅ |
| 09 | POST /servicos sem JWT → 401 | ✅ |
| 10 | GET /servicos com role VENDEDOR → retorna somente serviços do próprio userId (lancadoPorId = userId) | ✅ |
| 11 | GET /servicos com role TECNICO → retorna somente serviços onde tecnicoDesignadoId = userId | ✅ |

---

### US-2204 — Aba Comercial

| # | Caso | Resultado |
|---|------|-----------|
| 12 | PATCH /servicos/:id/comercial com valorNegociado + aprovadoPorCliente + aprovadoEmData → registra histórico `aprovacao_cliente` + muda statusGeral para "Aprovado pelo cliente" automaticamente | ✅ |
| 13 | PATCH /servicos/:id/comercial com role VENDEDOR → 403 | ✅ |

---

### US-2205 — Aba Financeiro

| # | Caso | Resultado |
|---|------|-----------|
| 14 | PATCH /servicos/:id/financeiro com `liberadoParaExecucao: true` → registra `liberadoPorId`, `dataLiberacao`, evento `liberado_para_execucao` no histórico | ✅ |
| 15 | PATCH /servicos/:id/financeiro com role VENDEDOR → 403 "Sem permissão para aba financeira" | ✅ |

---

### US-2206/2207 — Aba Técnica e Agendamento

| # | Caso | Resultado |
|---|------|-----------|
| 16 | PATCH /servicos/:id/tecnico com `tecnicoDesignadoId` novo → registra evento `tecnico_designado` com nome do técnico; calcula `dataPrevista` baseada em `prazoDiasUteis` (ignora sábado e domingo) | ✅ |
| 17 | PATCH /servicos/:id/tecnico com role TECNICO em serviço NÃO designado a ele → 403 | ✅ |
| 18 | PATCH /servicos/:id/agendamento com `dataAgendamento` → registra evento `agendado` + muda statusGeral para "Agendado" | ✅ |

---

### US-2208 — Execução e Histórico

| # | Caso | Resultado |
|---|------|-----------|
| 19 | PATCH /servicos/:id/execucao com `statusFinalExecucao: "Concluído com sucesso"` → statusGeral → "Concluído", evento `execucao_concluida` no histórico | ✅ |
| 20 | GET /servicos/:id com role VENDEDOR → campo `anexos` não contém itens com `visibilidade: "Interno"` | ✅ |

---

## Pontos de atenção

- **Sequência SRV e ano:** a função `gerarNumeroServico` usa `new Date().getFullYear()` no momento da criação — se o sequencial cruzar virada de ano, os números do novo ano começam a contar a partir do ponto atual da sequência (não reinicia em 1). Solução futura: sequência por ano (`srv_2026_seq`, `srv_2027_seq`). Para volume atual é aceitável.
- **Importação CSV:** linhas com CNPJ já existente fazem UPDATE apenas de razaoSocial, nomeFantasia, status e plano — campos operacionais não são sobrescritos pelo CSV para preservar dados enriquecidos manualmente.
- **dataPrevista com dias úteis:** o cálculo avança dia a dia descartando sábado (6) e domingo (0). Não considera feriados — anotado para Sprint 23.
- **Role TECNICO ao listar:** a query usa `tecnicoDesignadoId = userId`; se o serviço não tiver técnico designado ainda, o TECNICO não o vê. Comportamento correto pela especificação.
- **Visibilidade "Interno" de anexos:** filtrado no service ao fazer `obterServico` — sem segundo endpoint. Garante que VENDEDOR nunca veja mesmo se chamar o endpoint diretamente.

## Sprint 22 — APROVADO ✅
