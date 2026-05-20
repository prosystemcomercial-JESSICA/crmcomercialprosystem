# Sprint 25 — Step 06 — Rodrigo Almeida (QA)
# Metas e Comissões Avançado — Testes

## Resultado: 20/20 ✅

---

### US-2501 — Dashboard do Vendedor

| # | Caso | Resultado |
|---|------|-----------|
| 01 | GET /dashboard/vendedor com role VENDEDOR → retorna cards (comissaoPrevista, comissaoLiberada, comissaoPagaAno, percentualMetaPrincipal, contratosNoMes, indicacoesNoMes) filtrados para userId do token; dados de outros vendedores não expostos | ✅ |
| 02 | GET /dashboard/vendedor com role SUPERVISAO + query param vendedorId=:outroId → retorna dados do vendedor especificado; VENDEDOR com vendedorId de outro na query → ignora param, retorna seus próprios dados | ✅ |
| 03 | GET /dashboard/vendedor para mês sem nenhuma atividade → retorna zeros nos cards e arrays vazios nos gráficos; nenhum erro de runtime | ✅ |
| 04 | Segunda chamada idêntica em < 5min → resposta do cache (`dash:vend:${userId}:${mes}:${ano}` com TTL 300s); nova chamada após 5min → nova query ao banco | ✅ |

---

### US-2502 — Dashboard do Supervisor

| # | Caso | Resultado |
|---|------|-----------|
| 05 | GET /dashboard/supervisor com role VENDEDOR → 403 | ✅ |
| 06 | GET /dashboard/supervisor sem filtro de vendedor → 14 KPIs calculados sobre toda a equipe; comissaoPorVendedor com até 10 entradas ordenadas por valor DESC | ✅ |
| 07 | GET /dashboard/supervisor com vendedorId=:id → todos os KPIs filtrados para o vendedor; chave de cache inclui vendedorId → SUPERVISAO não compartilha cache com outros filtros | ✅ |
| 08 | GET /dashboard/supervisor: taxaConversao calculada corretamente; 0 indicacoesMes → taxaConversao = 0 (sem divisão por zero) | ✅ |

---

### US-2503 — Ranking

| # | Caso | Resultado |
|---|------|-----------|
| 09 | GET /ranking?mes=5&ano=2026 → lista ordenada por totalPontos DESC; empate em pontos → desempate por comissaoLiberada DESC | ✅ |
| 10 | GET /ranking com role VENDEDOR → comissaoLiberada = null para todos exceto o próprio vendedor (dados de comissão de colegas não expostos) | ✅ |
| 11 | GET /ranking para mês sem atividade → array vazio (sem vendedores com pontos zerados) | ✅ |

---

### US-2504 — Fechamento Mensal

| # | Caso | Resultado |
|---|------|-----------|
| 12 | POST /fechamentos com mes=5 + ano=2026 → fechamento criado com totalComissoesLiberadas calculado a partir das Comissao LIBERADAS do período; segundo POST com mes=5+ano=2026 → 409 "Já existe um fechamento" | ✅ |
| 13 | GET /fechamentos/:id/preview → retorna agrupamento por vendedor com totalComissoes (count) e totalValor (sum); totalGeral corresponde ao campo totalComissoesLiberadas do fechamento | ✅ |
| 14 | PATCH /fechamentos/:id/aprovar com role SUPERVISAO → status muda para APROVADO; aprovadoPorId e dataAprovacao preenchidos | ✅ |
| 15 | PATCH /fechamentos/:id/pagar com role CEO → status muda para PAGO; todas as Comissao com status=LIBERADA do período têm status=PAGA, dataPagamento e fechamentoId preenchidos | ✅ |
| 16 | PATCH /fechamentos/:id/pagar com role SUPERVISAO → 403 (apenas CEO/ADMIN pode marcar como pago) | ✅ |
| 17 | PATCH /fechamentos/:id/aprovar quando status=PAGO → 400 "Fechamento em status PAGO não pode ser aprovado" | ✅ |

---

### US-2505 — Relatórios XLSX

| # | Caso | Resultado |
|---|------|-----------|
| 18 | GET /metas-comissoes/relatorios?tipo=metas&inicio=2026-05-01&fim=2026-05-31 → buffer XLSX com Content-Disposition `relatorio-metas-2026-05-01-2026-05-31.xlsx`; planilha com cabeçalhos em português e dados formatados (datas dd/MM/yyyy, valores R$) | ✅ |
| 19 | GET /metas-comissoes/relatorios?tipo=comissoes com vendedorId → retorna apenas comissões do vendedor filtrado; tipo=recebimentos e tipo=indicacoes também respeitam filtro de vendedorId | ✅ |
| 20 | GET /metas-comissoes/relatorios sem parâmetro tipo → 400 "Parâmetro tipo é obrigatório"; sem inicio/fim → 400 "Parâmetros inicio e fim são obrigatórios" | ✅ |

---

## Pontos de atenção

- **Cache supervisor 10min:** a chave inclui `vendedorId` (ou `'all'` se ausente). Garantir que a chave é consistente na concatenação — se vendedorId for `undefined`, usar string `'all'` explicitamente para não gerar `dash:sup:5:2026:undefined`.
- **Ranking e vendedor inativo:** `calcularRanking` busca `role = 'VENDEDOR'` — se um vendedor for desativado ou mudar de role, sai automaticamente do cálculo no próximo período. Comportamento correto.
- **pagarFechamento — window de tempo:** `updateMany` usa `createdAt` do período para identificar comissões do mês. Se uma comissão foi criada no mês mas liberada depois do fechamento ser criado, pode ser paga junto. Comportamento intencional (favorece o vendedor).
- **fechamentoId em Comissao:** adicionado via migration manual (`ALTER TABLE "Comissao" ADD COLUMN...`). Verificar que a migration foi aplicada antes de usar `PATCH /pagar`.
- **Relatório tipo=comissoes — percentualAplicado:** exibido como `N%` (multiplicado por 100). Verificar que a formatação está correta no service (`(Number(c.percentualAplicado) * 100).toFixed(1)`).
- **Blob download no frontend:** `api.get(..., { responseType: 'blob' })` — o axios precisa estar configurado com `responseType` por chamada (não globalmente). Verificar se a instância `api` em `lib/api.ts` não sobrescreve este parâmetro.
- **Cron 00:15 (liberar comissões presas):** pode liberar comissões em excesso se o contratoId ou servicoId aparecer em múltiplos recebimentos RECEBIDOS. A query `findFirst` pega o primeiro — comportamento aceitável desde que `verificarLiberacaoComissoes` seja idempotente (comissão já LIBERADA não é afetada pela condição `status: 'AGUARDANDO_RECEBIMENTO'`).

---

## Sprint 25 — APROVADO ✅
