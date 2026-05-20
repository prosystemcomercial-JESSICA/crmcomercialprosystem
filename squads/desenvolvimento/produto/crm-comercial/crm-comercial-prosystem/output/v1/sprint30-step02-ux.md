# Sprint 30 — Step 02 — Patrícia Moura (UX Designer)
# Campanhas de Retenção — Wireframes e Design System

## Design System (Continuidade Sprints 28-29)

### Paleta de Cores (Extensão)
```
Primária: #3b82f6 (Blue) — CTAs principais
Sucesso: #10b981 (Green) — Conversão, ativação
Aviso: #f59e0b (Amber) — Campanhas pausadas, atenção
Perigo: #ef4444 (Red) — Erros, não-conversão
Neutro: #6b7280 (Gray) — Estados desativados
Campanha Ativa: #06b6d4 (Cyan) — Destaque especial
```

### Tipografia
- Headlines: Inter Bold 24-32px
- Subtitles: Inter Medium 16-18px
- Body: Inter Regular 14px
- Monospace (codes): JetBrains Mono 12px

### Componentes Reutilizáveis
- Button: Primary (blue), Secondary (gray), Danger (red)
- Card: shadow-md, rounded-lg, p-6
- Badge: status colors (RASCUNHO, ATIVA, PAUSADA, FINALIZADA)
- Modal: overlay + centered dialog
- Table: striped rows, sticky header
- Chart: Recharts com cores da paleta

---

## Wireframes — 5 Telas Principais

### T1 — Lista de Campanhas (Dashboard Principal)

```
┌─────────────────────────────────────────────────────────────────┐
│ 🏠 CRM Comercial > Campanhas                       [user menu]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Campanhas de Retenção                                            │
│                                                                   │
│  ┌──────────────────────────────┐  ┌─────────────────────┐     │
│  │ [+ Nova Campanha]            │  │ 🔍 Filtrar          │     │
│  └──────────────────────────────┘  │  por Status         │     │
│                                     │  ○ Todas            │     │
│                                     │  ○ Rascunhos        │     │
│                                     │  ○ Ativas           │     │
│                                     │  ○ Pausadas         │     │
│                                     └─────────────────────┘     │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Nome          │ Status  │ Período        │ Enviados │ Tx  │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ Clientes Caros│ ATIVA   │ 20-30 maio     │ 142      │ 67% │  │
│  │ Problema API  │ ATIVA   │ 15-31 maio     │ 89       │ 45% │  │
│  │ Sem suporte   │ PAUSADA │ 10-25 maio     │ 156      │ 32% │  │
│  │ Testando 2.0  │ RASCUNHO│ 25 maio-1 jun  │ -        │ -   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  📊 Desempenho Geral:                                             │
│  • Total Enviado: 387  | Total Convertido: 68 (17.6%)            │
│  • Melhor Campanha: Clientes Caros (67% abertura)                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- Tabela com sorting (clique header)
- Click em linha → abre detalhe (T2)
- Badge cores: ATIVA (cyan), PAUSADA (amber), RASCUNHO (gray), FINALIZADA (gray-disabled)
- Ações linha: [Visualizar] [Pausar/Ativar] [Editar] [Duplicar] [Relatório]
- Paginação: 10/50/100 registros

---

### T2 — Criar/Editar Campanha

```
┌─────────────────────────────────────────────────────────────────┐
│ 🏠 CRM > Campanhas > [Nova]                   [← Voltar]        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ 📋 Informações Básicas                                            │
│ ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  Nome:          [_____________________________________]           │
│  Descrição:     [_____________________________________]           │
│                 [________________________________________]        │
│                 [________________________________________]        │
│                                                                   │
│  Data Início:   [___/___/____]    Data Fim: [___/___/____]      │
│                                                                   │
│  Status:        ○ Rascunho  ○ Ativa  ○ Pausada  ○ Finalizada    │
│                                                                   │
│ ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  [< Anterior]                          [Próximo: Segmentação >] │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Fluxo Multi-Step:**
- Step 1: Informações básicas (Current: T2)
- Step 2: Segmentação de público (T3)
- Step 3: Ações automáticas (T4)
- Step 4: Revisão + Ativar (confirmação)

**Validações Inline:**
- Nome: obrigatório, 3-100 chars
- Datas: data fim > data início
- Status: apenas admin/ceo pode escolher

---

### T3 — Segmentação Dinâmica

```
┌─────────────────────────────────────────────────────────────────┐
│ 🏠 CRM > Campanhas > [Nova] > Segmentação        [← Voltar]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ 🎯 Selecione o Público Alvo                                       │
│ ─────────────────────────────────────────────────────────────── │
│                                                                   │
│ 📊 Filtros:                                                       │
│                                                                   │
│  Risk Score:                                                      │
│  ☐ Baixo (0-50)     ☐ Médio (50-75)     ☐ Alto (75-100)         │
│                                                                   │
│  Motivo de Churn:                                                 │
│  ☑ Preço            ☐ Suporte           ☐ Performance            │
│  ☑ Integração       ☐ Personalização    ☐ Volume                 │
│  ☐ Concorrência     ☐ Mal uso           ☐ Insatisfação          │
│                                                                   │
│  Período Última Interação:                                        │
│  ○ Últimos 7 dias   ○ Últimos 30 dias   ○ Últimos 90 dias        │
│                                                                   │
│  Vendedor:                                                        │
│  ☑ João (3)   ☑ Maria (5)   ☐ Pedro (2)                         │
│                                                                   │
│  Sentimento Detectado:                                            │
│  ☑ Muito Negativo   ☑ Negativo   ○ Neutro                        │
│                                                                   │
│ ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  📈 Preview: 87 clientes candidatos                               │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Cliente           │ Risk │ Motivo        │ Sentimento   │    │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Farmácia Saúde    │ 92   │ Preço         │ Muito Neg.   │    │
│  │ Padaria Doces     │ 78   │ Integração    │ Negativo     │    │
│  │ Loja Geral XYZ    │ 85   │ Preço         │ Muito Neg.   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [ Salvar como Segmento Reutilizável ]                           │
│  [_________ Nome do Segmento _________]                          │
│                                                                   │
│ ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  [< Anterior]                          [Próximo: Ações >]        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- Checkboxes multi-select para cada categoria
- Preview actualiza em real-time (debounced 200ms)
- Clicar em cliente da preview → expande detalhes
- Salvar segmento: ativa modal para dar nome e reutilizar

---

### T4 — Configurar Ações Automáticas

```
┌─────────────────────────────────────────────────────────────────┐
│ 🏠 CRM > Campanhas > [Nova] > Ações Automáticas  [← Voltar]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ⚙️ Ações que Executarão Automaticamente                            │
│ ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  [+ Adicionar Ação]                                               │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ #1 — ENVIAR EMAIL                                 [Editar] │ │
│ │─────────────────────────────────────────────────────────────│ │
│ │ Trigger: IMEDIATO (ao ativar campanha)                      │ │
│ │ Template: "Clientes Caros - Desconto 20%" [Visualizar]     │ │
│ │ Público: 87 clientes do segmento                            │ │
│ │ Status: Criada                                              │ │
│ │ Ação anterior: —                                            │ │
│ │ ⏱️ Atraso: —                                                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ #2 — CRIAR TASK                                   [Editar] │ │
│ │─────────────────────────────────────────────────────────────│ │
│ │ Trigger: HORÁRIO (diariamente às 08:00)                    │ │
│ │ Descrição: "Seguir up clientes Preço"                      │ │
│ │ Atribuir para: Supervisor                                  │ │
│ │ Status: Agendada                                           │ │
│ │ Ação anterior: #1                                           │ │
│ │ ⏱️ Atraso: 24 horas                                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ #3 — APLICAR CRÉDITO                              [Editar] │ │
│ │─────────────────────────────────────────────────────────────│ │
│ │ Trigger: WEBHOOK (quando cliente clica email)              │ │
│ │ Valor: R$ 50 (5%)                                          │ │
│ │ Valididade: 7 dias                                         │ │
│ │ Status: Criada                                             │ │
│ │ ─ [Remover ação]                                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  [< Anterior]                          [Próximo: Revisar >]     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- Arrastar (drag-drop) para reordenar ações
- Editar ação: abre modal com campos específicos do tipo
- Atraso entre ações: input em horas/dias
- Máximo 5 ações: desabilita botão se atingido

---

### T5 — Dashboard de Campanha (Detalhe Ativa)

```
┌─────────────────────────────────────────────────────────────────┐
│ 🏠 CRM > Campanhas > "Clientes Caros"            [← Voltar]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ 📊 Clientes Caros — Campanha Ativa                               │
│ ─────────────────────────────────────────────────────────────── │
│                                                ────────────────── │
│                                                │ [Pausar] [Menu] │
│                                                ──────────────────│
│                                                                   │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│ │   142       │ │    95       │ │    68       │ │    68       ││
│ │ Enviados    │ │ Abertos     │ │ Clicados    │ │Convertidos  ││
│ │ ↑ 12%       │ │ ↑ 8%        │ │ ↓ 2%        │ │ → Novo      ││
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
│                                                                   │
│ 📈 Taxa de Conversão: 67.4%                    [Comparar com ...] │
│                                                                   │
│ ─────────────────────────────────────────────────────────────── │
│                                                                   │
│ 📉 Progresso ao Longo do Tempo:                                   │
│                                                                   │
│  Enviados/Clicados/Convertidos (por dia)                         │
│                                                                   │
│     │     ╱╲                                                      │
│     │    ╱  ╲    ╱╲                                               │
│     │   ╱    ╲__╱  ╲__                                            │
│     │  ╱                                                          │
│   0 └──────────────────────────────────────────────────────────  │
│      20  21  22  23  24  25  26  27  28  29  30 maio             │
│                                                                   │
│ ─────────────────────────────────────────────────────────────── │
│                                                                   │
│ 🎯 Top 5 Motivos (Não-Convertidos):                              │
│    • Preço (34%)  ▓▓▓▓▓▓▓▓░░                                     │
│    • Performance (18%)  ▓▓▓░░░░░░░                               │
│    • Suporte (12%)  ▓▓░░░░░░░░                                   │
│                                                                   │
│ ─────────────────────────────────────────────────────────────── │
│                                                                   │
│ 📋 Ações Executadas:                                              │
│    ✅ 20/05 10:00 — Email enviado para 142 clientes              │
│    ✅ 21/05 08:00 — Task criada para João (Follow-up)            │
│    ⏳ 22/05 10:00 — Email #2 agendado (1 clique já gerado)       │
│                                                                   │
│ [ Visualizar Clientes ] [ Exportar ] [ Finalizando ] [ Duplicar]│
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- KPI cards com trend indicators (↑↓→)
- Click em KPI → drill-down list de clientes
- LineChart animado: hoverable para ver valores
- BarChart horizontal dos motivos (5 principais)
- Timeline de ações: click expande logs detalhados
- Botões ação: Visualizar Clientes, Exportar XLSX, Pausar, Duplicar

---

### T6 — Modais de Configuração

#### Modal A — Criar/Editar Ação
```
┌────────────────────────────────────┐
│ ⚙️  Configurar Ação                │ [×]
├────────────────────────────────────┤
│                                    │
│ Tipo de Trigger: *                │
│ ○ Imediato                         │
│ ○ Horário (cron)                   │
│ ○ Webhook                          │
│                                    │
│ Tipo de Ação: *                    │
│ ○ Enviar Email                     │
│ ○ Enviar SMS                       │
│ ○ Criar Task                       │
│ ○ Aplicar Crédito                  │
│ ○ Webhook                          │
│                                    │
│ [Config específica por tipo]       │
│ Template: [Dropdown com templates] │
│ Valor: [___________]               │
│ Webhook URL: [_________________]   │
│                                    │
│ Atraso até próxima ação:           │
│ [__ dias / __ horas]               │
│                                    │
│ [Cancelar]  [Salvar Ação]         │
└────────────────────────────────────┘
```

#### Modal B — Preview Template
```
┌────────────────────────────────────┐
│ 👁️  Visualizar Template           │ [×]
├────────────────────────────────────┤
│                                    │
│ Template: Clientes Caros - Desc.   │
│                                    │
│ De: suporte@crm.com                │
│ Assunto: Sua oferta especial       │
│                                    │
│ ────────────────────────────────── │
│                                    │
│ Olá João Silva,                    │
│                                    │
│ Notamos que você era nosso cliente.│
│ Você relatou problemas com preço.  │
│                                    │
│ Por isso, estamos oferecendo:      │
│ • 20% de desconto por 3 meses      │
│ • 1h de consultoria gratuita       │
│                                    │
│ [Retomar negociação]               │
│                                    │
│ Abç.                               │
│ ────────────────────────────────── │
│                                    │
│ Variáveis detectadas:              │
│ ✓ {cliente_nome}                   │
│ ✓ {motivo_churn}                   │
│ ✓ {oferta}                         │
│                                    │
│ [Fechar]                           │
└────────────────────────────────────┘
```

#### Modal C — Exportar Relatório
```
┌────────────────────────────────────┐
│ 📊 Exportar Relatório              │ [×]
├────────────────────────────────────┤
│                                    │
│ Formato:                           │
│ ○ XLSX (Excel)                     │
│ ○ PDF                              │
│ ○ JSON                             │
│                                    │
│ Período:                           │
│ ○ Últimos 7 dias                   │
│ ○ Últimos 30 dias                  │
│ ○ Período completo da campanha     │
│ ○ Custom: [data] até [data]        │
│                                    │
│ Incluir:                           │
│ ☑ KPIs resumo                      │
│ ☑ Lista clientes convertidos       │
│ ☑ Lista clientes não-convertidos   │
│ ☑ Análise por motivo               │
│ ☑ Recomendações                    │
│                                    │
│ [Cancelar]  [Gerar & Baixar]      │
└────────────────────────────────────┘
```

---

## Padrões de Interação

### Estados de Campanha (Visual)
- **RASCUNHO:** Gray badge, "Editar" enabled, "Ativar" button visible
- **ATIVA:** Cyan badge, "Pausar" button, dashboard com dados live
- **PAUSADA:** Amber badge, "Resumir" button, dashboard read-only
- **FINALIZADA:** Gray badge, read-only, relatório disponível

### Transições Permitidas
```
RASCUNHO → ATIVA (supervisor + CEO)
ATIVA → PAUSADA (supervisor + CEO)
PAUSADA → ATIVA (CEO apenas)
ATIVA/PAUSADA → FINALIZADA (CEO)
QUALQUER → ARQUIVADA (CEO)
```

### Loading States
- Segmentação: skeleton loaders para preview table
- Dashboard: pulse animation em KPI cards enquanto carrega
- Exportação: progress bar com "Gerando relatório..."

---

## Componentes Necessários (Frontend)

1. **CampanhaListPage** — T1
2. **CampanhaFormModal** — T2 (multi-step)
3. **SegmentacaoStep** — T3
4. **AcoesStep** — T4
5. **DashboardCampanha** — T5
6. **TemplateModal** — Modal A
7. **PreviewModal** — Modal B
8. **ExportModal** — Modal C
9. **CampanhaCard** — Component tabela
10. **AcaoCard** — Component ação arrastável

---

## Fluxos de Usuário

### Fluxo 1: Criar Campanha Nova
1. Lista → Botão "+ Nova Campanha"
2. Modal (Step 1): Preencher nome, datas, descrição
3. Step 2: Filtros de segmentação + preview
4. Step 3: Configurar ações + sequência
5. Step 4: Revisão de tudo
6. Ativar → Mudar para ATIVA, executar ações IMEDIATO

### Fluxo 2: Visualizar Campanha Ativa
1. Lista → Click em linha
2. Dashboard com KPIs live + charts + timeline
3. Botões: Pausar, Duplicar, Exportar
4. Drill-down: click KPI → lista clientes

### Fluxo 3: Criar Template Reutilizável
1. Ao configuraração de ação (tipo ENVIAR_EMAIL)
2. Opção: "Criar novo template"
3. Modal: nome, assunto, corpo HTML
4. Preview com cliente de exemplo
5. Salvar → disponível em próximas ações

---

## Responsive Design

- **Desktop:** Layout full width com sidebars
- **Tablet:** Stack vertical, modals 90% viewport
- **Mobile:** Single column, buttons full-width

---

## Sprint 30 Step 02 — UX PRONTO ✅

**Entregáveis:**
- 5 wireframes principais (T1-T5)
- 3 modais (template, preview, export)
- Design system + paleta
- Fluxos de usuário documentados
- Estados visuais + transições

**Próximo:** Daniel Mendes (Tech Lead) — Arquitetura, Prisma schema, 10+ routes
