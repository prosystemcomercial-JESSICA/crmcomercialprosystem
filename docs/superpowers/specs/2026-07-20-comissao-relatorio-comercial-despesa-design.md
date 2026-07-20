# Comissão gerada a pagar no Relatório Comercial + lançamento automático no Centro de Custos

## Contexto

O Relatório Comercial (`/relatorio-comercial`, arquivo `frontend/app/relatorio-comercial/page.tsx` + `backend/src/routes/relatorio-comercial.ts`) mostra o resultado do mês (fechamentos, vendas adicionais, entrada×saída de MRR etc.), mas não mostra quanto de **comissão foi gerada** (vendedor + supervisão) sobre os contratos novos (setup) e vendas adicionais fechados no mês.

Além disso, o Centro de Custos (`/centro-custos`) já tem a categoria `COMISSAO` cadastrada no enum de `LancamentoFinanceiro`, mas nada no sistema hoje cria esse lançamento automaticamente — comissões só aparecem na tela `/comissoes`. O usuário quer que, ao ser gerada, a comissão também apareça como despesa no Centro de Custos, sem precisar de lançamento manual.

Maio e junho de 2026 já têm vendas fechadas e comissões geradas (antes desta automação existir), então também é necessário um backfill retroativo para esses dois meses.

## Escopo

1. **Card "Comissão gerada a pagar"** na tela de Relatório Comercial, mostrando o total de comissão (vendedor + supervisão) gerada no mês, somando contratos novos (setup) e vendas adicionais, com detalhamento por origem.
2. **Automação**: ao gerar uma `Comissao` (contrato novo ou venda adicional confirmada), criar automaticamente um `LancamentoFinanceiro` (SAIDA, categoria COMISSAO) no Centro de Custos, na competência do mês em que a venda foi fechada.
3. **Backfill** das comissões já existentes de maio e junho/2026 para gerar os lançamentos retroativos correspondentes, uma única vez.

## Fora de escopo

- Mudar o cálculo de percentuais de comissão (vendedor 15%, supervisão 5%) — mantém como está.
- Mudar o fluxo de pagamento de comissão (`A_RECEBER` → `A_CONFIRMAR` → `CONFIRMADA` → `PAGA`) — a automação de despesa é independente desse fluxo.
- Criar um "painel de SEO" — confirmado com o usuário que a tela-alvo é o Relatório Comercial existente.

## Design

### 1. Card no Relatório Comercial

**Backend** (`relatorio-comercial.ts`, função `metricasReaisDoMes`):

O bloco `comissoes` atual filtra `Comissao` por `mes_pagamento` (mês em que o financeiro paga — pode ser bem depois da venda, definido só após a instalação). Isso é útil para outro propósito (fluxo de caixa do financeiro), mas não é o que o card precisa.

Adicionar uma nova sub-consulta, `comissao_gerada_no_mes`, filtrando `Comissao` por `periodo` (campo `"YYYY-MM"` = competência real da venda, já setado na criação da comissão) igual ao mês do relatório, com `status != 'CANCELADA'`. Agregar:
- `total_vendedor`: soma de `valor_comissao` onde `papel = 'VENDEDOR'`
- `total_supervisao`: soma de `valor_comissao` onde `papel = 'SUPERVISAO'`
- `total_geral`: soma de tudo
- Detalhamento por origem: soma separada para `tipo` de contrato (`CONTRATO`) vs vendas adicionais (`VENDA_ADICIONAL`, `SUPERVISAO_VENDA_ADICIONAL`)

Retornar esse bloco junto dos demais em `metricasReaisDoMes`.

**Frontend** (`relatorio-comercial/page.tsx`):

Novo card "💰 Comissão gerada a pagar", posicionado ao lado/abaixo da seção "Vendas adicionais do mês", seguindo o padrão visual dos cards existentes (mesmo estilo de `fmt()`, bordas, cores). Mostra:
- Total geral em destaque
- Subtotais: vendedor / supervisão
- Subtotais: contratos novos (setup) / vendas adicionais

### 2. Automação: Comissão → Despesa no Centro de Custos

Ponto de criação da `Comissao` hoje: `backend/src/lib/comissao-fluxo.ts`, função `upsertComissaoContrato`, chamada por `criarImplantacaoEComissoes` (contratos novos) e pelo fluxo de venda adicional confirmada.

Seguindo o precedente já existente no código (`backend/src/routes/clientes.ts:668`, que lança o MRR perdido de churn como `LancamentoFinanceiro` best-effort), adicionar logo após a criação/upsert da `Comissao`:

```ts
await prisma.lancamentoFinanceiro.upsert({
  where: { origem_unica: { origem_tipo: 'COMISSAO', origem_id: comissao.id } }, // precisa de campo novo, ver abaixo
  create: {
    tipo: 'SAIDA', categoria: 'COMISSAO', recorrencia: 'PONTUAL',
    valor: comissao.valor_comissao,
    competencia_ano: anoDoPeriodo, competencia_mes: mesDoPeriodo, // do campo `periodo` da comissão (mês da venda)
    descricao: `Comissão ${papel} — ${nomeCliente}`,
    vendedor_id: comissao.responsavel_id,
    origem_tipo: 'COMISSAO', origem_id: comissao.id,
    created_by: 'system',
  },
  update: {},
}).catch(() => {});
```

**Idempotência**: `LancamentoFinanceiro` não tem hoje um campo de origem rastreável. Adicionar `origem_tipo String?` e `origem_id String?` (nullable, sem quebrar lançamentos manuais existentes) + índice único parcial (`@@unique([origem_tipo, origem_id])`, tolerando nulls conforme comportamento do Prisma/MySQL) para permitir upsert idempotente e evitar duplicar o lançamento se o fluxo rodar mais de uma vez para a mesma comissão (ex.: reprocessamento, correção manual).

Se a criação da comissão for cancelada depois (recuo/distrato, já tratado em `aplicarRecuo`), o lançamento de despesa correspondente também deve ser removido/cancelado no mesmo fluxo — usar o `origem_id` para localizá-lo.

### 3. Backfill de maio/junho

Script one-off (`backend/scripts/backfill-lancamentos-comissao.ts`), executado manualmente uma vez:

- Busca todas as `Comissao` com `periodo` em `2026-05` ou `2026-06`, `status != 'CANCELADA'`.
- Para cada uma, aplica a mesma lógica de upsert do item 2 (reaproveitando uma função extraída, ex. `criarLancamentoDeComissao(prisma, comissao)`, compartilhada entre o fluxo automático e o backfill).
- Idempotente: pode rodar mais de uma vez sem duplicar, graças ao `@@unique([origem_tipo, origem_id])`.
- Loga quantos lançamentos foram criados/já existiam.

## Testes

- Unitário/manual: gerar uma comissão de contrato novo em ambiente de dev → conferir que aparece um `LancamentoFinanceiro` categoria COMISSAO com a competência correta.
- Rodar o backfill duas vezes seguidas → confirmar que não duplica.
- Conferir o card no Relatório Comercial de maio e junho/2026 após o backfill → valores batem com a soma manual das comissões desses meses na tela `/comissoes`.
- Testar recuo de contrato → lançamento de despesa correspondente é removido/cancelado.
