---
target: Relatório Comercial (frontend/app/relatorio-comercial/page.tsx)
total_score: 15
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-17T23-16-53Z
slug: frontend-app-relatorio-comercial-page-tsx
---
Method: dual-agent, degraded browser evidence (A: source-only, no agent-browser in this environment · B: detector confirmed unreachable-authenticated — live URL Puppeteer session rendered the login page instead of the report, since no auth cookie was injected; static-file scan and login-page-comparison evidence still gathered and used below)

## Design Health Score

| # | Heurística | Nota | Problema-chave |
|---|---|---|---|
| 1 | Visibilidade de status | 2/4 | Loading só cobre o fetch principal; seções secundárias (série, sensor, SDRs) aparecem tarde sem skeleton, causando layout shift |
| 2 | Sistema vs. mundo real | 3/4 | Terminologia bate com o glossário do PRODUCT.md (MRR, Fechamentos) |
| 3 | Controle e liberdade | 1/4 | Nenhum drill-in de KPI/gráfico para o registro subjacente; tudo é leitura estática |
| 4 | Consistência | 0/4 | Quebra ativamente o próprio design system do produto (zero uso de `var(--t-*)`) |
| 5 | Prevenção de erro | 2/4 | try/catch existe, mas erro vira só `console.error` — falha de rede e "sem dados" renderizam igual |
| 6 | Reconhecimento vs. memorização | 2/4 | Duas numerações de seção colidindo no mesmo documento |
| 7 | Flexibilidade e eficiência | 1/4 | Só dropdown de mês/ano + impressão do navegador; sem exportar CSV, sem comparação de período, sem filtro |
| 8 | Estética minimalista | 1/4 | 10+ seções sempre expandidas, cores saturadas competindo, emoji como ícone principal |
| 9 | Recuperação de erro | 1/4 | Nenhum estado de erro distinto de "sem dados" |
| 10 | Ajuda/documentação | 2/4 | Algumas notas explicativas boas, mas aplicadas de forma inconsistente |

**Total: 15/40 → 37,5% → Fraco** (heurística 7 plenamente aplicável — é superfície "Operate" segundo a própria taxonomia do DESIGN.md)

## Veredito de especificidade

**Avaliação LLM**: Esta tela falha o teste de especificidade da forma mais básica — **não usa o próprio design system do produto**. O arquivo recria um "mini design system" paralelo no cabeçalho (`PRO`, `PRO_DARK`, `INK` como hex cru) e hardcoda mais ~40 valores hex e classes Tailwind de cor ao longo do arquivo, sem nenhuma referência a `var(--t-*)`. Não é uma violação pontual — é um bypass completo do sistema de temas na tela de maior tráfego do produto. O resultado lê como um template genérico de "relatório executivo" (gradiente de capa, KPI tiles, donut charts, caixas coloridas de entrada/saída) que poderia pertencer a qualquer SaaS B2B — não a um CRM construído com vocabulário de componente próprio já definido e usado no resto do app.

**Scan determinístico**: `detect.mjs` contra o arquivo estático achou 1 achado (`border-accent-on-rounded`, linha 90) — confirmado falso-positivo pela Assessment B (é o mecanismo do spinner de loading, não um defeito real). A tentativa contra a URL ao vivo não autenticou — o Puppeteer do detector renderizou a tela de login, não o relatório real (confirmado pela assinatura de classe idêntica ao painel de marca do login já visto no ciclo anterior). Nenhuma contradição entre os dois assessments — cobrem evidências diferentes e complementares.

## Impressão geral

O bloco de capa (gradiente navy-azul, KPI strip) abre com peso executivo genuíno e é o único momento em que a página cumpre sua ambição de "visão executiva para a diretoria". Essa confiança desmorona quase imediatamente: da seção 2 em diante a página vira caixas coloridas saturadas, marcadores de emoji, e classes de cor Tailwind soltas — mais MVP de hackathon que relatório mensal de diretoria. É a primeira tela que todo CEO vê, todo login, e o registro emocional deriva de "sala de reunião" para "protótipo" já na primeira rolagem.

## Pontos fortes

1. **Bloco de capa (gradiente navy-azul + KPI strip translúcido)** — o único lugar do arquivo onde hierarquia, contenção e tom de marca se alinham; parece de fato a capa de um relatório executivo real.
2. **Folha de estilo de impressão** (`break-inside: avoid` por bloco, esconde navegação, cores exatas) — pensamento de produto real: alguém já previu que CEOs imprimem/exportam isso pra reunião de diretoria.
3. **Disciplina de proveniência de dado** — capa/visão-geral/mensal derivam explicitamente da mesma fonte (`d?.metricas`) especificamente para nunca discordarem entre si — decisão de engenharia real que serve diretamente à confiança (um CEO vendo dois "MRR" diferentes na mesma tela perderia confiança no sistema inteiro).

## Problemas prioritários

**[P0] Zero uso de tokens de design em todo o arquivo** — ~40+ instâncias de hex/Tailwind-color inline, incluindo um mini-sistema de cor próprio no cabeçalho (`PRO`/`PRO_DARK`/`INK`). É a tela de maior tráfego do produto, isenta do sistema de tema que o próprio DESIGN.md aponta como a classe de bug mais cara do projeto — troca de tema Laranja/Verde ou modo escuro deixará essa tela quebrada silenciosamente enquanto o resto do app muda corretamente. → `/impeccable harden`

**[P0] Numeração de seção duplicada/quebrada** — duas numerações colidindo no mesmo documento (badge `num` em alguns blocos, número literal no título de outros, reusando "2" para duas seções diferentes). Um relatório feito pra ser citado em reunião ("olha a seção 3") tem hoje numeração ambígua — bug de correção num artefato cuja função é ser documento citável. → `/impeccable distill`

**[P1] Sem exportação CSV/Excel, sem drill-through, sem comparação de período** — só dropdown de mês/ano + impressão do navegador como controles. Para uma superfície "Operate" (per a própria taxonomia do DESIGN.md), isso é heurística-crítico: um CEO querendo encaminhar "só a lista de churn" pro financeiro, ou comparar mês a mês, não tem caminho além de printar ou digitar números manualmente. → `/impeccable optimize`

**[P1] Nenhum estado de erro diferenciado** — falha de fetch cai só em `console.error`, invisível ao CEO. Se a chamada falhar (instabilidade de rede, expiração de sessão, problema de deploy — todos plausíveis dado o histórico já registrado de deploy travado neste projeto), a tela mostra silenciosamente "Sem dados para Agosto/2026", que um CEO pode facilmente interpretar como "o negócio não fez nada esse mês" em vez de "o relatório quebrou". Para uma empresa onde "o que não está no CRM não existe" é doutrina operacional, essa ambiguidade é risco de confiança no negócio, não só capricho de UI. → `/impeccable harden`

**[P2] Emoji como iconografia principal de seção** (📊 📈 🔄 ✅ ❌ ➕ 💰 🤝 🖨️ 📅 espalhados por várias linhas) — contradiz diretamente o norte do DESIGN.md ("não é uma vitrine... é um painel de controle"). Emoji-como-ícone é padrão de protótipo rápido e lê como inacabado numa tela posicionada como "visão executiva para a diretoria" — também renderiza de forma inconsistente entre SO/navegador, risco de fidelidade justo na tela cujo caminho primário de exportação é impressão/PDF pra diretoria. → `/impeccable polish`

## Red flags de persona

**Riley (stress tester)** — o mais relevante aqui, dado o histórico real deste projeto (incidentes de perda de dados, deploy de backend travado, banco MySQL sem backup já documentados em memória):
- Falha de fetch é silenciosamente engolida — Riley pegando isso durante um episódio real de deploy travado veria um relatório vazio "Sem dados" sem saber que é o backend, não o negócio.
- Valores derivados (MRR líquido, etc.) não têm checagem de sanidade — uma anomalia de dado (MRR negativo por lançamento manual errado, já que não há gateway automatizado per PRODUCT.md) renderiza como está, sem sinalização, por mais implausível que seja.
- Nenhum estado vazio desenhado para "mês genuinamente zerado" — que é exatamente quando o CEO mais precisa de sinal claro, não uma tela que parece quebrada.

**Alex (usuário avançado, usa o sistema "várias vezes ao dia" per PRODUCT.md)**:
- Sem visão salva, sem atalho de teclado, sem navegação âncora entre as 10+ seções — quem abre isso todo dia é forçado a rolar o mesmo caminho fixo sempre.
- Exportar/imprimir é literalmente "abrir o diálogo de impressão do SO" — sem download direto de PDF/XLSX.

## Observações menores

- Classes Tailwind conflitantes no mesmo elemento (`text-3xl` + `text-sm`, `font-bold` + `font-semibold`) — provável resíduo de copy-paste, tamanho renderizado real depende da ordem de cascata CSS.
- Nome de supervisor fallback hardcoded (`'Jessica Cardoso'`) — se `d.supervisor` vier vazio por razão legítima, um nome humano fabricado aparece silenciosamente num relatório executivo.
- Múltiplas `<table>` sem wrapper `overflow-x-auto` visível — tabelas largas (7+ colunas) podem estourar em viewport estreito.
- O disclaimer sobre subestimação de período longo (já visto no SDR) está enterrado em `text-xs text-gray-500` — merece mais peso visual dado que embasa decisão real (revisão de desempenho de SDR).

## Perguntas provocativas

1. Se essa tela fosse submetida ao mesmo padrão de "No Loose Hex Rule" já aplicado na tela de login, ela passaria em code review hoje — e se não, por que a tela de maior tráfego do produto foi ao ar sem isso?
2. Duas numerações de seção colidindo e um nome de CEO/supervisor hardcoded como fallback silencioso — se ninguém pegou isso, quão cuidadosamente essa tela específica está sendo revisada em relação ao resto do sistema de ~40 telas, dado que é a *primeira* coisa que todo CEO vê?
