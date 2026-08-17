# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

CRM interno de uso exclusivo da equipe da Prosystem (não é produto vendido a terceiros — é a ferramenta que a própria empresa usa para vender e operar seu SaaS de gestão). Papéis principais:

- **CEO/Diretoria**: visão executiva, indicadores financeiros, aprovação de configurações.
- **Supervisão Comercial**: gestão de vendedores e SDRs, distribuição de leads, relatórios, gestão de usuários (mesma permissão do CEO nesse módulo).
- **Vendedor (Closer)**: recebe leads qualificados, conduz demonstração/negociação/fechamento, recebe comissão.
- **SDR (pré-vendas)**: prospecção ativa, qualificação de leads, sem acesso a fechamento/comissão.
- **Supervisão Técnica / Técnico (N1/N2/N3)**: implantação, suporte, onboarding de clientes.

Todos usam o sistema várias vezes ao dia, em desktop (a maior parte do trabalho é em mesa, não em campo). Urgência real: leads e casos de churn parados custam dinheiro visivelmente.

## Product Purpose

Gerenciar o ciclo comercial completo da Prosystem (empresa de tecnologia que vende sistema de gestão para farmácias, manipulação, padarias e varejo): captação e qualificação de leads, distribuição para vendedores, fechamento de contrato, onboarding, e retenção/churn de clientes já ativos. Substituiu processos manuais/planilhas — "o que não está registrado no CRM não existe" é regra operacional da equipe.

## Positioning

16+ anos de mercado combinados com especialização profunda em varejo/farmácia/manipulação/padaria — não é um CRM genérico de gestão comercial adaptado, é construído em cima do conhecimento real desses segmentos (dores fiscais específicas, integração com sistemas de balança/PDV, sazonalidade do varejo). Um concorrente genérico não replica esse conhecimento de domínio sem o mesmo tempo de bagagem no setor.

## Operating Context

Fluxo comercial principal: SDR prospecta e qualifica → Supervisão distribui lead qualificado para um vendedor → Vendedor demonstra/negocia/fecha → Técnico implanta → cliente ativo é monitorado por Health Score/NPS → casos de risco entram no módulo de Churn com dossiê financeiro e renegociação.

Ferramentas do dia a dia: WhatsApp (canal primário de contato com lead/cliente), Google Meet/Calendar (reuniões), e-mail (notificações automáticas do sistema).

## Capabilities and Constraints

- Stack: Next.js 16 (App Router) + React 19 no frontend, com **inline styles predominantes, não Tailwind puro** (ver `frontend/AGENTS.md` — convenção própria do projeto). Backend Fastify + Prisma + MySQL, hospedado no Railway.
- Sem gateway de pagamento integrado — toda cobrança/inadimplência é registrada manualmente pela equipe (não há Stripe/Asaas/etc).
- Banco de produção sem backup formal (Railway free tier) — mudanças de schema e dados de produção exigem cautela redobrada.
- Sistema de permissão em duas camadas: cargo (define o padrão) + liberação manual por módulo (pode estender além do cargo, tela Usuários → "Liberação de Módulos").
- Terminologia própria: "Lead" (prospect), "Qualificado" (etapa do funil pronta para distribuição), "SDR"/"Closer" (papéis distintos, não intercambiáveis), "Caso de Churn" (registro de cliente em risco), "MRR" (receita recorrente mensal).

## Brand Commitments

Paleta institucional fixa: `#0D2238` (azul-marinho profundo, usado em headers/telas de login) → `#4B8EC8` (azul médio, accent/interativo) → tons intermediários como `#2E6EAB`. Não substituir por outra paleta — o polish trabalha dentro dela (contraste, hierarquia, consistência de aplicação), não a redefine. Nome da marca: "ProSystem" (estilizado com "Pro" e "System" em pesos/cores diferentes no logo).

## Evidence on Hand

Nenhum dado de marketing/depoimento a fabricar — o CRM não expõe conteúdo institucional além do necessário operacionalmente (a página de login já usa números reais: "16+ anos de mercado", "98% satisfação de clientes", "5x mais produtividade", "24/7 suporte especializado" — não inventar novos números sem confirmação).

## Product Principles

1. **Dado real acima de estética** — é um CRM operacional, não uma vitrine; qualquer polimento visual deve manter ou melhorar a legibilidade dos números/estados, nunca sacrificar clareza por beleza.
2. **Papel define o que se vê** — cada tela deve deixar óbvio o que aquele papel específico (SDR, vendedor, supervisão, CEO) precisa fazer agora, não expor tudo para todos.
3. **Sem gateway automatizado, humano decide** — nenhuma automação deve fingir ser automática quando na verdade depende de alguém da equipe agir (ex: cobrança, dunning).
4. **Consistência entre telas conta mais que perfeição isolada** — o sistema tem ~40 telas construídas ao longo do tempo por diferentes iterações; alinhar padrões visuais entre elas é prioridade tão alta quanto refinar uma tela sozinha.

## Accessibility & Inclusion

Nenhum requisito de acessibilidade formal definido até o momento pela operação — não assumir WCAG AA como obrigatório, mas manter contraste de texto legível e áreas de clique confortáveis como boa prática padrão.
