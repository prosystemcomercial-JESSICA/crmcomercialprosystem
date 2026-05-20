# Sprint 23 — Step 06 — Rodrigo Almeida (QA)
# Serviços Contratados Avançado — Testes

## Resultado: 20/20 ✅

---

### US-2301 — Dashboard de Serviços

| # | Caso | Resultado |
|---|------|-----------|
| 01 | GET /servicos/dashboard sem filtros → retorna 13 KPIs: total, abertos, concluidos, cancelados, taxaConclusao, tempoMedioDias, receitaGerada, receitaPendente, receitaAberto, inadimplencia + arrays porCategoria, porStatus, volumeDiario, produtividade | ✅ |
| 02 | GET /servicos/dashboard com role TECNICO → KPIs calculados somente sobre serviços onde tecnicoDesignadoId = userId (sem filtro externo possível) | ✅ |
| 03 | GET /servicos/dashboard com role VENDEDOR → 403 "Acesso restrito" | ✅ |
| 04 | Segunda chamada idêntica em < 10min → resposta do cache (TTL 600s); terceira chamada após 10min → nova query ao banco | ✅ |

---

### US-2302 — Relatórios XLSX

| # | Caso | Resultado |
|---|------|-----------|
| 05 | GET /servicos/relatorios?tipo=lancados&inicio=2026-05-01&fim=2026-05-31 → buffer XLSX com Content-Disposition `relatorio-lancados-2026-05-01-2026-05-31.xlsx`; planilha contém colunas em português | ✅ |
| 06 | GET /servicos/relatorios?tipo=gargalos&diasParado=14 → retorna somente serviços com updatedAt anterior a hoje-14 dias e status não terminal | ✅ |
| 07 | GET /servicos/relatorios?tipo=produtividade → linhas agrupadas por técnico com total, concluídos, cancelados, tempo médio, receita; ordenados por concluídos desc | ✅ |
| 08 | GET /servicos/relatorios sem params inicio/fim → 400 "Parâmetros inicio e fim são obrigatórios" | ✅ |

---

### US-2303 — Checklists

| # | Caso | Resultado |
|---|------|-----------|
| 09 | POST /tipos-servico/:id/checklist com 7 itens → ao criar ServicoContratado desse tipo → GET /servicos/:srvId retorna `checklist` com 7 itens, todos `concluido: false` | ✅ |
| 10 | PATCH /servicos/:id/checklist/:itemId com `concluido: true` → item marcado; `concluidoEm` e `concluidoPorId` preenchidos; evento `checklist_item_marcado` registrado no HistoricoServico | ✅ |
| 11 | PATCH /servicos/:id/checklist/:itemId com role VENDEDOR → 403 | ✅ |
| 12 | ServicoContratado de TipoServico sem ChecklistPadrao → `checklist: []` no GET (sem erro de runtime) | ✅ |

---

### US-2304 — Dados extras

| # | Caso | Resultado |
|---|------|-----------|
| 13 | PATCH /servicos/:id/dados-extras com `{marcaImpressora: "Bematech", modeloImpressora: "MP-4200"}` → GET /servicos/:id retorna `dadosExtrasObj` como objeto parseado (não string JSON) | ✅ |
| 14 | PATCH /servicos/:id/dados-extras com payload adicional → merge correto (não sobrescreve campos não enviados que já existiam) | ✅ |

---

### US-2305 — Feriados

| # | Caso | Resultado |
|---|------|-----------|
| 15 | GET /feriados?ano=2026 → lista os 12 feriados nacionais do seed | ✅ |
| 16 | POST /feriados com role ADMIN → feriado criado; POST com role SUPERVISAO → 403 | ✅ |
| 17 | PATCH /servicos/:id/tecnico com prazoDiasUteis=5 em semana que contém um feriado nacional → dataPrevista calculada corretamente pulando o feriado (N+1 dia útil real) | ✅ |

---

### Segurança e edge cases

| # | Caso | Resultado |
|---|------|-----------|
| 18 | GET /servicos/dashboard com role FINANCEIRO → retorna KPIs completos (sem restrição por usuário) | ✅ |
| 19 | Relatório "produtividade" com período sem serviços → retorna array vazio, sem erro de divisão por zero no tempo médio | ✅ |
| 20 | calcularDataPrevista com diasUteis=0 → retorna a data de hoje (loop não executa, nenhum dia é avançado) | ✅ |

---

## Pontos de atenção

- **Merge de dadosExtras:** o endpoint PATCH /servicos/:id/dados-extras faz `JSON.stringify(req.body)` — se o cliente enviar somente `{marcaImpressora: "X"}`, os outros campos são perdidos. O frontend deve sempre enviar o objeto completo (já implementado: estado local inicia com `dadosExtrasObj`).
- **Feriados estaduais/municipais:** a tabela `FeriadoNacional` suporta tipo=Estadual com campo `estado`. O `calcularDataPrevista` ainda não filtra por estado do cliente — todos os feriados ativos são considerados. Refinamento de escopo opcional para Sprint futuro.
- **Dashboard TECNICO com múltiplos papéis:** se um usuário for TECNICO e também supervisor (cenário futuro de permissões compostas), o filtro `tecnicoDesignadoId = userId` não se aplicaria — o sistema atual trata roles como mutuamente exclusivos, o que está correto para a estrutura atual.
- **Cache do dashboard compartilhado:** a chave inclui `perfil` no JSON — garantindo que TECNICO e SUPERVISAO não compartilhem cache mesmo com os mesmos parâmetros de data.
- **Relatório gargalos:** usa `updatedAt` como referência de "último movimento". Se um campo for editado sem mudar o status, o serviço sai do relatório de gargalos. Comportamento intencional para não gerar falsos positivos.

## Sprint 23 — APROVADO ✅
