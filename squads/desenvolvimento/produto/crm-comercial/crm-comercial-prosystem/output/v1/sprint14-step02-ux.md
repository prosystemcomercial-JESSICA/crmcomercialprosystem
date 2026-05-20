# Sprint 14 — Step 02 — Patrícia Moura (UX)
# Previsão de Fechamento — Wireframes

## TELA A — /forecast (tela principal)

```
┌─────────────────────────────────────────────────────────────────┐
│ Previsão de Fechamento                [Exportar ▾]  [Config ⚙]  │
├──────────────────┬──────────────────┬───────────────────────────┤
│   MAIO/26        │   JUNHO/26       │   JULHO/26                │
│  ──────────────  │  ──────────────  │  ──────────────           │
│  ✅ Fechado       │  ✅ Fechado       │  ✅ Fechado               │
│  R$ 18.400       │  R$ 0            │  R$ 0                    │
│                  │                  │                           │
│  📊 Provável      │  📊 Provável      │  📊 Provável              │
│  R$ 12.350       │  R$ 8.200        │  R$ 4.100                │
│                  │                  │                           │
│  📈 Otimista     │  📈 Otimista     │  📈 Otimista              │
│  R$ 22.000       │  R$ 14.500       │  R$ 7.800                │
└──────────────────┴──────────────────┴───────────────────────────┘

 Gráfico — Previsão de MRR por mês
 ┌────────────────────────────────────────┐
 │  25k ─┤ ██                            │
 │  20k ─┤ ██ ░░                         │
 │  15k ─┤ ██ ░░ ░░                      │
 │  10k ─┤ ██ ░░ ░░ ▒▒                   │
 │   5k ─┤ ██ ░░ ░░ ▒▒                   │
 │        Mai  Jun  Jul   ── Meta R$20k   │
 │  ██ Fechado  ░░ Provável  ▒▒ Gap meta  │
 └────────────────────────────────────────┘

 Por vendedor — Maio/26
 ┌──────────────────────────────────────────────────────────────┐
 │ Vendedor      Fechado      Provável      Otimista            │
 │ Ana Lima      R$10.200     R$ 7.100      R$12.000            │
 │ Carlos Neto   R$ 5.400     R$ 3.800      R$ 6.500            │
 │ Maria Souza   R$ 2.800     R$ 1.450      R$ 3.500            │
 └──────────────────────────────────────────────────────────────┘

 Pipeline — leads que compõem o forecast
 ┌─────────────────────────────────────────────────────────────┐
 │ Lead           Etapa             Vendedor  Potencial  Pond. │
 │ Farmácia Bem   Proposta Enviada  Ana Lima  R$890      55%   │
 │ Padaria Silva  Qualificação      Carlos    R$650      15%   │
 │ Varej. Norte   Negociação        Maria     R$1.200    75%   │
 │ ...                                                         │
 └─────────────────────────────────────────────────────────────┘
```

## TELA B — /forecast/configuracoes

```
┌─────────────────────────────────────────────────────────────────┐
│ Configurar Probabilidades por Etapa                             │
├──────────────────────────────────────┬──────────────────────────┤
│ Etapa                                │ Probabilidade (%)        │
├──────────────────────────────────────┼──────────────────────────┤
│ Primeiro Contato                     │ [  5  ]%                 │
│ Qualificação                         │ [ 15  ]%                 │
│ Apresentação Agendada                │ [ 30  ]%                 │
│ Proposta Enviada                     │ [ 55  ]%                 │
│ Negociação                           │ [ 75  ]%                 │
├──────────────────────────────────────┴──────────────────────────┤
│ ⚠ Leads nas etapas Fechado/Perdido não entram no forecast.      │
│                                            [Salvar]             │
└─────────────────────────────────────────────────────────────────┘
```

## UX decisions

- 3 cards fixos (mês atual + 2 próximos): fácil leitura sem scroll
- Gráfico empilhado: azul escuro = certeza (fechado), azul claro = probabilidade (provável), cinza = gap até meta mensal
- Linha pontilhada horizontal = meta mensal de MRR (vinda de MetaVendedor somada)
- Clique em um lead na tabela: drawer lateral com ficha do lead
- Tab de mês nos cards seleciona o mês para a tabela do pipeline abaixo
- Config (⚙): ícone no topo → abre /forecast/configuracoes (modal ou página)
- Probabilidades: input numérico 0-100, validação em tempo real
- "Provável" sempre < "Otimista" por definição (ponderação < 100%)
