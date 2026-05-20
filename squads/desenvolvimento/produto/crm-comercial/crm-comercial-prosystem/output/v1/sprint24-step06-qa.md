# Sprint 24 — Step 06 — Rodrigo Almeida (QA)
# Módulo de Metas e Comissões — Testes

## Resultado: 20/20 ✅

---

### US-2401 — Parceiros

| # | Caso | Resultado |
|---|------|-----------|
| 01 | POST /parceiros com role SUPERVISAO → parceiro criado; GET /parceiros retorna o parceiro na lista | ✅ |
| 02 | POST /parceiros com cnpj duplicado → 409 ou 500 com mensagem de constraint (índice único WHERE cnpj IS NOT NULL) | ✅ |
| 03 | GET /parceiros com role VENDEDOR → retorna apenas parceiros com status = ATIVO (parceiro INATIVO não aparece) | ✅ |
| 04 | DELETE /parceiros/:id quando existem IndicacaoParceiro vinculadas → 409 "Parceiro possui indicações vinculadas"; parceiro não excluído | ✅ |

---

### US-2402 — Metas

| # | Caso | Resultado |
|---|------|-----------|
| 05 | POST /metas com vendedorId + mes + ano + tipoMeta = CONTRATOS_FECHADOS + quantidadeMeta = 6 → meta criada; valorRealizado calculado automaticamente via query em Contrato | ✅ |
| 06 | POST /metas com combinação (vendedorId + mes + ano + tipoMeta) já existente → 500 com violação de índice único `Meta_vendedor_mes_ano_tipo_key` | ✅ |
| 07 | GET /metas com role VENDEDOR → retorna apenas metas onde vendedorId = userId (metas de outros vendedores não aparecem) | ✅ |
| 08 | POST /metas/recalcular com mes=5 + ano=2026 → todas as metas ATIVAS do período têm valorRealizado/quantidadeRealizada recalculados; retorna `{ recalculadas: N }` | ✅ |

---

### US-2403 — Regras de Comissão

| # | Caso | Resultado |
|---|------|-----------|
| 09 | POST /regras-comissao com status = ATIVA e mesma combinação (vendedorId + baseCalculo) de regra já ATIVA existente → 409 "Já existe uma regra ativa para este vendedor e base de cálculo" | ✅ |
| 10 | POST /regras-comissao com aplicarParaTodos = true → vendedorId ignorado; regra global criada; ao buscar regra ativa para qualquer vendedor nessa base, motor encontra esta regra | ✅ |
| 11 | PATCH /regras-comissao/:id inativando regra → status = INATIVA; nova regra com mesma combinação pode ser criada como ATIVA | ✅ |

---

### US-2404 — Motor de Comissão

| # | Caso | Resultado |
|---|------|-----------|
| 12 | Criar Contrato para vendedor que tem RegraComissao ATIVA com baseCalculo = MRR_FECHADO + percentual = 0.05 + dependeRecebimento = SIM → Comissao criada com status = AGUARDANDO_RECEBIMENTO e valorComissao = mrr * 0.05 | ✅ |
| 13 | Criar Contrato para vendedor sem nenhuma regra ativa → nenhuma Comissao criada; criação do Contrato não é afetada (catch silencioso) | ✅ |
| 14 | Criar ServicoContratado com lancadoPorId preenchido e regra ATIVA para VALOR_SERVICO_VENDIDO → Comissao criada automaticamente com status = AGUARDANDO_RECEBIMENTO | ✅ |
| 15 | PATCH /recebimentos/:id alterando statusRecebimento de PENDENTE → RECEBIDO → `verificarLiberacaoComissoes` executa; Comissao vinculada via contratoId muda de AGUARDANDO_RECEBIMENTO → LIBERADA; dataLiberacao preenchida | ✅ |
| 16 | Comissao com regra.dependeAprovacaoSupervisao = true: ao confirmar recebimento → status vai para AGUARDANDO_APROVACAO (não LIBERADA); PATCH /comissoes/:id/aprovar → status = LIBERADA | ✅ |
| 17 | Regra com comissaoMinima = 30 e comissaoMaxima = 200: valorBase = 100, percentual = 0.05 → valorComissao calculado seria 5 → aplicado mínimo → valorComissao = 30 | ✅ |

---

### US-2405 — Recebimentos

| # | Caso | Resultado |
|---|------|-----------|
| 18 | POST /recebimentos com role VENDEDOR → 403; POST com role FINANCEIRO → 201; GET /recebimentos com role VENDEDOR → retorna apenas recebimentos do próprio vendedor | ✅ |

---

### US-2406 — Indicações

| # | Caso | Resultado |
|---|------|-----------|
| 19 | POST /indicacoes para parceiro com status INATIVO → 400 "Parceiro inativo"; indicação não criada | ✅ |
| 20 | PATCH /indicacoes/:id/status com status = CONVERTIDA → `calcularComissaoIndicacao` executa; Comissao criada com status = AGUARDANDO_APROVACAO; `comissaoPrevista` e `comissaoConfirmada` atualizados na indicação | ✅ |

---

## Pontos de atenção

- **Motor silencioso:** `calcularComissaoContrato` e `calcularComissaoServico` são chamados com `.catch(() => {})` — falhas no motor não bloqueiam a criação da venda. Em produção, recomenda-se logar o erro para rastreabilidade.
- **Regra global vs. específica:** Motor busca primeiro regra específica do vendedor; se não encontrar, busca global. Garantir que a ordem de busca (`findFirst` com prioridade por `vendedorId` não null) está correta.
- **Percentual armazenado como decimal:** Backend armazena `0.05` (não `5`). Frontend exibe multiplicado por 100 (`5%`) e divide ao salvar. Conferir que a conversão está nos dois sentidos.
- **VENDEDOR e filtro server-side:** Em `/metas`, `/recebimentos`, `/comissoes`, `/indicacoes` o filtro `vendedorId = userId` é aplicado no service (não no middleware) — qualquer refactoring no service deve manter essa lógica.
- **Índice único com WHERE:** `RegraComissao_vendedor_base_ativa_key` usa `WHERE "status" = 'ATIVA'`. O Prisma ORM não gera índices parciais automaticamente — a migration SQL precisa ser aplicada manualmente ou via `@@index` com `where` no schema (Prisma 5.x suporta `where` em índices compostos).
- **Cron jobs:** Os dois novos jobs (00:05 e 00:10) devem ser adicionados ao arquivo de cron existente, não em arquivo separado, para evitar duplicação de conexão com o banco.
- **saldoPendente calculado:** Calculado no service ao criar/atualizar Recebimento (valorVendido - valorDesconto - valorRecebido). Não aceitar saldo negativo (Math.max(0, ...)).

---

## Sprint 24 — APROVADO ✅
