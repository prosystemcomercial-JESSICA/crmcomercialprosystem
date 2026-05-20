# Sprint 21 — Step 02 — Patrícia Moura (UX)
# BI Avançado — Wireframes

## Página /bi — Layout geral

```
┌─ BI Avançado ────────────────────────────────────────────────────────────┐
│  BI Avançado                 Período: [Mai 2026 ▾]  Vendedor: [Todos ▾] │
│                                                                           │
│  [KPIs]  [Funil]  [Cohort]  [Perdas]  [Origens]                         │
│                                                                           │
│  (conteúdo da aba ativa)                              [Exportar ↓]       │
└───────────────────────────────────────────────────────────────────────────┘
```

## Aba KPIs — Cards executivos

```
┌─ KPIs — Mai 2026 ─────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                    │
│  │ Leads Ativos │  │  Propostas   │  │  Contratos   │                    │
│  │     284      │  │  Enviadas    │  │  Fechados    │                    │
│  │  ▲ +12%      │  │     47       │  │     18       │                    │
│  │  vs abr/26   │  │  ▼ -3%       │  │  ▲ +22%      │                    │
│  └──────────────┘  └──────────────┘  └──────────────┘                    │
│                                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                    │
│  │   Receita    │  │  Taxa Conv.  │  │ Ticket Médio │                    │
│  │  R$ 42.800   │  │    6,3%      │  │  R$ 2.378    │                    │
│  │  ▲ +8%       │  │  ▲ +0,8pp   │  │  ▲ +5%       │                    │
│  └──────────────┘  └──────────────┘  └──────────────┘                    │
└────────────────────────────────────────────────────────────────────────────┘
```

## Aba Funil — Funil horizontal

```
┌─ Funil de Vendas — Mai 2026 ──────────────────────────────────────────────┐
│                                                                            │
│  Qualificação  ████████████████████████████████████  284 leads           │
│                         ↓ 42% avançaram                                   │
│  Proposta      ████████████████████  119 leads                           │
│                         ↓ 61% avançaram                                   │
│  Negociação    ████████████  72 leads                                    │
│                         ↓ 25% avançaram                                   │
│  Fechado       ███  18 leads                                             │
│                                                                            │
│  Taxa total de conversão: 6,3%                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

## Aba Cohort — Heatmap de conversão

```
┌─ Cohort de Conversão (últimos 6 meses) ───────────────────────────────────┐
│                                                                            │
│  Mês criação  │ Leads │ → Proposta │ → Fechado │ → Contrato │            │
│  ─────────────┼───────┼────────────┼───────────┼────────────┤            │
│  Dez/25       │  210  │   61% 🟢   │  28% 🟡   │   12% 🔴   │            │
│  Jan/26       │  198  │   58% 🟢   │  25% 🟡   │   10% 🔴   │            │
│  Fev/26       │  234  │   62% 🟢   │  22% 🟡   │    8% 🔴   │            │
│  Mar/26       │  267  │   55% 🟡   │  18% 🔴   │    5% 🔴   │            │
│  Abr/26       │  301  │   48% 🟡   │   8% 🔴   │    2% 🔴   │            │
│  Mai/26       │  284  │   42% 🟡   │   6% 🔴   │    1% 🔴   │            │
│                                                                            │
│  🟢 ≥50%  🟡 25-49%  🔴 <25%                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

## Aba Perdas — Análise de motivo

```
┌─ Análise de Perdas — Mai 2026 (87 leads perdidos) ────────────────────────┐
│                                                                            │
│  Motivo de perda               Etapa de perda                            │
│  ┌──────────────────────┐      ┌──────────────────────┐                  │
│  │     ◐ Preço          │      │   ◑ Qualificação      │                  │
│  │  38%   ◕ Concorrente │      │   28%  ◔ Proposta     │                  │
│  │         22%          │      │         42%           │                  │
│  │  ◔ Sem interesse 18% │      │   ◒ Negociação 30%    │                  │
│  │  ◔ Outros 22%        │      │                       │                  │
│  └──────────────────────┘      └──────────────────────┘                  │
│                                                                            │
│  Top concorrentes                                                         │
│  1. TOTVS          ████████████████  34%                                 │
│  2. Sankhya        ████████████  27%                                     │
│  3. Outros         ██████  15%                                           │
│  4. Não informado  ████  12%                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

## Aba Origens

```
┌─ Origem dos Leads ────────────────────────────────────────────────────────┐
│                                                                            │
│  Origem         │ Total │ Convertidos │ Taxa Conv. │ Receita Gerada       │
│  ───────────────┼───────┼─────────────┼────────────┼────────────────      │
│  Indicação      │   98  │     22      │   22,4% ▲  │  R$ 18.400          │
│  Site           │   87  │      9      │   10,3% ▲  │   R$ 7.200          │
│  Prospecção     │   74  │      6      │    8,1%    │   R$ 5.600          │
│  Evento         │   25  │      4      │   16,0% ▲  │   R$ 5.800          │
│  Sem origem     │   84  │      2      │    2,4% ▼  │   R$ 1.800          │
│  ───────────────┴───────┴─────────────┴────────────┴────────────────      │
│  Total          │  368  │     43      │   11,7%    │  R$ 38.800          │
└────────────────────────────────────────────────────────────────────────────┘
```

## Modal de exportação

```
┌─ Exportar ─────────────────────────────────────────┐
│                                                     │
│  Seção: Funil de Vendas                            │
│  Período: Mai 2026 · Vendedor: Todos               │
│                                                     │
│  [📊 Exportar Excel (.xlsx)]                       │
│  [📄 Exportar PDF]                                 │
│                                                     │
│  [Cancelar]                                        │
└─────────────────────────────────────────────────────┘
```

## UX decisions

- Abas no topo da página (não tabs shadcn — navegação mais leve); URL atualiza com `?tab=funil` para deep link
- Filtros globais (período + vendedor) persistem ao trocar de aba
- Período: mês atual (default), seletor com presets (este mês / últimos 3M / últimos 6M / personalizado com datepicker range)
- Delta nos KPIs: ▲ verde / ▼ vermelho; "pp" para percentual (taxa de conversão)
- Funil: barras horizontais com Recharts BarChart horizontal; percentual entre etapas como anotação
- Cohort: tabela estática com heatmap CSS (background-color via interpolação verde-vermelho)
- Perdas: Recharts PieChart (donut) para motivos e etapas; BarChart horizontal para concorrentes
- Origens: tabela sortable (client-side, sem re-fetch)
- Exportar: botão fixo no canto superior direito da seção ativa; modal simples para escolher formato
- VENDEDOR: rota `/bi` retorna 403; item de menu oculto via usePermission
