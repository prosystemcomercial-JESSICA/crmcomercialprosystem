---
name: CRM Comercial ProSystem
description: Sistema de gestão comercial e retenção — Fastify + Prisma no backend, Next.js + shadcn/Tailwind no frontend
colors:
  primary: "#4B8EC8"
  primary-dark: "#2E6EAB"
  primary-deep: "#1A4E82"
  primary-light: "#EBF4FF"
  primary-border: "#C3DCFC"
  primary-muted: "#7AAACB"
  brand-navy: "#0D2238"
  brand-navy-hover: "#152E49"
  brand-navy-active: "#1C3A5A"
  sidebar-grad-top: "#4B8EC8"
  sidebar-grad-mid: "#2E6EAB"
  sidebar-grad-low: "#1A4E82"
  sidebar-grad-base: "#0D2C52"
  sidebar-text: "#EAF2FB"
  sidebar-muted: "#B6D2EF"
  topbar-bg: "#FFFFFF"
  content-bg: "#F4F7FB"
  card-bg: "#FFFFFF"
  card-border: "#D8E8F5"
  text-primary: "#0D2238"
  text-secondary: "#4A6E8A"
  text-muted: "#7AAACB"
  text-inverse: "#FFFFFF"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "calc(0.5rem * 0.6)"
  md: "calc(0.5rem * 0.8)"
  lg: "0.5rem"
  xl: "calc(0.5rem * 1.4)"
  card: "1rem"
spacing:
  base-unit: "4px"
components:
  card:
    backgroundColor: "{colors.card-bg}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    padding: "24px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
---

# Design System: CRM Comercial ProSystem

## Overview

**Creative North Star: "O Painel de Controle da Concessionária"**

O CRM ProSystem é uma ferramenta operacional de uso diário e intenso — não uma vitrine, um painel de comando. A metáfora certa não é "editorial" ou "app consumidor", é o painel de controle de uma operação que roda o dia inteiro: números precisam saltar aos olhos, estados de risco (churn, atraso, lead parado) precisam ser inconfundíveis, e nada compete por atenção sem motivo. O azul institucional profundo (`#0D2238` → `#4B8EC8`) já existe como identidade corporativa consolidada e nunca é substituído — o trabalho de polimento acontece inteiramente dentro dela.

O sistema já tem uma base de tokens madura e não-trivial: 3 temas de cor comutáveis (Azul/Laranja/Verde) × modo claro/escuro, cada um com a mesma estrutura semântica de tokens (`--t-primary`, `--t-sidebar-bg`, `--t-card-bg`, etc). Isso significa que qualquer refinamento visual deve editar os *tokens*, nunca hardcodar uma cor nova direto num componente — um hex solto quebra os outros 5 temas silenciosamente.

**Key Characteristics:**
- Densidade alta, mas organizada — muitos números por tela, hierarquia clara decide o que o olho vê primeiro.
- Cartões elevados sutilmente (sombra dupla-camada), nunca planos-demais nem flutuando exageradamente.
- Gradiente diagonal como assinatura de interatividade (sidebar, botão primário) — nunca gradiente decorativo sem função.
- Cor de risco/urgência (vermelho/âmbar) é reservada estritamente para estado, nunca decorativa — ver Colors.

## Colors

Paleta de marca fechada por design (`--ps-50` a `--ps-950`, mesma escala que alimenta os 3 temas), com o azul institucional como identidade fixa e imutável da Prosystem.

### Primary
- **Azul ProSystem** (`#4B8EC8` / `--t-primary`): accent interativo padrão — links, ícones ativos, barra de progresso, indicador selecionado. Em gradiente diagonal (`135deg`, `#4B8EC8` → `#2E6EAB`) em botões primários e sidebar.
- **Azul Profundo / Navy** (`#0D2238` / `--ps-navy`): cor de marca mais escura — telas de login, header institucional, texto de maior peso. É a cor "ProSystem" propriamente dita, mais do que o azul médio.

### Neutral
- **Fundo de conteúdo** (`#F4F7FB` / `--t-content-bg`): fundo de página, levemente azulado, nunca branco puro — mantém o conteúdo levemente "dentro" da identidade da marca mesmo fora dos cards.
- **Cartão** (`#FFFFFF` / `--t-card-bg`): fundo de card sempre branco puro, para contraste com o fundo azulado.
- **Borda de cartão** (`#D8E8F5` / `--t-card-border`): azul muito claro, nunca cinza neutro — mesmo as bordas carregam a identidade.
- **Texto primário** (`#0D2238` / `--t-text-primary`): mesmo tom do navy de marca — o texto "pertence" à mesma família cromática do resto.
- **Texto secundário** (`#4A6E8A`), **texto discreto** (`#7AAACB`).

### Named Rules

**The No Loose Hex Rule.** Todo componente novo ou refinado usa `var(--t-*)`, nunca um hex literal. Um hex hardcoded funciona no tema Azul e quebra silenciosamente nos temas Laranja/Verde e no modo escuro — é o erro mais caro que este sistema pode cometer, porque não aparece nos testes a menos que alguém troque de tema manualmente.

**The Status Color Reserve Rule.** Vermelho/âmbar/verde-semântico (diferente do verde-tema) são reservados exclusivamente para estado real: atraso financeiro, risco de churn, sucesso de ação. Nunca usados decorativamente — um card verde sem significado de "sucesso"/"ativo" por trás é ruído, não hierarquia.

## Typography

**Body & Display Font:** Inter (`next/font/google`, pesos 400/500/600/700/800), com fallback `system-ui, sans-serif`.

**Character:** Uma única família fazendo todo o trabalho — de números grandes de KPI (peso 800) a texto corrido (peso 400). A hierarquia vem inteiramente de peso e tamanho, não de troca de família — apropriado para um painel operacional que precisa ser rápido de escanear, não de uma leitura contemplativa.

### Hierarchy
- **Display/KPI** (800, `2rem`, line-height 1, letter-spacing `-0.02em`): números grandes de indicador (`.ps-kpi-number`) — o primeiro elemento que o olho deve encontrar em qualquer card de métrica.
- **Título de seção** (700, `1.125–1.25rem`): cabeçalhos de bloco/card.
- **Body** (400–500, `0.875rem`, line-height 1.5): texto corrido, labels de formulário, conteúdo de tabela.
- **Label/Caption** (500–600, `0.6875–0.75rem`, uppercase, letter-spacing levemente aberto): rótulos de coluna, eyebrows de seção, badges de status.

### Named Rules

**The One Family Rule.** Inter em todo lugar. Não introduzir uma segunda família (serifada, monoespaçada para além de `--font-geist-mono` já reservado a contextos técnicos pontuais) sem motivo funcional forte — a consistência tipográfica é o que faz ~40 telas construídas ao longo do tempo parecerem um produto único.

## Layout

Layout de aplicação clássico: sidebar fixa à esquerda (colapsável em mobile) + topbar + área de conteúdo rolável. `--t-content-bg` cobre toda a área de conteúdo; cards individuais flutuam sobre ele com a sombra dupla-camada descrita em Elevation.

Densidade alta é aceita e esperada — múltiplos KPIs por linha, tabelas densas — mas sempre com `gap`/padding consistente entre irmãos (nunca margin ad-hoc empilhada), e cada agrupamento de dados vive dentro de um `.ps-card` com respiro interno de `24px`.

Responsivo: sidebar colapsa para overlay em telas estreitas (classe `-translate-x-full md:translate-x-0` já em uso no `DashboardLayout`); grids de KPI empilham em coluna única abaixo do breakpoint `md`.

## Elevation & Depth

Sistema de sombra em duas camadas, nunca uma sombra única genérica: uma sombra "de contato" rasa e nítida (`0 1px 2px`) somada a uma sombra "ambiente" mais larga e suave (`0 4px 16px`, com a cor da sombra derivada do token `--t-card-shadow` via `color-mix`). Em hover, a segunda camada ganha profundidade E tingimento da cor primária (`color-mix(in srgb, var(--t-primary) 12%, transparent)`) — o card "acorda" na cor da marca ao ser tocado, não só fica mais escuro.

### Shadow Vocabulary
- **Repouso** (`0 1px 2px var(--t-card-shadow), 0 4px 16px color-mix(in srgb, var(--t-card-shadow) 60%, transparent)`): estado padrão de qualquer `.ps-card`.
- **Hover** (`0 2px 4px var(--t-card-shadow), 0 8px 28px color-mix(in srgb, var(--t-primary) 12%, transparent)`): cartões interativos/clicáveis ao passar o mouse.
- **Botão primário hover** (`0 4px 12px color-mix(in srgb, var(--t-primary) 35%, transparent)` + `translateY(-1px)`): elevação mais forte, tingimento mais saturado — reforça que é uma ação, não só um card informativo.

### Named Rules

**The Two-Layer Shadow Rule.** Toda sombra de elevação neste sistema é composta (contato + ambiente), nunca uma `box-shadow` única. Uma sombra de camada só lê como "achatada" ao lado dos cards existentes.

## Shapes

Radius em escala proporcional a partir de uma base `0.5rem` (`--radius`): `sm` (×0.6), `md` (×0.8), `lg` (base), `xl` (×1.4), até `4xl` (×2.6) para elementos hero/destacados. Cards usam um radius maior e fixo (`1rem`), deliberadamente fora da escala proporcional — cards são a unidade visual "âncora" do sistema e merecem cantos mais arredondados que controles internos (botões, inputs, badges).

Bordas finas (`1px solid var(--t-card-border)`) em cards, nunca border grosso ou ausência total de borda — a borda + sombra dupla juntas é o que separa um card do fundo azulado, já que ambos são claros.

## Components

### Buttons
- **Shape:** radius `lg` (`0.5rem`).
- **Primary (`.ps-btn-primary`):** gradiente diagonal `135deg` de `var(--t-primary)` para `var(--t-primary-dark)`, texto branco.
- **Hover:** gradiente desloca um degrau mais escuro (`--t-primary-dark` → `--t-primary-deep`), ganha sombra tingida de accent, e sobe 1px (`translateY(-1px)`). Transição `0.15s ease` em tudo — rápida, sem lag perceptível.

### Cards / Containers (`.ps-card`)
- **Corner Style:** `1rem` (maior que a escala de radius padrão — ver Shapes).
- **Background:** `var(--t-card-bg)`, sempre branco puro.
- **Shadow Strategy:** ver Elevation & Depth — dupla camada, tingida de accent no hover.
- **Border:** `1px solid var(--t-card-border)`.
- **Internal Padding:** `24px` como padrão observado.

### KPI Number (`.ps-kpi-number`)
Componente de assinatura do sistema — o número grande que abre praticamente todo card de indicador (Relatório Comercial, Painel do CEO, Meu Desempenho do SDR). Peso 800, `2rem`, cor `var(--t-primary-dark)` (não o primary padrão — um tom levemente mais escuro/sério para o número "que importa"), letter-spacing `-0.02em` (levemente condensado, comum em números grandes para parecerem mais sólidos).

### Sidebar
Gradiente vertical de 4 paradas (`--t-sidebar-grad-1` a `-4`, claro no topo → navy profundo na base), diferente do gradiente diagonal de 2 cores dos botões — a sidebar é a única superfície com gradiente de 4 estágios, reforçando que é a "coluna vertebral" estrutural do produto, não um elemento de ação.

### Navigation (itens de menu)
Estado ativo com fundo semi-transparente branco (`rgba(255,255,255,0.22)`) e borda de destaque (`--t-sidebar-active-border`); hover mais sutil (`rgba(255,255,255,0.13)`). Texto de menu em `--t-sidebar-text` (quase-branco, não branco puro — mantém suavidade sobre o fundo escuro).

## Do's and Don'ts

### Do:
- **Do** usar sempre `var(--t-*)` para qualquer cor de UI — nunca um hex literal em um componente novo (The No Loose Hex Rule).
- **Do** aplicar a sombra dupla-camada (`.ps-card` como referência) em qualquer novo container elevado, em vez de uma `box-shadow` única.
- **Do** reservar vermelho/âmbar para estado real (atraso, risco, erro) — nunca decorativo (The Status Color Reserve Rule).
- **Do** manter Inter como única família tipográfica; variar peso/tamanho para hierarquia, não a fonte.
- **Do** testar qualquer novo componente visual nos 3 temas (Azul/Laranja/Verde) antes de considerar pronto — o sistema já paga o custo de manter isso, um componente que só funciona no tema Azul é uma regressão silenciosa.

### Don't:
- **Don't** introduzir uma paleta de cor nova ou substituir o azul institucional — é compromisso de marca fixo (ver PRODUCT.md → Brand Commitments).
- **Don't** usar gradiente decorativo sem função — gradiente aqui sinaliza "isto é interativo/estrutural" (botão, sidebar), não decoração.
- **Don't** empilhar `margin` ad-hoc entre elementos irmãos quando `gap` em flex/grid resolve — o projeto já tem esse padrão estabelecido em componentes recentes.
- **Don't** adicionar uma segunda família tipográfica sem necessidade funcional clara.
- **Don't** confundir o radius de card (`1rem`, fixo) com a escala de radius de controles (`sm`/`md`/`lg`/`xl`) — são propositalmente diferentes.
