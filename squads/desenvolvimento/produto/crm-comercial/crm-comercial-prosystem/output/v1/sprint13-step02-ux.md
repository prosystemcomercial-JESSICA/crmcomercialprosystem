# Sprint 13 — Step 02 — Patrícia Moura (UX)
# Ranking Comercial Avançado — Wireframes

## TELA A — /ranking (Supervisão/CEO)

```
┌─────────────────────────────────────────────────────────────────┐
│ Ranking Comercial             [Mês atual ▾]   [Exportar ▾]      │
├─────────────────────────────────────────────────────────────────┤
│ [Mês atual] [Mês anterior] [Trimestre] [Ano]   Período: Mai/26  │
├──────┬──────────────┬───────────┬─────────┬──────────┬──────────┤
│  #   │ Vendedor     │ MRR ↓     │ Fecham. │ Prop.    │ Conversão│
├──────┼──────────────┼───────────┼─────────┼──────────┼──────────┤
│  🥇1 │ Ana Lima     │ R$8.200   │   9     │   14     │  64,3%   │
│      │              │ +12% ↑    │ +2 ↑    │          │          │
├──────┼──────────────┼───────────┼─────────┼──────────┼──────────┤
│   2  │ Carlos Neto  │ R$5.400   │   6     │   11     │  54,5%   │
│      │              │ -3% ↓     │         │          │          │
├──────┼──────────────┼───────────┼─────────┼──────────┼──────────┤
│   3  │ Maria Souza  │ R$3.100   │   4     │    9     │  44,4%   │
│      │              │ +8% ↑     │         │          │          │
└──────┴──────────────┴───────────┴─────────┴──────────┴──────────┘
  Clique no cabeçalho para ordenar por aquela coluna
```

## TELA B — Linha expandida (click na linha)

```
┌─ Ana Lima ──────────────────────────────────────────────────────┐
│  🥇 Campeão do Mês   🎯 Meta Batida   📈 Crescimento           │
│                                                                  │
│  Metas de Maio/26:                                              │
│  ● Fechamentos  [████████░░] 9/10 — 90%                         │
│  ● MRR          [█████████░] R$8.200/R$9.000 — 91%             │
│  ● Propostas    [██████████] 14/12 — 117% ✓                     │
│                                                                  │
│  Histórico 6 meses: [sparkline de MRR] ←  linha crescendo       │
└─────────────────────────────────────────────────────────────────┘
```

## TELA C — /ranking/meu-desempenho (Vendedor)

```
┌─────────────────────────────────────────────────────────────────┐
│ Meu Desempenho — Maio 2026                                      │
├─────────────────────────────────────────────────────────────────┤
│  Posição no time:  🥈 2º de 3                                   │
│                                                                  │
│  Metas do mês:                                                  │
│  Fechamentos   [██████░░░░] 6/10 — 60%                          │
│  MRR           [███████░░░] R$5.400/R$9.000 — 60%               │
│  Propostas     [████████░░] 11/12 — 92%                         │
│                                                                  │
│  Minhas conquistas:  📈 Crescimento                              │
│                                                                  │
│  Histórico pessoal (6 meses):                                   │
│  [Gráfico de linha — MRR mensal]                                │
│  Dez   Jan   Fev   Mar   Abr   Mai                              │
│  3.2k  3.8k  4.1k  4.0k  4.9k  5.4k                           │
└─────────────────────────────────────────────────────────────────┘
```

## TELA D — /ranking/metas (Configurar metas)

```
┌─────────────────────────────────────────────────────────────────┐
│ Configurar Metas — Maio 2026          [< Abril] [Junho >]       │
├─────────────────────────────────────────────────────────────────┤
│ Vendedor         Fechamentos   MRR (R$)   Propostas   Abordados │
│ Ana Lima         [10      ]   [9000    ]  [12     ]   [30    ]  │
│ Carlos Neto      [10      ]   [9000    ]  [12     ]   [30    ]  │
│ Maria Souza      [ 8      ]   [7000    ]  [10     ]   [25    ]  │
├─────────────────────────────────────────────────────────────────┤
│                                          [Salvar metas]         │
└─────────────────────────────────────────────────────────────────┘
```

## UX decisions

- Variação vs mês anterior: verde (↑) / vermelho (↓) / cinza (=)
- Badges: tooltip ao hover explicando a conquista
- Ordenação: clique no header da coluna, seta indica direção; default MRR desc
- Período: tab buttons (não select) para fluidez — muda instantaneamente via React Query
- Vendedor: redireciona automaticamente para /meu-desempenho (não vê ranking do time)
- Exportar: dropdown com opções CSV e PDF
- Sparkline 6 meses: componente inline, sem eixos, só tendência visual
- Metas: se não configuradas para o mês, barras aparecem em cinza com "Meta não configurada"
