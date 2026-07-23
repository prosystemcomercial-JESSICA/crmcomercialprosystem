# Redesign visual do Dashboard Executivo

## Contexto

O Dashboard Executivo (`frontend/app/dashboard/page.tsx`, 853 linhas) é a tela inicial de gestores/CEO no CRM. Já tem uma base sólida de interação (contadores animados via `AnimatedNumber`, pulse dots em indicadores ao vivo, fade-in escalonado por seção, skeleton de loading), mas nenhuma visualização gráfica de verdade — "gráficos" são hoje barras de progresso simples em CSS (`width: %` com `transition`). O projeto já tem `recharts@^3.8.1` instalado e em uso no Relatório Comercial (`frontend/app/relatorio-comercial/page.tsx`), então não é necessário adicionar dependência nova.

O pedido do usuário: tirar a "cara de IA genérica" do dashboard, torná-lo mais leve/tecnológico, com gráficos de verdade, mais movimento e interatividade — sem perder a identidade visual azul da Prosystem (`#417ABC` / `#2E6EAB`) nem os dados/fluxos existentes.

Dois repositórios de referência de design foram clonados localmente em `.refs/` (`nextlevelbuilder/ui-ux-pro-max-skill` e `anthropics/skills`), ignorados pelo git — servem de inspiração de padrões, não são dependência do código.

## Escopo

Redesign completo do dashboard em `frontend/app/dashboard/page.tsx`, mantendo a mesma fonte de dados (`GET /dashboard/power`, tipo `DashboardPower` já definido no arquivo) e adicionando uma nova chamada à rota já existente `GET /relatorio-comercial/serie-anual` para alimentar o gráfico de tendência de MRR.

Fora de escopo: mudar o backend (`dashboard-power.ts`), mudar outras telas do CRM, adicionar bibliotecas novas.

## Design

### 1. Estrutura da página (nova ordem/composição)

1. Header — inalterado (título, seletor de vendedor, botão atualizar).
2. Alert Strip — inalterado.
3. **Novo: Hero de MRR** — card em destaque (2/3 largura em desktop) com valor animado, delta %, e `AreaChart` de tendência (últimos 12 meses, dado do saldo mensal de MRR). Ao lado (1/3), card compacto de "Contratos Ativos".
4. KPIs Comercial (5 cards) — mesmo conteúdo, refino de hover.
5. Pipeline de Propostas — mesmos 4 KPIs; a "barra de proporção" quente/morno/frio vira `RadialBarChart`.
6. **Novo: Funil de pipeline visual** (`FunnelChart`) substituindo as barras horizontais por etapa, ao lado do Top 5 Leads (inalterado, só refino de hover).
7. Análise de Perdas — mesmos 2 KPIs; lista de motivos vira donut (`PieChart` com `innerRadius`) com legenda lateral interativa.
8. Atividades em Aberto — inalterado (lista funcional, não precisa virar gráfico).
9. Financeiro, Contratos & Base — permanece colapsável, mas **sem** o card de MRR (que subiu pro topo); mantém Contratos Ativos, NPS, Tickets, saúde de clientes.

### 2. Componentes novos

- **`MrrTrendCard`**: busca `apiClient.getRelatorioSerieAnual(anoAtual)`, calcula saldo acumulado de MRR mês a mês a partir de `saldo_mrr`, renderiza `AreaChart` do Recharts com gradiente de preenchimento na cor de acento (`#16a34a`), ponto final destacado, eixo X com labels de mês abreviado, sem eixo Y visível (estilo sparkline ampliado). Fallback: se a série vier vazia ou toda zero, mostra o card de MRR sem o gráfico (apenas número + delta), sem quebrar o layout.
- **`PipelineFunnelChart`**: `FunnelChart` do Recharts (`recharts` já suporta `Funnel`/`FunnelChart` desde v2). Cada etapa com cor da paleta já usada (`#4B8EC8, #2E6EAB, #1A4E82, #6366F1, #8B5CF6, #7C3AED`), tooltip customizado mostrando etapa, contagem, valor, e taxa de conversão em relação à etapa anterior.
- **`TemperaturaGauge`**: `RadialBarChart` com 3 barras empilhadas (quente/morno/frio) substituindo a barra de proporção linear atual.
- **`MotivosPerdaDonut`**: `PieChart` com `innerRadius` (donut), uma fatia por motivo, cores em gradação de vermelho (mesmo padrão já usado: `#dc2626, #ef4444, #f87171...`), legenda lateral com hover destacando a fatia correspondente (`onMouseEnter` no item de legenda seta `activeIndex`).
- **`ChartTooltip`**: componente de tooltip customizado reaproveitado pelos 4 gráficos acima — mesmo estilo visual dos cards (`ps-card`, borda, sombra), evita o tooltip padrão feio do Recharts.

### 3. Animação e interação

- Todos os gráficos novos usam `isAnimationActive`, `animationDuration` entre 800-1000ms, `animationEasing="ease-out"`; séries/fatias com delay escalonado (`animationBegin={i * 80}`).
- Cards com hover: `transform: translateY(-2px)` + sombra mais forte, transição 150-200ms — mesmo padrão que already existe em outros pontos do arquivo (`hover:scale-[1.02]` na seção de saúde).
- Ao trocar filtro de vendedor, os dados recarregam (`loadData()` já existe) e os gráficos re-renderizam com a mesma animação de entrada — comportamento natural do Recharts ao trocar `data`, sem lógica extra necessária.
- Paleta mantida: verde `#16a34a`, vermelho `#dc2626`, âmbar `#d97706`, azul primário `#4B8EC8`/`#2E6EAB`, roxos neutros `#6366F1`/`#7c3aed`/`#8B5CF6` — já em uso consistente no arquivo, não muda.

### 4. Dados

- `MrrTrendCard` chama `apiClient.getRelatorioSerieAnual(new Date().getFullYear())`, que já existe (`frontend/lib/api-client.ts:1239`, rota backend `GET /relatorio-comercial/serie-anual`). Retorna `{ mes, saldo_mrr, ... }[]` — usado para desenhar a tendência.
- Demais componentes consomem os campos já existentes em `DashboardPower` (`pipeline_funil`, `ranking_motivos_perda`, `pipeline_propostas`) — nenhuma mudança de contrato de API além da chamada nova de série anual.

## Testes

- Testar com dashboard vazio (sem MRR, sem funil, sem motivos de perda) — cada gráfico novo precisa de estado vazio tratado (mensagem "sem dados" em vez de gráfico quebrado ou vazio confuso), seguindo o padrão já usado (`data.pipeline_funil.every(p => p.count === 0)`).
- Testar troca de filtro de vendedor — gráficos devem atualizar corretamente sem erro de key duplicada/dado obsoleto.
- Testar em tema claro e escuro (o projeto já usa variáveis CSS `var(--t-*)` para temas — os componentes novos devem usar essas mesmas variáveis, não cores hardcoded para texto/fundo, só para os acentos de dado).
- Conferir visualmente no navegador (rodar `npm run dev` do frontend) antes de considerar concluído — mudança é primariamente visual, não dá para validar só por type-check.
