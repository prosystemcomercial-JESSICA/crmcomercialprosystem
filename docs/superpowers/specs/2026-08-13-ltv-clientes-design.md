# LTV dos Clientes — Design

## Contexto e motivação

O usuário pediu para visualizar o LTV (Lifetime Value) dos clientes, voltado para Supervisão Comercial e CEO. Já existia uma fórmula de LTV definida e aprovada na spec `2026-08-04-jornada-cliente-cs-design.md` (Peça 5), mas nunca implementada — aquela spec tratava o LTV como um componente de um escopo bem maior (touchpoints de jornada, nível de CS dinâmico, checklist de implantação, matriz de portfólio por segmento).

Este design extrai **apenas o cálculo de LTV e sua visualização**, deixando o resto da spec da Jornada do Cliente para uma iteração futura, quando o usuário quiser retomá-la.

## Fórmula de LTV

Reaproveitada exatamente da spec original (Peça 5), sem alterações:

```
LTV = (mensalidade_base × meses_de_casa) + valor_instalacao
    + soma(VendaAdicional.valor_venda + acrescimo_mensal × meses_desde_a_venda, status IN (CONFIRMADA, PAGA))
```

- `meses_de_casa` = meses entre `Cliente.data_entrada` e hoje (ou até `Cliente.inativado_em`, se o cliente já saiu — LTV realizado não continua crescendo após a saída).
- Vendas adicionais só entram se `status` for `CONFIRMADA` ou `PAGA` — `PENDENTE` e `CANCELADO` ficam de fora (confirmado com o usuário, dado o contexto recente de reconstrução de 25 vendas adicionais com esses status variados).
- `meses_desde_a_venda` = meses entre `VendaAdicional.data_venda` e hoje.
- Clientes sem `data_entrada` ou sem `mensalidade_base` têm LTV calculado só com as parcelas disponíveis (não bloqueia o cálculo — trata ausência como 0).
- É o **LTV realizado até hoje**, não projetado — mesma decisão da spec original (projeção fica fora de escopo, exige taxa de churn confiável por segmento que ainda não existe).

## Modelo de dados

Novo campo em `Cliente`, idêntico ao que a spec original já previa:

```prisma
model Cliente {
  // ...
  ltv_calculado Float?
}
```

Recalculado sob demanda (não em background job — esse projeto não tem infraestrutura de job assíncrono para isso hoje, e o volume de clientes é pequeno o suficiente para calcular em tempo real na consulta). O campo `ltv_calculado` fica como cache opcional para uso futuro por outras telas (ex.: se a Jornada do Cliente for retomada), mas a tela de LTV desta feature sempre calcula ao vivo, não lê do cache — evita a tela mostrar valor desatualizado.

## Backend

Novo endpoint `GET /clientes/ltv`, autenticado, restrito ao grupo `GESTAO_COMERCIAL` (`CEO`, `ADMIN`, `SUPERVISAO_COMERCIAL` — mesmo grupo que já vê o Painel do CEO, sem incluir `VENDEDOR`).

Resposta:
```json
{
  "status": "success",
  "data": {
    "resumo": {
      "ltv_medio": 0,
      "ltv_total": 0,
      "total_clientes_considerados": 0
    },
    "clientes": [
      { "id": "...", "nome": "...", "razao_social": "...", "segmento": "...", "situacao": "ATIVA", "meses_de_casa": 0, "ltv": 0 }
    ]
  }
}
```

- `clientes` vem ordenado por `ltv` decrescente por padrão (a UI pode reordenar no cliente, sem nova chamada — volume de clientes é pequeno, ~600).
- Considera clientes `ATIVA` e `INATIVA` (LTV realizado é histórico, faz sentido mostrar de quem já saiu também) — mas o resumo (`ltv_medio`, `ltv_total`) e o "top 10" no frontend usam por padrão só `ATIVA` (clientes inativos aparecem na lista completa, mas não distorcem os agregados de quem é cliente hoje). A UI permite alternar para incluir inativos no resumo, se o usuário quiser.

## Frontend

Nova página `/ltv`, item de menu novo visível para o grupo `GESTAO_COMERCIAL` (mesma constante já usada em outras páginas de gestão, ex. Painel do CEO).

**Topo — cards de resumo:**
- LTV médio da base (clientes ativos)
- LTV total da base (clientes ativos)
- Top 10 clientes por LTV (lista compacta dentro de um card, nome + valor)

**Abaixo — tabela completa:**
- Colunas: Cliente (razão social/nome fantasia), Segmento, Situação, Tempo de casa (meses), LTV
- Ordenável por clique no cabeçalho de cada coluna (LTV decrescente por padrão)
- Filtro simples de busca por nome (client-side, já que os dados completos vêm em uma única chamada)

## Fora de escopo (fica para quando a Jornada do Cliente for retomada)

- LTV projetado (estimativa de valor futuro)
- Nível de CS dinâmico (Alto/Padrão/Baixo toque) baseado em LTV + tempo de casa + Health Score
- Matriz de portfólio por segmento (LTV agregado × custo marginal de servir)
- Recálculo em background/scheduler — por ora é sempre calculado ao vivo na consulta
