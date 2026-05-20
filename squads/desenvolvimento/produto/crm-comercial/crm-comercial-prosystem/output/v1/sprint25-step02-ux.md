# Sprint 25 — Step 02 — Patrícia Moura (UX Designer)
# Metas e Comissões Avançado — Wireframes e Fluxos

---

## Navegação (atualização)

```
Sidebar — Metas e Comissões
├── Meu Dashboard          ← NOVO (vendedor: próprio / supervisor: equipe)
├── Minhas Metas
├── Minhas Comissões
├── Minhas Indicações
├── Recebimentos
├── ─────────────────── (separador — somente SUPERVISAO+)
├── Metas (gestão)
├── Regras de Comissão
├── Parceiros
├── Ranking da Equipe      ← NOVO
├── Fechamento Mensal      ← NOVO
└── Relatórios             ← NOVO
```

---

## 1. Dashboard do Vendedor

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Meu Dashboard                      [Mai/2026 ▾]                         │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ Comissão     │ │ Comissão     │ │ Comissão     │ │ Meta         │   │
│  │ Prevista     │ │ Liberada     │ │ Paga (ano)   │ │ Principal    │   │
│  │ R$ 1.240     │ │ R$ 780       │ │ R$ 4.320     │ │ 66,7%        │   │
│  │ ↑12% vs abr │ │ ↑8% vs abr  │ │ acumulado    │ │ ████████░░░  │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                                           │
│  ┌──────────────┐ ┌──────────────┐                                       │
│  │ Contratos    │ │ Indicações   │                                       │
│  │ Mai/2026     │ │ Mai/2026     │                                       │
│  │ 4 fechados   │ │ 3 lançadas   │                                       │
│  └──────────────┘ └──────────────┘                                       │
│                                                                           │
├────────────────────────┬─────────────────────────────────────────────────┤
│ Comissão Prev vs Lib   │ Atingimento de Metas                            │
│ (BarChart 6 meses)     │ (BarChart horizontal)                           │
│                        │                                                  │
│   2.000 ┤    ▓         │  Contratos    ████████░░  66%                  │
│   1.500 ┤  ▓ ▓    ▓   │  MRR          ███████████ 100% ✅               │
│   1.000 ┤▓ ▓ ▓ ▓ ▓ ▓ │  Instalação   █████░░░░░░  45%                  │
│         └────────────  │  Indicações   ████░░░░░░░  40%                  │
│         Dez→Mai        │                                                  │
├────────────────────────┼─────────────────────────────────────────────────┤
│ Recebimentos por tipo  │ Comissão acumulada no mês                       │
│ (PieChart)             │ (LineChart dia a dia)                            │
│                        │                                                  │
│  🔵 Instalação 45%     │   800 ┤              ╱‾‾‾                       │
│  🟢 Mensalidade 35%    │   400 ┤      ╱‾‾‾╱                              │
│  🟡 Serviço 15%        │     0 ┤──────                                   │
│  ⚪ Outros 5%          │       1  5  10  15  19                          │
├────────────────────────┴─────────────────────────────────────────────────┤
│ Últimas Comissões                   Metas do Mês                         │
│ ┌────────────────────────────────┐  ┌──────────────────────────────────┐ │
│ │ Contrato Farm.Silva R$60 Lib. │  │ Contratos: 4/6 ████████░░ 66%   │ │
│ │ Serviço Pad.Lima  R$30 Prev. │  │ MRR: R$2.280/R$2.280 ██████ 100%│ │
│ │ Indicação TEF+    R$50 AgAp. │  └──────────────────────────────────┘ │
│ └────────────────────────────────┘                                       │
│ Indicações Recentes          Recebimentos Pendentes                      │
│ ┌──────────────────────────┐  ┌────────────────────────────────────────┐ │
│ │ Farm.Silva TEF+ Convert.│  │ 🔴 Pad.Lima R$150 VENCIDO 07/05      │ │
│ │ Merc.Stos CertBR Neg.   │  │ 🟡 Merc.Stos R$400 vence 05/06       │ │
│ └──────────────────────────┘  └────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Dashboard do Supervisor

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Dashboard — Equipe                  [Mai/2026 ▾] [Vendedor ▾]           │
├──────────────────────────────────────────────────────────────────────────┤
│ KPIs — linha 1                                                            │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │ Com.     │ │ Com.     │ │ Com.     │ │ Com.     │ │ Receita  │       │
│ │ Prevista │ │ Liberada │ │ Paga     │ │ Bloq.    │ │ Recebida │       │
│ │ R$8.420  │ │ R$5.200  │ │ R$3.100  │ │ R$320    │ │ R$42.800 │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│ KPIs — linha 2                                                            │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │ Inadim-  │ │ Metas    │ │ Metas    │ │ Metas    │ │ Indicac. │       │
│ │ plência  │ │ Ativas   │ │ 100% ✅  │ │ <50% ⚠️  │ │ no mês   │       │
│ │ R$1.200  │ │ 12       │ │ 4        │ │ 3        │ │ 8        │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│ KPIs — linha 3                                                            │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                     │
│ │ Indic.   │ │ Taxa     │ │ Parceiros│ │ Ticket   │                     │
│ │ Convert. │ │ Conversão│ │ Ativos   │ │ Médio    │                     │
│ │ 3        │ │ 37,5%    │ │ 6        │ │ R$1.733  │                     │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                     │
├─────────────────────────────────────┬────────────────────────────────────┤
│ Comissão por Vendedor               │ Distribuição de Status             │
│ (BarChart horizontal)               │ (PieChart)                         │
│                                     │                                    │
│  João   ████████████████ R$2.100   │  🟢 Liberada  42%                 │
│  Ana    ███████████ R$1.600        │  🟡 Ag.Receb. 35%                 │
│  Pedro  ████████ R$1.200           │  ⚫ Prevista  18%                 │
│  Maria  ██████ R$900               │  🔴 Bloqueada  5%                 │
│  Carla  ████ R$600                 │                                    │
├─────────────────────────────────────┴────────────────────────────────────┤
│ Evolução mensal (comissões liberadas)   Indicações por parceiro          │
│ (LineChart 12 meses)                    (BarChart)                       │
│                                                                           │
│  6k ┤              ╱                   TEF+    ████████ 8               │
│  4k ┤        ╱‾‾‾╱                    CertBR  █████ 5                   │
│  2k ┤──╱‾‾╱                           ContAss ███ 3                     │
│     Jun─────────Mai                                                       │
├──────────────────────────────────────────────────────────────────────────┤
│ Ranking da Equipe — Mai/2026                                              │
│ ┌───┬──────────────┬────────┬──────────┬───────────┬────────────┬──────┐ │
│ │ # │ Vendedor     │ Pontos │ Contratos│ Indicac.  │ Comissão   │ Meta │ │
│ ├───┼──────────────┼────────┼──────────┼───────────┼────────────┼──────┤ │
│ │🥇 │ João Silva   │ 142    │ 6        │ 3 conv.   │ R$ 2.100   │ 100% │ │
│ │🥈 │ Ana Souza    │ 118    │ 5        │ 2 conv.   │ R$ 1.600   │ 100% │ │
│ │🥉 │ Pedro Lima   │ 87     │ 4        │ 1 conv.   │ R$ 1.200   │  75% │ │
│ │ 4 │ Maria Costa  │ 65     │ 3        │ 0 conv.   │ R$ 900     │  60% │ │
│ └───┴──────────────┴────────┴──────────┴───────────┴────────────┴──────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Página: Ranking da Equipe

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Ranking da Equipe                                    [Mai/2026 ▾]        │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌───┬──────────────┬────────┬──────────┬────────┬───────────┬──────────┐ │
│ │ # │ Vendedor     │ Pontos │Contratos │  MRR   │ Indicações│ Meta >100│ │
│ ├───┼──────────────┼────────┼──────────┼────────┼───────────┼──────────┤ │
│ │🥇 │ João Silva   │ 142 pts│ 6        │R$2.280 │ 3/2 conv. │ ✅ bônus │ │
│ │🥈 │ Ana Souza    │ 118 pts│ 5        │R$1.900 │ 2/2 conv. │ ✅ bônus │ │
│ │🥉 │ Pedro Lima   │  87 pts│ 4        │R$1.520 │ 1/1 conv. │ —        │ │
│ └───┴──────────────┴────────┴──────────┴────────┴───────────┴──────────┘ │
│                                                                           │
│ Fórmula: (Contratos × 3) + (MRR / 100) + (Indicações convertidas × 2)  │
│          + (Metas acima de 100% × 5)                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Página: Fechamento Mensal

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Fechamento Mensal                              [+ Novo Fechamento]       │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ Mai/2026  Status: ABERTO   Comissões liberadas: R$ 5.200  3 vendedor│ │
│ │ [Ver detalhes] [Aprovar] [Marcar como pago]                          │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ Abr/2026  Status: PAGO     Comissões: R$ 4.800  3 vendedores  05/05 │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

**Drawer: Fechamento Mensal — Detalhes**
```
┌── Fechamento Mai/2026 ──────────────────────────────────────────────────┐
│ Status: ABERTO                                            [✕]            │
│ [Preview][Comissões][Histórico]                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ ABA PREVIEW                                                               │
│ Total a pagar: R$ 5.200,00                                               │
│ Vendedores envolvidos: 3                                                  │
│                                                                           │
│ ┌──────────────────────┬────────┬──────────────────────────────────────┐ │
│ │ Vendedor             │ Comis. │ Detalhes                             │ │
│ ├──────────────────────┼────────┼──────────────────────────────────────┤ │
│ │ João Silva           │R$2.100 │ 5 comissões liberadas               │ │
│ │ Ana Souza            │R$1.600 │ 4 comissões liberadas               │ │
│ │ Pedro Lima           │R$1.200 │ 3 comissões liberadas               │ │
│ └──────────────────────┴────────┴──────────────────────────────────────┘ │
│                                                                           │
│ Observações: [______________________________________]                    │
│                                    [Aprovar] [Cancelar]                 │
│                                                                           │
│ ABA COMISSÕES                                                            │
│ Lista todas as Comissao com status=LIBERADA do mês                       │
│ Filtro por vendedor                                                       │
│ Chip StatusComissaoBadge por linha                                       │
│                                                                           │
│ ABA HISTÓRICO                                                             │
│ Linha do tempo: ABERTO → EM_REVISAO → APROVADO → PAGO                  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Fluxo de status do Fechamento:**
```
[+ Novo Fechamento]
        ↓
     ABERTO
     [Aprovar]
        ↓
   EM_REVISAO → APROVADO
                   ↓
             [Marcar como pago]
                   ↓
                  PAGO
            (Comissao.status → PAGA)
```

---

## 5. Página: Relatórios

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Relatórios — Metas e Comissões                                           │
├──────────────────────────────────────────────────────────────────────────┤
│ Tipo de relatório:                                                        │
│ ○ Metas          ○ Comissões       ○ Recebimentos     ○ Indicações      │
│                                                                           │
│ Período: [01/05/2026] até [31/05/2026]                                  │
│ Vendedor: [Todos ▾]                                                      │
│                                                                           │
│ [📥 Exportar XLSX]                                                       │
│                                                                           │
│ Preview (primeiras 5 linhas):                                            │
│ ┌──────────────┬──────────┬───────┬───────────┬──────┬───────┬────────┐ │
│ │ Vendedor     │ Tipo     │ Mês   │ Meta      │ Real.│   %   │ Status │ │
│ ├──────────────┼──────────┼───────┼───────────┼──────┼───────┼────────┤ │
│ │ João Silva   │Contratos │Mai/26 │ 6         │ 6    │ 100%  │ Ativa  │ │
│ │ João Silva   │MRR       │Mai/26 │R$2.280    │R$2.28│ 100%  │ Ativa  │ │
│ └──────────────┴──────────┴───────┴───────────┴──────┴───────┴────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Fluxo do ciclo completo (atualizado)

```
[Venda/Serviço/Indicação] → [Comissão: Prevista]
                                    ↓
                        [Recebimento confirmado]
                                    ↓
                    [Motor verifica regra de comissão]
                                    ↓
                         [Comissão: Liberada]
                                    ↓
                    [FechamentoMensal: APROVADO]
                                    ↓
                    [PATCH /fechamentos/:id/pagar]
                                    ↓
                          [Comissão: PAGA] ✅
```

---

## Sprint 25 — UX PRONTO ✅
