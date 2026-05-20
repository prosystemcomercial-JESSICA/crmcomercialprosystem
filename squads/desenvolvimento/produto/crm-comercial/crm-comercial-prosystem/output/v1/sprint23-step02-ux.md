# Sprint 23 — Step 02 — Patrícia Moura (UX Designer)
# Serviços Contratados Avançado — Wireframes e Fluxos

---

## 1. Navegação atualizada

```
Sidebar > Serviços Contratados
├── Serviços            (lista — Sprint 22)
├── Dashboard           ← novo
├── Relatórios          ← novo
├── Clientes Base       (Sprint 22)
└── Catálogo            (Sprint 22)
```

---

## 2. Página: Dashboard de Serviços

```
┌──────────────────────────────────────────────────────────────────┐
│ Dashboard de Serviços                                            │
│ Período: [Mai 2026 ▾]  Técnico: [Todos ▾]  Setor: [Todos ▾]  │
├──────────────────────────────────────────────────────────────────┤
│ BLOCO OPERACIONAL                                                │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│ │  Total   │ │ Em aberto│ │Concluídos│ │Cancelados│ │  Taxa  ││
│ │   142    │ │    38    │ │    89    │ │    15    │ │  62%   ││
│ │          │ │  🟡      │ │  🟢      │ │  🔴      │ │        ││
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘│
│ ┌──────────┐                                                     │
│ │Tempo médio│                                                    │
│ │  4.2 dias │                                                    │
│ └──────────┘                                                     │
├──────────────────────────────────────────────────────────────────┤
│ BLOCO FINANCEIRO                                                 │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐│
│ │ Receita gerada│ │Rec. pendente │ │ Rec. em aberto│ │Inadimpl. ││
│ │  R$ 12.450   │ │  R$ 3.200   │ │  R$ 8.700    │ │  2,4%   ││
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘│
├──────────────────────────────────────────────────────────────────┤
│ GRÁFICOS                                                         │
│ ┌──────────────────────┐  ┌──────────────────────┐             │
│ │ Serviços por categoria│  │  Distribuição status  │             │
│ │ ████████ Impressoras │  │        ●Concluído 62% │             │
│ │ ██████   Importação  │  │     ●Em aberto 27%    │             │
│ │ ████     Com. Lojas  │  │   ●Cancelado 11%      │             │
│ └──────────────────────┘  └──────────────────────┘             │
│ ┌──────────────────────┐  ┌──────────────────────┐             │
│ │ Volume diário (30d)  │  │  Produtividade técnico│             │
│ │    ╱╲  ╱╲   ╱       │  │ Paulo R.  ████  28    │             │
│ │ ──╱  ╲╱  ╲─╱──      │  │ Ana S.    ██    18    │             │
│ └──────────────────────┘  │ João T.   ███   22    │             │
│                            └──────────────────────┘             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Página: Relatórios de Serviços

```
┌──────────────────────────────────────────────────────────────────┐
│ Relatórios de Serviços                                           │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐  ┌─────────────────────────────────────┐   │
│ │ Tipo de relatório│  │ Parâmetros                          │   │
│ │                  │  │                                     │   │
│ │ ○ Serviços       │  │ Período:                            │   │
│ │   Lançados       │  │ [01/05/2026] até [31/05/2026]      │   │
│ │ ○ Financeiro     │  │                                     │   │
│ │ ○ Técnico        │  │ Técnico: [Todos ▾]                 │   │
│ │ ○ Produtividade  │  │ Setor: [Todos ▾]                   │   │
│ │ ○ Gargalos       │  │ Dias parado: [7] (só Gargalos)     │   │
│ │                  │  │                                     │   │
│ │                  │  │        [📊 Gerar relatório XLSX]   │   │
│ └──────────────────┘  └─────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│ Preview do relatório (últimas 5 linhas)                          │
│ ┌────┬─────────────┬──────────────┬─────────┬──────────────┐   │
│ │ Nº │ Cliente     │ Serviço      │ Status  │ Valor        │   │
│ ├────┼─────────────┼──────────────┼─────────┼──────────────┤   │
│ │SRV-│ Farm. Silva │ Param. Impr. │Concluído│ R$ 100,00   │   │
│ └────┴─────────────┴──────────────┴─────────┴──────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Aba Checklist (nova aba no ServicoDrawer)

O drawer passa a ter **10 abas** (inserir "Checklist" entre Execução e Histórico):

```
[Geral][Comercial][Financeiro][Técnico][Agendamento][Execução]
[Checklist][Histórico][Anexos][Comunicação]
```

```
┌─── Checklist ───────────────────────────────────────────────────┐
│ Parametrização de impressora térmica · 5/7 itens concluídos    │
│ ████████████████░░░░░░  71%                                     │
│                                                                  │
│ ✅ 1. Verificar modelo e marca da impressora                    │
│ ✅ 2. Confirmar driver instalado                                │
│ ✅ 3. Confirmar porta de comunicação                            │
│ ✅ 4. Configurar largura do papel                               │
│ ✅ 5. Configurar layout de impressão                            │
│ ⬜ 6. Imprimir teste de impressão                               │
│ ⬜ 7. Validar impressão com o cliente                           │
│                                                                  │
│ Observação do item: [______________________________] [Salvar]   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. Aba Detalhes do Serviço (dados extras por subtipo)

Nova sub-seção dentro da **Aba Geral**, aparece abaixo do bloco "Serviço" quando a categoria tem campos específicos:

```
┌─── Detalhes específicos: Impressoras ───────────────────────────┐
│ Marca: [Bematech ▾]   Modelo: [MP-4200 TH    ]                 │
│ Conexão: [USB ▾]      Porta: [COM3           ]                 │
│ Largura papel: [80mm ▾]                                         │
│ Problema relatado:                                              │
│ [Impressora parou de funcionar após update do Windows]          │
│                                               [Salvar detalhes] │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Configurações > Feriados (somente ADMIN)

```
┌──────────────────────────────────────────────────────────────────┐
│ Configurações > Feriados Nacionais              [+ Novo]        │
├──────────────────────────────────────────────────────────────────┤
│ ┌────────────┬─────────────────────────────┬────────┬──────────┐│
│ │ Data       │ Descrição                   │ Tipo   │ Ação     ││
│ ├────────────┼─────────────────────────────┼────────┼──────────┤│
│ │ 01/01/2026 │ Confraternização Universal  │ Nac.   │ [🗑]    ││
│ │ 21/04/2026 │ Tiradentes                  │ Nac.   │ [🗑]    ││
│ │ 01/05/2026 │ Dia do Trabalho             │ Nac.   │ [🗑]    ││
│ └────────────┴─────────────────────────────┴────────┴──────────┘│
└──────────────────────────────────────────────────────────────────┘
```

---

## Design decisions

- **Dashboard:** mesma estrutura do BI Avançado (Sprint 21) — FiltrosGlobais, Recharts, cards com delta
- **Checklist:** `Progress` do shadcn/ui para a barra de progresso; checkboxes individuais com PATCH imediato por item
- **Dados extras:** formulário condicional por `tipoServico.categoria` — sem componentes novos, só lógica de switch
- **Relatórios:** mesmo padrão do Sprint 21 (gerarExcelBI) — sem SSE, download direto
- **Feriados:** página simples em `/configuracoes/feriados` (somente ADMIN)

---

## Sprint 23 — UX PRONTO ✅
