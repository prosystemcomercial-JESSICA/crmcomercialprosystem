# Comissão gerada a pagar no Relatório Comercial + lançamento automático no Centro de Custos

## Contexto

O Relatório Comercial (`/relatorio-comercial`, arquivo `frontend/app/relatorio-comercial/page.tsx` + `backend/src/routes/relatorio-comercial.ts`) mostra o resultado do mês (fechamentos, vendas adicionais, entrada×saída de MRR etc.), mas não mostra quanto de **comissão foi gerada** (vendedor + supervisão) sobre os contratos novos (setup) e vendas adicionais fechados no mês.

Além disso, o Centro de Custos (`/centro-custos`) já tem a categoria `COMISSAO` cadastrada no enum de `LancamentoFinanceiro`, mas nada no sistema hoje cria esse lançamento automaticamente — comissões só aparecem na tela `/comissoes`. O usuário quer que, ao ser gerada, a comissão também apareça como despesa no Centro de Custos, sem precisar de lançamento manual.

Maio e junho de 2026 já têm vendas fechadas e comissões geradas (antes desta automação existir), então também é necessário um backfill retroativo para esses dois meses.

## Escopo

1. **Card "Comissão gerada a pagar"** na tela de Relatório Comercial, mostrando o total de comissão (vendedor + supervisão) gerada no mês, somando contratos novos (setup) e vendas adicionais, com detalhamento por origem.
2. **Sincronização**: endpoint/função que garante que toda `Comissao` ativa (não cancelada) tenha um `LancamentoFinanceiro` (SAIDA, categoria COMISSAO) correspondente no Centro de Custos, na competência do mês em que a venda foi fechada.
3. **Backfill** das comissões já existentes de maio e junho/2026, usando a mesma função de sincronização — cobre o retroativo e valida a automação de uma vez.

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

### 2. Sincronização: Comissão → Despesa no Centro de Custos

**Por que sincronização em vez de instrumentar cada ponto de criação:** a criação/atualização de `Comissao` está espalhada em pelo menos 4 lugares (`comissao-fluxo.ts` para contratos novos; `vendas-adicionais.ts`, `contratos-comerciais.ts` e `ativos.ts` para vendas adicionais, incluindo um endpoint de backfill próprio para comunicações). Instrumentar despesa automática em cada um é frágil — fácil esquecer um ponto ao adicionar um fluxo novo no futuro. Em vez disso, uma função de sincronização única varre a tabela `Comissao` e garante que cada uma tenha seu `LancamentoFinanceiro` correspondente.

**Idempotência**: adicionar campos `origem_tipo String?` e `origem_id String?` (nullable) ao model `LancamentoFinanceiro`, com `@@unique([origem_tipo, origem_id])`. Lançamentos manuais existentes ficam com esses campos `null` (não conflitam entre si — MySQL trata múltiplos `NULL` como distintos em índice único).

**Função central** (`backend/src/lib/comissao-fluxo.ts`, nova função `sincronizarLancamentosDeComissao`):

```ts
export async function sincronizarLancamentosDeComissao(prisma: PrismaClient, filtro?: { periodoDe?: string; periodoAte?: string }) {
  const where: any = { status: { not: 'CANCELADA' } };
  if (filtro?.periodoDe && filtro?.periodoAte) {
    where.periodo = { gte: filtro.periodoDe, lte: filtro.periodoAte };
  }
  const comissoes = await prisma.comissao.findMany({ where });
  let criados = 0, jaExistiam = 0;
  for (const c of comissoes) {
    if (!c.periodo) continue;
    const [anoStr, mesStr] = c.periodo.split('-');
    const existente = await prisma.lancamentoFinanceiro.findFirst({
      where: { origem_tipo: 'COMISSAO', origem_id: c.id },
    });
    if (existente) { jaExistiam++; continue; }
    await prisma.lancamentoFinanceiro.create({
      data: {
        tipo: 'SAIDA', categoria: 'COMISSAO', recorrencia: 'PONTUAL',
        valor: c.valor_comissao,
        competencia_ano: Number(anoStr), competencia_mes: Number(mesStr),
        descricao: c.descricao || `Comissão ${c.papel || ''}`,
        vendedor_id: c.responsavel_id,
        origem_tipo: 'COMISSAO', origem_id: c.id,
        created_by: 'system',
      },
    }).catch(() => {});
    criados++;
  }
  // Cancela lançamentos cuja comissão de origem foi cancelada (recuo/distrato).
  const canceladas = await prisma.comissao.findMany({ where: { status: 'CANCELADA' }, select: { id: true } });
  let removidos = 0;
  for (const c of canceladas) {
    const del = await prisma.lancamentoFinanceiro.deleteMany({ where: { origem_tipo: 'COMISSAO', origem_id: c.id } });
    removidos += del.count;
  }
  return { criados, jaExistiam, removidos };
}
```

Essa função é chamada de duas formas:
- **Sob demanda / contínua**: um endpoint `POST /relatorio-comercial/sincronizar-comissoes` (gestão only, `requireGestor`) que roda a sincronização completa. Chamado manualmente pela tela de Relatório Comercial (botão) sempre que necessário, e também automaticamente no `onReady` do backend (mesmo padrão do seed existente em `relatorio-comercial.ts:19`) para manter tudo sincronizado a cada deploy/restart sem exigir ação manual.
- **Backfill de maio/junho**: mesma função, chamada com `filtro: { periodoDe: '2026-05', periodoAte: '2026-06' }` (ver item 3).

### 3. Backfill de maio/junho

Não precisa de script separado — é a mesma `sincronizarLancamentosDeComissao` chamada uma vez com o filtro de período, seja via endpoint (`POST /relatorio-comercial/sincronizar-comissoes?periodoDe=2026-05&periodoAte=2026-06`) seja diretamente no `onReady` (que já roda a sincronização completa, cobrindo maio/junho automaticamente na primeira execução após o deploy).

## Testes

- Unitário/manual: gerar uma comissão de contrato novo em ambiente de dev → rodar a sincronização → conferir que aparece um `LancamentoFinanceiro` categoria COMISSAO com a competência correta.
- Rodar a sincronização duas vezes seguidas → confirmar que não duplica (segunda vez conta tudo em `jaExistiam`).
- Conferir o card no Relatório Comercial de maio e junho/2026 após a sincronização com filtro de período → valores batem com a soma manual das comissões desses meses na tela `/comissoes`.
- Testar recuo de contrato (comissão cancelada) → rodar sincronização → lançamento de despesa correspondente é removido.
