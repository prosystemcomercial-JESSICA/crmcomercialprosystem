# Sprint 28 — Step 02 — Patrícia Moura (UX)
# Churn e Retenção — Wireframes e Fluxos

## Visão Geral

Módulo Churn e Retenção com 8 telas principais, 5 modais críticas e 4 fluxos de navegação. Design system: shadcn/ui + TailwindCSS + Recharts (gráficos).

---

## Telas Principais

### T1. Dashboard de Retenção (Tela Inicial)

**Localização:** `/dashboard/retencao`  
**Acesso:** CS_RETENCAO, SUPERVISAO_CS, FINANCEIRO, CEO  
**Layout:** Página cheia, scroll vertical

```
┌─────────────────────────────────────────────────────────┐
│ 🏠 Dashboard de Retenção                    [🔄 Filtros] │
├─────────────────────────────────────────────────────────┤
│ Período: Últimos 30d [v]  Status: ATIVO [v]  Risk: CRITICO [v] │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────┐ │
│  │ 📊 Clientes     │ │ 🟢 Recuperados   │ │ 📈 Taxa  │ │
│  │ em Risco        │ │ este mês         │ │ Sucesso  │ │
│  │                 │ │                  │ │          │ │
│  │ 12 clientes ⚠️  │ │ 3 clientes ✅   │ │ 72%  ✅  │ │
│  │ R$ 145k revenue │ │ Meta: 2          │ │ vs 60%   │ │
│  └──────────────────┘ └──────────────────┘ └──────────┘ │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Revenue em Risco: R$ 145.000                         │ │
│  │ [████████████░░░░] 145k / 150k                       │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌──────────────────────────┐ ┌──────────────────────────┐ │
│ │ Taxa Sucesso (90d)       │ │ Motivos Top 5            │ │
│ │                          │ │                          │ │
│ │  100%┤                   │ │ 1. Preço          (5)    │ │
│ │   75%┤      ╱╲ ╱╲       │ │ 2. Mal uso        (4)    │ │
│ │   50%┤  ╱╲╱  ╲╱  ╲╱    │ │ 3. Falta suporte  (3)    │ │
│ │   25%┤                   │ │ 4. Integrações    (2)    │ │
│ │    0%└─────────────────  │ │ 5. Outros         (2)    │ │
│ │    dia     sem    mês    │ │                          │ │
│ └──────────────────────────┘ └──────────────────────────┘ │
│                                                           │
│ ┌──────────────────────────┐ ┌──────────────────────────┐ │
│ │ Status Distribuição      │ │ Top 10 em Risk (Revenue) │ │
│ │                          │ │                          │ │
│ │  ◆ ATIVO:      8  (67%)  │ │ 1. Empresa A    | 45k    │ │
│ │  ◆ REMARCADO:  2  (17%)  │ │ 2. Empresa B    | 38k    │ │
│ │  ◆ REATIVADO:  2  (16%)  │ │ 3. Empresa C    | 28k    │ │
│ │                          │ │ ... (mostra scroll)      │ │
│ └──────────────────────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Componentes:**
- **KPI Cards (4x):** Número grande + label + subinicador (meta, tendência, badge)
  - Card 1 (Clientes em Risco): vermelho se > 5, amarelo se 2-5, verde se < 2
  - Card 2 (Recuperados): verde com badge "Meta: 2"
  - Card 3 (Taxa Sucesso): amarelo se < 60%, verde se >= 70%
  - Card 4 (Revenue em Risco): vermelho se > 50k, amarelo se 20-50k, verde se < 20k

- **LineChart (Recharts):** Taxa sucesso últimos 90d
  - Y-axis: 0-100%
  - X-axis: Dia/Semana/Mês (toggle)
  - Hover: mostra valor + trend

- **BarChart (Recharts):** Motivos top 5
  - Barras horizontais (espaço para labels longos)
  - Cor: laranja para cada barra
  - Click: filtra casos por esse motivo → vai pra T2 (lista)

- **PieChart (Recharts):** Status distribuição
  - 4 cores: azul (ATIVO), cinza (REMARCADO), verde (REATIVADO), vermelho (CANCELADO)
  - Legend abaixo com contagem
  - Click: filtra por status → vai pra T2

- **BarChart Horizontal:** Top 10 clientes em risk
  - X-axis: MRR em reais
  - Y-axis: nome cliente
  - Hover: mostra risk score, motivo

**Filtros (Top Bar):**
- Status select: ATIVO, CANCELADO, REATIVADO
- Risk select: CRITICO, ALTO, MEDIO, BAIXO
- Período select: 7d, 30d, 90d, custom date range
- Apply/Clear buttons
- Refresh spinner

**Responsividade:**
- Desktop: 2x2 grid para KPIs, 2 gráficos por linha
- Tablet (768px): 2x2 KPIs, gráficos em coluna simples
- Mobile: 1 KPI por linha, gráficos full width + scroll horizontal

**States:**
- Loading: skeleton para cada card + gráfico
- Error: alert com "Falha ao carregar dashboard" + Retry button
- Empty: "Nenhum cliente em risco no período" + botão "Criar Caso"

---

### T2. Lista de Casos (Casos em Aberto)

**Localização:** `/casos-churn`  
**Acesso:** CS_RETENCAO, SUPERVISAO_CS, FINANCEIRO, CEO  
**Layout:** Sidebar filters + Main grid/table

```
┌──────────────────────────────────────────────────────────────┐
│ 🏠 Casos de Churn          [+ Novo Caso]  [Exportar] [⋯]    │
├──────────────────────────────────────────────────────────────┤
│ Filtros (sidebar 300px)  │ Resultados                        │
├────────────────────────┬───────────────────────────────────┤
│ FILTROS AVANÇADOS      │                                   │
├────────────────────────┤                                   │
│ Status                 │ Mostrando 12 de 45 casos           │
│ ☑ ATIVO (8)           │                                   │
│ ☐ REMARCADO (2)       │ [Cliente          ▼][Risk    ▼]   │
│ ☐ REATIVADO (2)       │ [MRR      ▼][Dias Aberto ▼]       │
│ ☐ CANCELADO (1)       │                                   │
│ ☐ FECHADO (0)         │ ┌──────────────────────────────┐  │
│                        │ │ Empresa A              [edit]  │  │
├────────────────────────┤ │ Risk: ████████░░ 78 | ALTO  │ │  │
│ Risk Score             │ │ MRR: R$ 45.000 | Dias: 12  │ │  │
│ ● CRITICO (80+) (2)   │ │ Motivo: Preço ◆ Atribuído: CS1 │  │
│ ● ALTO (60-79) (5)    │ │ Próx. ação: 3 dias atrás   │  │  │
│ ● MEDIO (40-59) (4)   │ │ Status: ATIVO → [Remarcar] │  │  │
│ ● BAIXO (0-39) (1)    │ └──────────────────────────────┘  │
│                        │                                   │
├────────────────────────┤ ┌──────────────────────────────┐  │
│ Motivo                 │ │ Empresa B              [edit]  │  │
│ ☑ Insatisfação (3)    │ │ Risk: ████████████░░ 92 |CRÍTICO│  │
│ ☐ Mal uso (2)         │ │ MRR: R$ 28.000 | Dias: 5   │ │  │
│ ☑ Preço (5)           │ │ Motivo: Suporte ◆ Atribuído: CS2 │  │
│ ☐ Concorrência (2)    │ │ Próx. ação: Hoje             │  │  │
│ [mostrar mais...]      │ │ Status: ATIVO → [Urgente!]  │  │  │
│                        │ └──────────────────────────────┘  │  │
├────────────────────────┤                                   │
│ Período                │ ┌──────────────────────────────┐  │
│ ○ Últimos 7d          │ │ Empresa C              [edit]  │  │
│ ○ Últimos 30d (SEL)   │ │ Risk: ████░░░░░░░░░░░░░░░░░░ 32│ │  │
│ ○ Últimos 90d         │ │ MRR: R$ 12.000 | Dias: 25  │ │  │
│ ○ Custom date         │ │ Motivo: Volume ◆ Atribuído: CS3 │  │
│ [datas]               │ │ Status: REMARCADO → 8 dias  │  │  │
│                        │ └──────────────────────────────┘  │  │
├────────────────────────┤                                   │
│ [Clear All]            │ [← 1  2  3  4 →]  50 por página  │
└────────────────────────┴───────────────────────────────────┘
```

**Sidebar Filtros (300px):**
- **Status:** Checkboxes com contagem (ATIVO, REMARCADO, REATIVADO, CANCELADO, FECHADO)
- **Risk Score:** Radio buttons com contagem (CRITICO, ALTO, MEDIO, BAIXO)
- **Motivo:** Checkboxes expansível (mostrar 5 principais, "mostrar mais" para expandir todos 10)
- **Período:** Radio buttons (7d, 30d, 90d, custom date picker)
- **Clear All:** Link para resetar filtros
- **Apply:** Button (só ativa se mudanças)

**Cards/Rows (Grid 1x mostrado, ou table view toggle):**
Cada caso exibe:
- **Cliente name (h4):** Link para detalhe T3
- **Risk score bar:** Visual bar com número + label (CRITICO/ALTO/MEDIO/BAIXO)
- **MRR:** Badge azul com valor em reais
- **Dias aberto:** Texto cinza "Dias: 12" ou "5 dias" ou "1 semana"
- **Motivo:** Pill/badge com texto (Preço, Suporte, etc.)
- **Atribuído para:** Avatar + nome do CS (ou "Sem atribuição" em vermelho)
- **Próxima ação:** Texto descritivo ("Contato pendente", "3 dias atrás", "Hoje")
- **Status + CTA:** Badge de status + botão rápido (Remarcar, Negociar, Cancelar, Reativar)
- **[edit] link:** Abre T3 detalhe

**Ordenação (dropdowns no topo):**
- Ordenar por: Cliente (A-Z), Risk (alto-baixo), MRR (alto-baixo), Dias Aberto (novo-antigo)
- Padrão: Risk DESC, Dias Aberto ASC

**Paginação:**
- Mostrar 50 casos por página
- Links: [← Anterior] [1] [2] [3] [→ Próxima]
- Ao paginir, scroll topo da tabela

**Responsividade:**
- Desktop: Sidebar + grid de 1 coluna (cards fullwidth)
- Tablet (768px): Sidebar 200px + narrower cards
- Mobile (< 480px): Filters como drawer (hamburger), full-width cards em single column

**Estados:**
- Loading: Skeleton cards (3x)
- Empty: "Nenhum caso encontrado com esses filtros" + Clear All button
- Error: Alert + Retry

---

### T3. Detalhe do Caso

**Localização:** `/casos-churn/:id`  
**Acesso:** CS atribuído, supervisor, CEO  
**Layout:** 2 colunas (left sidebar 350px + main content)

```
┌────────────────────────────────────────────────────────────────┐
│ ← [Cliente: Empresa A] [Status: ATIVO] [Risk: 78] [Edit]      │
├─────────────────────────────────┬──────────────────────────────┤
│                                 │ DETALHES RÁPIDOS             │
│ TABS: [Diagnosis] [Plano]       │                              │
│       [Ações] [Timeline]        │ 📊 Risk Score: 78 (ALTO)    │
│                                 │ Motivo: Preço (selecionado) │
│ DIAGNOSIS TAB                   │ Sentimento: Negativo (⚠️)   │
│ ═══════════════════════════════ │ Atribuído: João (CS Lead)   │
│                                 │ Criado em: 12/05/2026       │
│ Motivo: [Preço              ▼]  │                              │
│ Detalhe Motivo:                 │ CLIENTE INFO                │
│ [Cliente reclamou de aumento]    │ ─────────────────────────   │
│ [20% acima da concorrência]     │ Nome: Empresa A             │
│                                 │ MRR: R$ 45.000              │
│ Sentimento:                      │ Contrato: #C-2024-001      │
│ ○ Muito negativo (−−−)          │ Email: contact@emp-a.com.br │
│ ● Negativo (−−)                 │ Telefone: (11) 3000-0000   │
│ ○ Neutro (−)                    │                              │
│ ○ Positivo (+)                  │ PROPOSTAS ABERTAS           │
│                                 │ ─────────────────────────   │
│ Avaliação Suporte (1-5):        │ • Proposta #P-2026-045     │
│ [★★★☆☆]                        │   Desconto 15% | Vence 25d  │
│                                 │ • Proposta #P-2026-046     │
│ Grau Insatisfação (1-10):       │   Upgrade Pro | Vence 10d   │
│ [████████░░] 8                  │                              │
│                                 │ EVENTOS AGENDA              │
│ Chance Recuperação:             │ ─────────────────────────   │
│ ○ Muito baixa (0-20%)           │ 🗓️ Reunião com CEO        │
│ ○ Baixa (20-40%)                │   Dia 22/05 às 14:00      │
│ ● Média (40-60%)                │ 🗓️ Acompanhamento         │
│ ○ Alta (60-80%)                 │   Dia 25/05 às 10:00      │
│ ○ Muito alta (80-100%)          │                              │
│                                 │ ┌────────────────────────┐  │
│ ┌──────────────────────────────┐ │ ⚠️  RECOMENDAÇÃO       │  │
│ │ 🔍 RECOMENDAÇÃO AUTOMÁTICA   │ │                        │  │
│ ├──────────────────────────────┤ │ Risk: 78 (ALTO)      │  │
│ │ Risk: 78 (ALTO)              │ │ Estratégia Proativa: │  │
│ │ Estratégia Proativa          │ │ Reunião + Revisar    │  │
│ │                              │ │ Uso + Oferecer       │  │
│ │ 1️⃣  Reunião com executivo   │ │ Feature              │  │
│ │ 2️⃣  Revisar caso de uso     │ │ Tempo: URGENTE       │  │
│ │ 3️⃣  Oferecer feature custom │ │ (próximo 48h)        │  │
│ │ 4️⃣  Desconto 20% por 90d    │ │                        │  │
│ │                              │ │ [Criar Plano] [Agir] │  │
│ │ Tempo: URGENTE (48h)         │ └────────────────────────┘  │
│ └──────────────────────────────┘                              │
│                                                                │
│ [Salvar Diagnosis]  [Cancelar]                                │
└────────────────────────────────────────────────────────────────┘
```

**Left Sidebar (350px) — Detalhes Rápidos:**
- **Header:** Cliente name + Status badge + Risk score + Edit link
- **Risk Score:** Display numérico + barra colorida (0-100)
- **Motivo + Sentimento:** Pills/badges
- **Atribuído para:** Avatar + nome com link para trocar assignee
- **Data de criação:** Texto cinza
- **Cliente Info section:** Nome, MRR, Contrato #, Email, Telefone (cada com cópia)
- **Propostas Abertas:** Lista com proposta # + desconto/feature + dias até vencer (com código de cor: green < 14d, yellow 14-7d, red < 7d)
- **Eventos Agenda:** Cards compactos com data/hora + título
- **Recomendação automática:** Card com número steps (1-4) + descrição de estratégia + urgência + 2 botões: [Criar Plano], [Agir agora]

**Main Content — Tabs:**

#### Tab 1: Diagnosis
- **Form fields** (com labels ao topo, full-width):
  1. **Motivo** (select): "Selecione o motivo..." → 10 opções com radio group abaixo ou combo
  2. **Detalhe Motivo** (textarea): placeholder "Descreva o problema específico..." (max 1000 chars, counter abaixo)
  3. **Sentimento** (radio group): Muito negativo | Negativo | Neutro | Positivo (com emoji ⚠️/😞/😐/😊)
  4. **Avaliação Suporte (1-5)** (rating): Estrelas clicáveis, label abaixo: "Muito insatisfeito ← Avaliação → Muito satisfeito"
  5. **Grau Insatisfação (1-10)** (slider): Horizontal slider com números, labels: "Leve" | "Extrema"
  6. **Chance Recuperação** (radio group): 5 opções com percentuais: Muito baixa (0-20%), Baixa (20-40%), Média (40-60%), Alta (60-80%), Muito alta (80-100%)

- **Live Calculation Display:** Box acima do botão Save que mostra:
  ```
  Risco Calculado: 78 (ALTO)
  Recomendação: Estratégia Proativa
  Tempo: URGENTE (próximo 48h)
  ```
  Com cor de fundo baseada em risk score (red >= 80, orange 60-79, yellow 40-59, green < 40)

- **Buttons:** [Salvar Diagnosis] [Cancelar] — Salvar ativa save se qualquer campo mudou

**Tab 2: Plano de Retenção**
```
┌────────────────────────────────────────────┐
│ PLANO(S) DE RETENÇÃO                       │
├────────────────────────────────────────────┤
│                                            │
│ ☑ Plano Ativo #1                          │
│ ├─ Estratégia: Desconto de Preço          │
│ ├─ Setores: CS, FINANCEIRO                │
│ ├─ Descrição: 15% desconto por 90 dias    │
│ ├─ Meta Proposta: 25/05/2026 (6 dias)    │
│ ├─ Status: EXECUTANDO → Mudar para: [v]  │
│ └─ Ações: [3] registradas                 │
│                                            │
│ ┌──────────────────────────────────────────┐
│ │ [+ Novo Plano]                           │
│ └──────────────────────────────────────────┘
│                                            │
└────────────────────────────────────────────┘
```
- Mostra planos existentes como cards com status badge
- Card mostra: estratégia, setores envolvidos, descrição curta, data meta (com dias restantes), status + dropdown para trocar status
- Clicar no card → expande para T4 (Plano detalhe)
- Botão "+ Novo Plano" abre modal M2 (Create Plan)

**Tab 3: Ações**
```
┌────────────────────────────────────────────┐
│ TIMELINE DE AÇÕES                          │
├────────────────────────────────────────────┤
│                                            │
│ 20/05 14:30  📞 Contato Telefônico        │
│              Resultado: Positivo ✅        │
│              "Cliente aberto a conversar"  │
│              Próx. passos: Agendar reunião │
│              [edit]                        │
│                                            │
│ 18/05 10:15  📊 Envio de Proposta        │
│              Resultado: Indeterminado ⏳   │
│              "Proposta de desconto 15%"    │
│              Próx. passos: Aguardar retorno│
│              [edit]                        │
│                                            │
│ 15/05 09:00  📧 Escalação                │
│              Resultado: Negativo ❌        │
│              "Cliente não respondeu"       │
│              [edit]                        │
│                                            │
│ [+ Registrar Ação]                        │
│                                            │
└────────────────────────────────────────────┘
```
- Timeline vertical com cards compactos
- Ícone por tipo de ação (telefone, email, documento, pessoas, etc.)
- Data + hora + tipo ação + resultado (com cor)
- Descrição + próximos passos
- Link [edit] abre M3 (Edit Action)
- Botão "+ Registrar Ação" abre M4 (Create Action)
- Ordenação: DESC (ação mais recente no topo)

**Tab 4: Timeline do Lead**
```
┌────────────────────────────────────────────┐
│ TIMELINE CONSOLIDADA                       │
├────────────────────────────────────────────┤
│                                            │
│ 📅 25/05 10:00  Evento: Acompanhamento   │
│    📍 Online - Google Meet                 │
│                                            │
│ 📊 24/05 14:30  Ação: Contato +          │
│    Resultado: Positivo                     │
│                                            │
│ 📑 20/05 09:00  Proposta: #P-2026-045    │
│    R$ 6.750 | Desconto 15%                │
│    Vence em 5 dias                        │
│                                            │
│ 📝 15/05 16:00  Histórico: Caso Aberto   │
│    Motivo: Preço                          │
│                                            │
│ 📧 10/05 11:30  Evento: Reunião Inicial  │
│    📍 Presencial                           │
│                                            │
└────────────────────────────────────────────┘
```
- Merge de: agendaEventos + propostasAbertas + históricoLead
- Ordenação: DESC (mais recente no topo)
- Ícones por tipo (📅 evento, 📊 ação, 📑 proposta, 📝 histórico)
- Cada item clicável leva ao contexto (evento, proposta, etc.)

---

### T4. Plano de Retenção (Detalhe)

**Localização:** `/casos-churn/:id/planos/:planoId` (ou expand inline em T3)  
**Acesso:** CS, Supervisor, CEO

```
┌──────────────────────────────────────────────────────┐
│ ← [Plano: Estratégia Desconto] [Status: EXECUTANDO] │
├──────────────────────────────────────────────────────┤
│                                                      │
│ INFORMAÇÕES DO PLANO                                │
│ ─────────────────────────────────                   │
│                                                      │
│ Estratégia: Desconto de Preço 🎯                    │
│ Descrição:                                           │
│ [15% desconto por 90 dias, com revisão de uso]      │
│ [Cliente demonstrou receptividade em]               │
│ [último contato com executivo]                      │
│                                                      │
│ Setores Envolvidos:                                 │
│ [CS] [FINANCEIRO] [TECH]                            │
│                                                      │
│ Datas:                                              │
│ Lançamento: 18/05/2026                              │
│ Meta Proposta: 25/05/2026 (6 dias restantes)       │
│                                                      │
│ Status: [ATIVO ▼] → [Alterar para...]              │
│ ┌────────────────────────────────┐                  │
│ │ ATIVO                           │                  │
│ │ PAUSADO (com motivo)            │                  │
│ │ EXECUTANDO                      │                  │
│ │ SUCESSO (com novo contrato)     │                  │
│ │ FALHOU (com motivo)             │                  │
│ └────────────────────────────────┘                  │
│                                                      │
│ AÇÕES ASSOCIADAS (5 registradas)                    │
│ ─────────────────────────────────────────────────   │
│                                                      │
│ 20/05 Contato Telefônico | Positivo ✅              │
│ "Explicar desconto, negociar renovação"             │
│                                                      │
│ 18/05 Envio de Proposta | Indeterminado ⏳         │
│ "Desconto formalizado em contrato"                  │
│                                                      │
│ [+ Registrar Ação]                                  │
│                                                      │
│ ═════════════════════════════════════════════════   │
│ [Editar Plano] [Cancelar] [Deletar]                │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Sections:**
1. **Header:** Nome do plano + Status badge
2. **Informações do Plano:** Estratégia, Descrição, Setores, Datas (layout 2 colunas no desktop)
3. **Status Dropdown:** Com transições permitidas baseadas em status atual
4. **Ações Associadas:** Últimas 3 ações com + button para add nova
5. **Bottom Buttons:** Editar, Cancelar, Deletar (com confirmação)

---

### T5. Clientes Churned (Recuperação)

**Localização:** `/clientes-churned`  
**Acesso:** CS_RETENCAO, SUPERVISAO_CS, CEO  
**Layout:** Similar a T2 (Sidebar + Grid)

```
┌──────────────────────────────────────────────────────────────┐
│ 🏠 Clientes Perdidos (Recuperação)   [Exportar]             │
├──────────────────────────────────────────────────────────────┤
│ Filtros              │ Resultados                            │
├──────────────────────┤                                       │
│ Dias desde Churn     │ Mostrando 8 de 32 clientes           │
│ ○ Até 30d (2)      │                                       │
│ ○ 30-90d (5)       │ [Dias desde Churn ▼][MRR ▼]           │
│ ○ 90d-1 ano (8)    │                                       │
│ ● > 1 ano (17)     │ ┌─────────────────────────────────┐   │
│                     │ │ Empresa A                       │   │
├──────────────────────┤ │ Churn: 8 dias atrás             │   │
│ MRR (último)        │ │ MRR: R$ 45.000                  │   │
│ ○ > 100k (0)       │ │ Motivo: Preço                   │   │
│ ○ 50-100k (2)      │ │ Potencial: ALTO                 │   │
│ ○ 10-50k (4)       │ │                                  │   │
│ ● < 10k (2)        │ │ [📞 Reconectar] [Ver Caso]      │   │
│                     │ └─────────────────────────────────┘   │
├──────────────────────┤                                       │
│ [Clear All]         │ ┌─────────────────────────────────┐   │
│                     │ │ Empresa B                       │   │
└──────────────────────┤ │ Churn: 45 dias atrás            │   │
│ MRR: R$ 12.000                  │   │
│ Motivo: Integrações             │   │
│ Potencial: BAIXO                │   │
│                                 │   │
│ [📞 Reconectar] [Ver Caso]      │   │
│ └─────────────────────────────────┘   │
│                                       │
└──────────────────────────────────────┘
```

**Cards exibem:**
- Cliente nome
- Dias desde churn (com ícone de calendário)
- MRR (último)
- Motivo original
- Potencial de recuperação (MUITO_ALTO, ALTO, MEDIO, BAIXO) — baseado em recência e MRR
- 2 botões: [📞 Reconectar] (abre T6 - Reactivation Flow), [Ver Caso] (link a caso original)

**Filtros:**
- Dias desde churn: Radio buttons
- MRR faixa: Radio buttons
- Ordenação: Dias (recente-antigo), MRR (alto-baixo), Potencial (alto-baixo)

---

### T6. Criar Caso (Modal)

**Trigger:** Botão "+ Novo Caso" em T1 ou T2  
**Type:** Full-screen modal (com overlay) ou side drawer

```
┌──────────────────────────────────────────────────┐
│ + Novo Caso de Churn                    [X]     │
├──────────────────────────────────────────────────┤
│                                                  │
│ 1️⃣  SELEÇÃO DO CLIENTE                         │
│ ─────────────────────────                       │
│                                                  │
│ Cliente *                                        │
│ [🔍 Buscar ou digitar...]                       │
│                                                  │
│ Mostrando últimos 5 clientes:                   │
│ • Empresa A (MRR: R$ 45k)                       │
│ • Empresa B (MRR: R$ 28k)                       │
│ • Empresa C (MRR: R$ 12k)                       │
│ [Ver mais...]                                   │
│                                                  │
│ ───────────────────────────────────────────     │
│                                                  │
│ 2️⃣  INFORMAÇÕES DE CHURN                        │
│ ─────────────────────────────                   │
│                                                  │
│ Contrato *                                       │
│ [🔍 Buscar contrato...]                         │
│ (preenchido auto se cliente tem 1 contato)      │
│                                                  │
│ Motivo *                                         │
│ ○ Insatisfação com serviço                      │
│ ○ Mal uso do produto                            │
│ ○ Migração para concorrência                    │
│ ○ Preço (selecionado)                           │
│ ○ [mais...]                                     │
│                                                  │
│ Sentimento *                                     │
│ ⚠️  Muito negativo | 😞 Negativo |              │
│ 😐 Neutro | 😊 Positivo                        │
│                                                  │
│ ───────────────────────────────────────────     │
│                                                  │
│ 3️⃣  ATRIBUIÇÃO                                  │
│ ─────────────────────────────                   │
│                                                  │
│ Atribuído para *                                │
│ [Selecione um CS...]                            │
│                                                  │
│ ┌──────────────────────────────────────────┐    │
│ │ [👤] João Silva (CS Lead)  [email] [tel] │    │
│ │ [👤] Maria Santos (CS)     [email] [tel] │    │
│ │ [👤] Pedro Costa (CS)      [email] [tel] │    │
│ └──────────────────────────────────────────┘    │
│                                                  │
│ ───────────────────────────────────────────     │
│                                                  │
│ Descrição (opcional)                            │
│ [Notas adicionais sobre o caso...]              │
│                                                  │
│                                                  │
│ [Cancelar]  [Criar Caso]                        │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Sections:**
1. **Cliente Select:** Search field com autocomplete + lista últimos 5 ativos + "Ver mais"
2. **Contrato:** Auto-select se 1 contrato, senão dropdown
3. **Motivo:** Radio group com 10 opções
4. **Sentimento:** Radio group com emoji
5. **Atribuído para:** Select com lista de CS disponíveis (avatar + nome + email + tel)
6. **Descrição:** Textarea opcional

**Validações:**
- Campos com * são obrigatórios
- Erro se cliente já tem case ATIVO aberto
- Red border + inline error se campo inválido

**Buttons:**
- [Cancelar]: Fecha modal
- [Criar Caso]: POST /casos-churn → sucesso mostra toast com link "Ver caso", fecha modal

**State:**
- Loading: Spinner no botão
- Error: Red alert box com mensagem

---

### T7. Relatórios (Modal/Drawer)

**Trigger:** Botão "[Exportar]" em T1 ou T2  
**Type:** Side drawer ou modal

```
┌─────────────────────────────────┐
│ 📊 Gerar Relatório   [X]       │
├─────────────────────────────────┤
│                                 │
│ Tipo de Relatório *             │
│                                 │
│ ○ Análise (Resumo Executivo)   │
│ ● Detalhado (Caso por caso)    │
│ ○ Motivos (Análise de razões)  │
│ ○ Estratégias (Efetividade)    │
│                                 │
│ ───────────────────────────────  │
│                                 │
│ Período *                       │
│                                 │
│ De: [📅 15/05/2026] [×]        │
│ Até: [📅 20/05/2026] [×]       │
│                                 │
│ ───────────────────────────────  │
│                                 │
│ Filtros Opcionais               │
│                                 │
│ Supervisor:                     │
│ [Todos ▼] ou selecione...      │
│                                 │
│ Apenas Status:                  │
│ [ATIVO ▼] ou [Todos]           │
│                                 │
│ ───────────────────────────────  │
│                                 │
│ Preview (tipo "Análise"):       │
│ Resumo Executivo                │
│ ├─ Período: 15-20/05/2026      │
│ ├─ Total Casos: 12              │
│ ├─ Clientes Perdidos: 2         │
│ ├─ Recuperados: 1               │
│ ├─ Taxa Sucesso: 72%            │
│ └─ Revenue em Risco: R$ 145k   │
│                                 │
│ [Gerar XLSX]  [Cancelar]        │
│                                 │
└─────────────────────────────────┘
```

**Sections:**
1. **Tipo de Relatório:** 4 opções (radio buttons)
2. **Período:** Date pickers (De / Até) com calendário
3. **Filtros Opcionais:**
   - Supervisor: Dropdown (só se SUPERVISAO/CEO)
   - Status: Dropdown multi-select ou single
4. **Preview:** Mostra estrutura resumida do relatório baseado em tipo selecionado
5. **Botões:** [Gerar XLSX], [Cancelar]

**Estados:**
- Gerando: Spinner, texto "Gerando relatório..." (máx 10s, depois fallback)
- Sucesso: Download automático inicia, toast "Relatório baixado"
- Erro: Alert com mensagem

---

## Modais Críticas

### M1. Transição de Status (ATIVO → ...)

**Trigger:** Botão de status em cards T2 ou detalhe T3

```
┌──────────────────────────────────────────────────┐
│ Atualizar Status do Caso               [X]      │
├──────────────────────────────────────────────────┤
│                                                  │
│ Cliente: Empresa A                               │
│ MRR: R$ 45.000                                   │
│ Dias Aberto: 12                                  │
│ Status Atual: ATIVO                              │
│                                                  │
│ ─────────────────────────────────────────       │
│                                                  │
│ Novo Status *                                    │
│                                                  │
│ ○ REMARCADO                                     │
│   └─ Data/Hora próximo contato *               │
│      [📅 25/05/2026] [🕐 14:00]                │
│                                                  │
│ ○ NEGOCIANDO                                    │
│   └─ Descrição da estratégia *                 │
│      [Descrever ação de negociação...]          │
│                                                  │
│ ○ CANCELADO                                     │
│   └─ Motivo *                                   │
│      [Cliente formalizou saída]                 │
│      [Qual era a razão final?]                  │
│                                                  │
│   Mover para Recuperação Futura?                │
│   ☑ Sim, rastrear para reativação             │
│                                                  │
│ ○ REATIVADO                                     │
│   └─ Novo Contrato *                           │
│      [🔍 Buscar contrato novo...]              │
│                                                  │
│ ─────────────────────────────────────────       │
│                                                  │
│ [Cancelar] [Confirmar Mudança]                  │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Fluxos por Status:**
- **REMARCADO:** Data/hora picker obrigatória, auto-agenda contato
- **NEGOCIANDO:** Textarea obrigatória para descrição de estratégia
- **CANCELADO:** Motivo obrigatório, checkbox para move to recovery tracking
- **REATIVADO:** Novo contrato picker obrigatório

**Validações:**
- Campos específicos do status são obrigatórios
- Data não pode ser no passado
- Red inline errors se inválido

**Confirmação:**
- Botão [Confirmar Mudança] → POST /casos-churn/:id/status
- Sucesso: toast + close modal + atualiza T3
- Erro: red alert + retry option

---

### M2. Criar Plano (POST /planos-retencao)

**Trigger:** "Criar Plano" em recomendação automática ou "+ Novo Plano" em T4

```
┌────────────────────────────────────────────────┐
│ Novo Plano de Retenção              [X]       │
├────────────────────────────────────────────────┤
│                                                │
│ Cliente: Empresa A | Risk: 78                 │
│                                                │
│ ─────────────────────────────────────────     │
│                                                │
│ Estratégia *                                   │
│                                                │
│ ○ Desconto de Preço                          │
│   └─ "Reduzir custo mensal para reativar"    │
│                                                │
│ ● Feature Customizada                        │
│   └─ "Desenvolver funcionalidade solicitada" │
│                                                │
│ ○ Suporte Dedicado                           │
│   └─ "Atribuir CS dedicado por 3 meses"      │
│                                                │
│ ○ Treinamento Intensivo                      │
│   └─ "Workshops de 4 semanas para time"      │
│                                                │
│ ○ [mais estratégias...]                      │
│                                                │
│ ─────────────────────────────────────────     │
│                                                │
│ Descrição Detalhada *                         │
│ [Escrever detalhes da estratégia]            │
│ [Máx 2000 chars, 1234 / 2000]                │
│                                                │
│ ─────────────────────────────────────────     │
│                                                │
│ Setores Envolvidos *                          │
│ ☑ CS_RETENCAO                                │
│ ☑ FINANCEIRO                                 │
│ ☐ TECH                                       │
│ ☐ COMERCIAL                                  │
│ ☐ EXECUTIVO                                  │
│                                                │
│ ─────────────────────────────────────────     │
│                                                │
│ Datas                                         │
│ Lançamento: [📅 20/05/2026] *                │
│ Meta Proposta: [📅 27/05/2026] (opcional)   │
│                                                │
│ ─────────────────────────────────────────     │
│                                                │
│ [Cancelar] [Criar Plano]                      │
│                                                │
└────────────────────────────────────────────────┘
```

**Sections:**
1. **Estratégia:** Radio buttons com 8 opções + descrição de cada
2. **Descrição:** Textarea com counter
3. **Setores Envolvidos:** Checkboxes (múltipla seleção)
4. **Datas:** Data pickers para lançamento (obrigatório) e meta (opcional)

**Validações:**
- Estratégia obrigatória
- Descrição obrigatória + max 2000 chars
- Setores: pelo menos 1 deve estar checked
- Data meta > data lançamento

---

### M3. Registrar Ação (POST /casos-churn/:id/acoes)

**Trigger:** "+ Registrar Ação" em T3 tab Ações ou em M1 confirmação

```
┌────────────────────────────────────────────┐
│ Registrar Ação de Retenção     [X]        │
├────────────────────────────────────────────┤
│                                            │
│ Cliente: Empresa A | Caso aberto há 12d  │
│                                            │
│ ─────────────────────────────────────     │
│                                            │
│ Tipo de Ação *                             │
│                                            │
│ ○ Contato Telefônico                      │
│ ○ Reunião com Executivo                  │
│ ● Envio de Proposta                      │
│ ○ Desconto Oferecido                     │
│ ○ Feature Customizada Desenvolvida       │
│ ○ Treinamento Realizado                  │
│ ○ Revisão de Integração                  │
│ ○ Escalação para Diretoria                │
│                                            │
│ ─────────────────────────────────────     │
│                                            │
│ Descrição *                               │
│ [Descrever o que foi feito...]           │
│ [Máx 1000 chars, 0 / 1000]               │
│                                            │
│ ─────────────────────────────────────     │
│                                            │
│ Resultado *                               │
│ ○ Positivo ✅ (cliente aberto, progresso)│
│ ○ Negativo ❌ (cliente rejeitou)         │
│ ● Indeterminado ⏳ (aguardando resposta) │
│                                            │
│ ─────────────────────────────────────     │
│                                            │
│ Feedback do Cliente (opcional)             │
│ [O que o cliente disse/fez?]              │
│                                            │
│ Data da Ação (default: hoje)               │
│ [📅 20/05/2026]                           │
│                                            │
│ ─────────────────────────────────────     │
│                                            │
│ Próximos Passos (opcional)                │
│ [Qual é a próxima ação planejada?]       │
│                                            │
│ ─────────────────────────────────────     │
│                                            │
│ [Cancelar] [Registrar Ação]               │
│                                            │
└────────────────────────────────────────────┘
```

**Sections:**
1. **Tipo de Ação:** Radio buttons 8 opções
2. **Descrição:** Textarea obrigatória (max 1000)
3. **Resultado:** Radio buttons (Positivo, Negativo, Indeterminado)
4. **Feedback:** Textarea opcional
5. **Data:** Date picker (default hoje)
6. **Próximos Passos:** Textarea opcional

**Validações:**
- Tipo, Descrição, Resultado obrigatórios
- Data não pode ser futuro

---

## Design System & Padrões

**Cores:**
- **Primary:** Azul #0066CC
- **Success:** Verde #10B981
- **Warning:** Amarelo #F59E0B
- **Danger:** Vermelho #EF4444
- **Neutral:** Cinza #6B7280

**Risk Score Colors:**
- CRITICO (80-100): Vermelho #EF4444
- ALTO (60-79): Laranja #F97316
- MEDIO (40-59): Amarelo #EAB308
- BAIXO (0-39): Verde #10B981

**Tipografia:**
- Headings: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto
- Body: mesmo stack
- Tamanhos: H1 (32px), H2 (24px), H3 (18px), Body (16px), Small (14px)

**Componentes Shadcn/ui:**
- Button: [Criar Caso], [Salvar], [Cancelar]
- Input: Text inputs
- Select: Dropdowns
- RadioGroup: Status transitions, sentimento
- Checkbox: Filtros, setores
- DatePicker: Datas
- Textarea: Descrições
- Alert: Erros e avisos
- Badge: Status, sentimento, motivo
- Card: Casos, planos, ações
- Dialog: Modais M1-M3
- Tabs: Diagnosis, Plano, Ações, Timeline
- Tooltip: Hover labels
- Skeleton: Loading states

**Icons:**
- Lucide React para ícones (users, calendar, phone, email, edit, trash, etc.)

**Responsiveness:**
- Mobile-first approach
- Breakpoints: 480px, 768px, 1024px, 1280px
- Touch targets: min 44px × 44px
- Sidebar collapses em mobile, drawer opens
- Stacked layout em mobile

---

## Fluxos de Navegação

### Fluxo 1: Criar Caso → Diagnosis → Plano
```
[T1 Dashboard] 
  ↓ "Criar Caso"
[M1 Create Caso Modal] 
  ↓ "Criar Caso"
[T3 Detalhe] Diagnosis tab
  ↓ "Salvar Diagnosis"
[Recomendação automática]
  ↓ "Criar Plano"
[M2 Create Plano Modal]
  ↓ "Criar Plano"
[T3 Detalhe] Plano tab (novo plano visível)
```

### Fluxo 2: Acompanhamento de Caso
```
[T2 Lista Casos]
  ↓ Clica em caso
[T3 Detalhe]
  ↓ "Registrar Ação"
[M3 Action Modal]
  ↓ "Registrar Ação"
[T3 Ações tab] (nova ação visível)
  ↓ "Alterar Status"
[M1 Status Transition Modal]
  ↓ "Confirmar"
[T3 Header] (status badge atualizado)
```

### Fluxo 3: Recuperação de Cliente
```
[T1 Dashboard] Top 10 clientes em risco
  ↓ Clica cliente
[T3 Detalhe]
  ↓ [Reativar] (M1 REATIVADO option)
[M1] Seleciona novo contrato
  ↓ "Confirmar"
[T3] Status = REATIVADO, timeline atualiza
```

---

## Accessibility & Inclusivity

- **WCAG 2.1 Level AA** compliance target
- Keyboard navigation: Tab, Shift+Tab, Enter, Escape
- Screen reader support: aria-labels, aria-live regions
- Color contrast: 4.5:1 minimum
- Focus indicators: visible blue outline
- Error messages linked to form fields
- Alt text em gráficos (charts describedBy)
- Form labels associated with inputs via `htmlFor`

---

## Performance Targets

- **Dashboard load:** < 1 seg (P95) + skeleton until ready
- **Caso list load:** < 800ms (P95) + skeleton rows
- **Modal open:** < 300ms (transition + animation)
- **Relatório export:** < 10 seg for 5000 records

---

## Sprint 28 — UX PRONTO ✅

Next: Daniel Mendes (Tech Lead) — arquitetura de banco de dados + rotas API
