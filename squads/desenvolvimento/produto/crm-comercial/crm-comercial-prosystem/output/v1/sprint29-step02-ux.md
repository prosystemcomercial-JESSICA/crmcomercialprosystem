# Sprint 29 — Step 02 — Patrícia Moura (UX)
# Pesquisa de Motivos de Churn — Wireframes e Fluxos

## Visão Geral

3 telas principais + 2 modais, foco em mobile-first (survey é respondida via celular/email link).

---

## T1. Página de Survey Pública (Mobile-First)

**URL:** `https://crm.prosystem.com.br/survey/abc123xyz?token=...`  
**Acesso:** Público (sem autenticação)  
**Layout:** Single column, mobile optimized

```
┌─────────────────────────────────────┐
│ ProSystem                           │
│ Sua opinião é importante para nós   │
├─────────────────────────────────────┤
│                                     │
│ Empresa: Empresa A                  │
│ Período contratado: 8 meses         │
│ Valor mensal: R$ 45.000             │
│                                     │
│ Motivo reportado: Preço             │
│ (mas queremos saber mais...)         │
│                                     │
├─────────────────────────────────────┤
│ Estimado 5 minutos para responder   │
│ [━━━━━━░░░░░░░░░░░] 0%             │
├─────────────────────────────────────┤
│                                     │
│ Q1: Qual foi o principal motivo     │
│     para cancelar? *                │
│                                     │
│ [Conte-nos com suas palavras...]    │
│ [Lorem ipsum dolor sit amet...      │
│  oooooooooooooooooooooooooooooo]     │
│                                     │
│ 0 / 500 caracteres                  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │         [Próxima]               │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

### Componentes:

**Header:**
- ProSystem logo
- Tagline: "Sua opinião é importante para nós"
- Descrição cliente (Empresa, período, MRR) em box cinza

**Progress Bar:**
- Mostra número questão (1/5) e barra visual
- Atualiza ao avançar

**Pergunta Q1 (Textarea - Aberta):**
- Label: "Qual foi o principal motivo para cancelar?" com asterisco (obrigatória)
- Textarea com placeholder inspirador
- Min 10 chars, max 500
- Counter: "0 / 500 caracteres"
- Error state: Red border + "Mínimo 10 caracteres" se < 10

**Botões:**
- [Próxima] — ativa apenas se Q1 preenchida (min 10 chars)
- Btn estado inativo: cinza + cursor disabled
- Btn estado ativo: azul + hover escurece

**States:**
- Loading: Spinner no botão [Próxima]
- Error: "Erro ao salvar. Tente novamente" + Retry
- Success (final): "Obrigado! Seu feedback é essencial para melhorar." + botão [Fechar]

### Responsividade:
- Mobile (< 480px): Full width, padding 16px
- Tablet (480-768px): Max-width 600px, centered
- Desktop (> 768px): Max-width 700px, centered, margem superior 40px

---

## T2. Survey — Fluxo Multi-Step (5 Questões)

**Navigation:** Previous/Next buttons, progresso visual, salva automaticamente ao avançar

### Screen 2: Q2 (Textarea Opcional)

```
┌─────────────────────────────────────┐
│ ProSystem                           │
│ [← Voltar] Pergunta 2 de 5          │
│ [━━━━━━━━░░░░░░░░░░░] 40%          │
├─────────────────────────────────────┤
│                                     │
│ O que poderíamos ter feito         │
│ melhor? (opcional)                  │
│                                     │
│ [Sua sugestão aqui...]              │
│ [                                   │
│  ]                                  │
│                                     │
│ 0 / 1000 caracteres                 │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [Voltar] [Próxima]              │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

**Mudanças vs Q1:**
- Label sem asterisco (opcional)
- Max 1000 chars
- Botão [Voltar] aparece (desativado em Q1)
- [Próxima] ativa mesmo sem conteúdo

### Screen 3: Q3 (Slider 1-10)

```
┌─────────────────────────────────────┐
│ ProSystem                           │
│ [← Voltar] Pergunta 3 de 5          │
│ [━━━━━━━━━━░░░░░░░] 60%            │
├─────────────────────────────────────┤
│                                     │
│ Qual é a probabilidade de          │
│ retornar em 12 meses? *            │
│                                     │
│ Improvável ←────●────→ Muito provável │
│       1          5           10      │
│                                     │
│ Score selecionado: 7                │
│ (mostrado em real-time)             │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [Voltar] [Próxima]              │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

**Slider:**
- Range 1-10
- Labels: "Improvável" (esq) e "Muito provável" (dir)
- Display selecionado: "Score selecionado: X" em tempo real
- Cores gradient: vermelho (1-3), amarelo (4-7), verde (8-10)
- Touch-friendly (min 44px height)

### Screen 4: Q4 (Radio Group)

```
┌─────────────────────────────────────┐
│ ProSystem                           │
│ [← Voltar] Pergunta 4 de 5          │
│ [━━━━━━━━━━━━░░░░░░] 80%           │
├─────────────────────────────────────┤
│                                     │
│ Recomendaria ProSystem a            │
│ colegas? *                          │
│                                     │
│ ◉ Sim                               │
│                                     │
│ ○ Não                               │
│                                     │
│ ○ Talvez                            │
│                                     │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [Voltar] [Próxima]              │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

**Radio Group:**
- 3 opções com espaçamento 24px
- Seleção highlighted (background cinza claro)
- [Próxima] ativa apenas após seleção

### Screen 5: Q5 (Star Rating)

```
┌─────────────────────────────────────┐
│ ProSystem                           │
│ [← Voltar] Pergunta 5 de 5          │
│ [━━━━━━━━━━━━━━░░░░] 100%          │
├─────────────────────────────────────┤
│                                     │
│ Qual foi sua experiência            │
│ geral? *                            │
│                                     │
│ ★ ★ ★ ☆ ☆                          │
│                                     │
│ Rating: 3 de 5 (Regular)            │
│                                     │
│ (1=Péssimo ... 5=Excelente)         │
│                                     │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [Voltar] [Enviar Resposta]      │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

**Star Rating:**
- 5 estrelas clicáveis (★ em amarelo ao hover/selecionar)
- Hover mostra label (1=Péssimo, 2=Ruim, etc.)
- Seleção persistente com cor amarela
- Display: "Rating: X de 5 (Péssimo | Ruim | Regular | Bom | Excelente)"
- [Enviar Resposta] apenas ativa após seleção

### Success Screen:

```
┌─────────────────────────────────────┐
│ ProSystem                           │
│                                     │
│          ✓ Obrigado!               │
│                                     │
│ Seu feedback é essencial para       │
│ melhorar nossos serviços.           │
│                                     │
│ Vamos usar suas sugestões para:     │
│ • Melhorar atendimento              │
│ • Desenvolver features solicitadas  │
│ • Reduzir problemas recorrentes     │
│                                     │
│         [Fechar]                    │
│                                     │
└─────────────────────────────────────┘
```

---

## T3. Dashboard de Pesquisa (Admin View)

**Localização:** `/dashboard/pesquisa`  
**Acesso:** CEO, SUPERVISAO_CS, FINANCEIRO  
**Layout:** 2 colunas (sidebar 280px + main)

```
┌──────────────────────────────────────────────────────────┐
│ 📊 Dashboard de Pesquisa          [Período ▼] [Filtros ▼] │
├──────────────────────────────────────────────────────────┤
│ Filtros (sidebar)  │ Resultados                           │
├────────────────────┤                                      │
│ PERÍODO:           │                                      │
│ ○ Últimos 7d      │ KPIs                                 │
│ ○ Últimos 30d     │ ┌─────────────┐ ┌──────────────┐    │
│ ○ Últimos 90d     │ │ Total       │ │ Response     │    │
│ ○ Custom date [..] │ │ Surveys     │ │ Rate         │    │
│                    │ │             │ │              │    │
│ SENTIMENTO:        │ │ 42 surveys  │ │ 58% (24/42)  │    │
│ ☑ Muito Neg (5)   │ │             │ │              │    │
│ ☑ Negativo (8)    │ └─────────────┘ └──────────────┘    │
│ ☑ Neutro (6)      │                                      │
│ ☐ Positivo (0)    │ ┌──────────────┐ ┌──────────────┐   │
│ ☐ M. Positivo (0) │ │ Avg          │ │ Top          │   │
│                    │ │ Sentiment    │ │ Keyword      │   │
│ MOTIVO:            │ │              │ │              │   │
│ ☑ Preço (18)      │ │ -0.42        │ │ "suporte"    │   │
│ ☑ Suporte (12)    │ │              │ │ (12x)        │   │
│ ☑ Integrações (4) │ └──────────────┘ └──────────────┘   │
│ [mostrar mais...]  │                                      │
│                    │ ┌──────────────────────────────┐    │
│ [Clear Filters]    │ │ Taxa Retorno (Q3: 1-10)      │    │
│                    │ │                              │    │
└────────────────────┤ │  ████░░░░░░░░░░░░░░░░░░ 4.2  │    │
                     │ │  (Média: baixa propensão)    │    │
                     │ └──────────────────────────────┘    │
                     │                                      │
                     │ Gráficos                             │
                     │ ┌────────────────────────────────┐   │
                     │ │ Motivo Reportado vs Real       │   │
                     │ │                                │   │
                     │ │  Preço:     ███░░              │   │
                     │ │  Suporte:  ██░░░░              │   │
                     │ │  Integr.:  █░░░░░░              │   │
                     │ │  (Série azul=reportado,        │   │
                     │ │   série laranja=real)          │   │
                     │ └────────────────────────────────┘   │
                     │                                      │
                     │ ┌────────────────────────────────┐   │
                     │ │ Sentimento Distribuição        │   │
                     │ │                                │   │
                     │ │   ◆ M. Neg: 12% (5)           │   │
                     │ │   ◆ Neg:    29% (12)          │   │
                     │ │   ◆ Neutro: 14% (6)           │   │
                     │ │   ◆ Pos:    29% (12)          │   │
                     │ │   ◆ M. Pos: 14% (6)           │   │
                     │ └────────────────────────────────┘   │
                     │                                      │
                     │ [Tabela Surveys / Exportar]         │
                     │                                      │
└──────────────────────────────────────────────────────────┘
```

### Componentes:

**Sidebar Filters:**
- Período: Radio buttons (7d, 30d, 90d, custom date range)
- Sentimento: Checkboxes com contagem
- Motivo: Checkboxes expansível (mostrar 5 principais, "mostrar mais")
- [Clear Filters] link

**KPI Cards (2x2 grid):**
- Total Surveys: count
- Response Rate: percentage
- Avg Sentiment: numeric -1.0 to +1.0 (com cor)
- Top Keyword: keyword + frequency

**Gráficos (Recharts):**

1. **Motivo Reportado vs Real** (BarChart)
   - X-axis: 10 categorias
   - Y-axis: contagem
   - 2 séries: reportado (azul), real (laranja)
   - Destaca discrepâncias

2. **Sentimento Distribuição** (PieChart)
   - 5 cores: vermelho (M.Neg), laranja (Neg), cinza (Neutro), verde (Pos), dark green (M.Pos)
   - Legend com %

3. **Likelihood Retornar Q3** (BarChart)
   - X-axis: 1-10 score
   - Y-axis: contagem
   - Linha média destacada

4. **Top 10 Keywords** (BarChart Horizontal)
   - Palavras-chave mais frequentes
   - Colunas laranja

**Tabela Surveys (abaixo dos gráficos):**
- Columns: Data, Cliente, Motivo Reportado, Motivo Real, Sentimento Q1, Q3 Score, Respondeu?, Tempo Resposta
- Ordenação: Date DESC, Sentiment ASC (customizável)
- Paginação: 25 por página
- Actions: Clique na linha → exibe modal com todas as 5 respostas

---

## T4. Modal — Detalhe Survey (Popup)

**Trigger:** Clique em linha na tabela de Surveys  
**Content:** All 5 respostas + análise

```
┌─────────────────────────────────────────────────────┐
│ Survey: Empresa A           [X]                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Data Resposta: 12/05/2026 14:30                    │
│ Cliente: Empresa A                                  │
│ MRR: R$ 45.000                                      │
│ Período: 8 meses                                    │
│                                                     │
│ ──────────────────────────────────────────────────  │
│                                                     │
│ Q1: Qual foi o principal motivo?                  │
│ "Cliente reclamou aumento 20% acima concorrência" │
│                                                     │
│ Sentimento: NEGATIVO (-0.65)                       │
│ Keywords: ["preço", "aumento", "concorrência"]     │
│ Motivo Real (auto): PRECO [MEDIUM confidence]      │
│                                                     │
│ ──────────────────────────────────────────────────  │
│                                                     │
│ Q2: O que poderíamos ter feito melhor?           │
│ "Melhor benchmark de preço ou add-ons grátis"     │
│                                                     │
│ Sentimento: NEUTRO (0.1)                           │
│ Keywords: ["benchmark", "preço", "features"]       │
│                                                     │
│ ──────────────────────────────────────────────────  │
│                                                     │
│ Q3: Likelihood Retornar? 3/10 (Improvável)        │
│                                                     │
│ Q4: Recomendaria?  Não                             │
│                                                     │
│ Q5: Experiência Geral?  ★★☆☆☆ (2/5 Ruim)         │
│                                                     │
│ ──────────────────────────────────────────────────  │
│                                                     │
│ [Editar Categorização] [Exportar] [Fechar]        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Seções:
- **Header:** Data, Cliente, MRR, Período
- **Q1-Q2:** Resposta + Sentimento (cor coded) + Keywords + Motivo Real Automático
- **Q3-Q5:** Respostas estruturadas
- **Buttons:** Editar (CS corrige categorização), Exportar (copia texto), Fechar

---

## T5. Relatório Exportação (Modal)

**Trigger:** Botão [Exportar] no dashboard  
**Type:** Modal com opções de tipo + formato

```
┌──────────────────────────────────────────────────┐
│ Exportar Relatório                   [X]         │
├──────────────────────────────────────────────────┤
│                                                  │
│ Tipo de Relatório *                             │
│                                                  │
│ ○ Respostas Brutas (todas Q1-Q5)               │
│ ○ Análise Consolidada (KPIs + gráficos)        │
│ ○ Comparação (motivo reportado vs real)        │
│ ● Motivos Insights (recomendações)             │
│                                                  │
│ ──────────────────────────────────────────────  │
│                                                  │
│ Formato *                                       │
│                                                  │
│ ○ XLSX                                          │
│ ○ PDF                                           │
│ ○ JSON                                          │
│                                                  │
│ ──────────────────────────────────────────────  │
│                                                  │
│ Preview (tipo "Análise"):                       │
│                                                  │
│ Aba 1: Resumo                                   │
│  • Total Surveys: 42                            │
│  • Response Rate: 58%                           │
│  • Avg Sentiment: -0.42                         │
│  • Top Keywords: suporte, preço, integrações   │
│                                                  │
│ Aba 2: Matriz Confusão                         │
│  [Preview com grid]                             │
│                                                  │
│ [Gerar Relatório] [Cancelar]                   │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## Design System & Padrões

**Cores:**
- Primary: #0066CC (azul)
- Success: #10B981 (verde)
- Warning: #F59E0B (amarelo)
- Danger: #EF4444 (vermelho)
- Neutral: #6B7280 (cinza)

**Sentimento Colors:**
- Muito Negativo: #DC2626 (red)
- Negativo: #F97316 (orange)
- Neutro: #9CA3AF (gray)
- Positivo: #10B981 (green)
- Muito Positivo: #059669 (dark green)

**Tipografia:**
- Headings: -apple-system, BlinkMacSystemFont, Segoe UI
- Body: mesmo stack
- H1: 32px, H2: 24px, H3: 18px, Body: 16px

**Componentes shadcn/ui:**
- Button, Input, Textarea, Slider, RadioGroup, Checkbox
- Dialog/Modal, Card, Badge, Alert
- Tabs, Tabs, Select, Date Picker

**Icons (Lucide React):**
- Star (rating), Smile (sentiment), AlertCircle (error)
- ChevronRight, Download, X

---

## Fluxos de Navegação

### Fluxo 1: Envio → Resposta → Análise

```
[Email com link survey]
  ↓
[T1-T2-T3-T4-T5: Survey 5 questões]
  ↓
[Success: "Obrigado!"]
  ↓
[T3: Dashboard atualiza com novo survey]
  ↓
[T4 Modal: CS clica na linha nova, vê respostas]
  ↓
[Insights aplicados a próximos casos]
```

### Fluxo 2: Dashboard Insights

```
[T3: Dashboard pesquisa]
  ↓ Filtros/Análise
[Identifica padrão: "Preço real = Suporte"]
  ↓ Clique em survey
[T4 Modal: Verifica detalhes]
  ↓ Exportar
[T5 Relatório: XLSX para board]
```

---

## Accessibility & Inclusivity

- WCAG 2.1 Level AA target
- Color contrast: 4.5:1 minimum
- Keyboard navigation: Tab, Shift+Tab, Enter, Escape
- Form labels linked via `htmlFor`
- Error messages linked to fields via `aria-describedby`
- Star ratings keyboard accessible (arrow keys)
- Alt text em gráficos

---

## Performance Targets

- Survey form load: < 1 seg (single page, lightweight)
- Dashboard load: < 1.5 seg (P95, com gráficos)
- Modal open: < 300ms
- Relatório geração: < 5 seg para 500 surveys

---

## Sprint 29 — UX PRONTO ✅

Next: Daniel Mendes (Tech Lead) — arquitetura, Prisma schema, rotas NLP
