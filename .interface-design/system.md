# Padrão visual do Portal Técnico (e das telas novas do CRM)

Definido em 02–05/10/2026 no redesenho do Portal Técnico. Toda tela nova segue estas regras; quem mudar uma regra atualiza este arquivo.

## Direção

- O card da demanda é uma **ordem de serviço calma**: leve, SaaS moderno, sem cara de "feito agora".
- Quem usa: técnico no telefone com a loja (precisa achar o contato e o próximo passo em segundos) e supervisora (precisa ver o que pede ação).
- Uma pergunta por tela: "qual é o próximo passo?" (técnico) e "o que pede a minha ação?" (supervisão).

## Cor (identidade ProSystem)

| Uso | Valor |
| --- | --- |
| Ação, link, telefone, destaque, "sua vez" | azul `#2E6EAB` (fundo de destaque `#2E6EAB08`–`0f`, borda `#2E6EAB40`–`55`) |
| Títulos no modo escuro / marca | navy `#0D2238` |
| Concluído, WhatsApp, "tudo certo" | verde `#16a34a` |
| Alerta, pendência, em risco | laranja `#d97706` / texto `#b45309` |
| Estouro, erro, sem técnico | vermelho `#dc2626` |
| Estrutura | tokens `var(--t-card-bg)`, `var(--t-card-border)`, `var(--t-content-bg)`, `var(--t-text-primary/secondary/muted)` |

- Cor só comunica (status, ação, identidade). Nada de cor decorativa, gradiente ou várias cores de destaque juntas.
- A saúde do card usa exatamente verde / laranja / vermelho, nessa ordem de gravidade.

## Profundidade e superfícies

- **Só bordas finas** (`1px solid var(--t-card-border)`); sem sombras pesadas. Sombra só em sobreposição (popup, busca Ctrl+K).
- Painéis com `border-radius: 10px`; cartões do quadro 12px; pílulas `999px`.
- Listas de dados = **lista de definição** (rótulo à esquerda ~170px, valor à direita, linhas finas), não grade de caixinhas. Empilha no celular.

## Tipografia (hierarquia por peso e cor, não só tamanho)

| Papel | Tamanho / peso / cor |
| --- | --- |
| Título do card (nome do cliente) | 20px / 650 / primary, `letter-spacing: -0.01em` |
| Número de destaque (indicador, horas do dia) | 26–30px / 650 / `tabular-nums` |
| Valor / item | 14–15px / 500–600 / primary |
| Rótulo | 11–12px / 500 / muted |
| Seção | 12px / 600 / secondary |
| Meta (datas, autor) | 11–12px / 400 / muted |

- Números que mudam (horas, contadores, prazos, telefone): `font-variant-numeric: tabular-nums`.

## Espaço e toque

- Base 4px; padding de painel 12–16px; gap entre seções 14–24px.
- **Toque mínimo 44px** em tudo que o técnico usa no celular (Ligar, WhatsApp, Play, envio de arquivo do cliente). Botões secundários 32–36px.
- Celular: o card abre em tela cheia e tem **barra fixa no rodapé** com Ligar, WhatsApp e Play (`.pt-barra-celular`, até 640px).

## Padrões de componente

- **Faixa "Próximo passo"** no topo do card: rótulo "Próximo passo · Sua vez / Com a supervisão / Com <técnico>", título 15/600, detalhe 12 muted, pendências com ponto laranja, botões do papel de quem vê.
- **Linha de marcos** no lugar de barra de %: círculos de 18px (✓ azul quando feito, contorno azul no atual), traço de 1.5px entre eles.
- **Faixa de contatos**: Decisor e Contato numa só caixa, nome 15/600 + telefone azul clicável + botões redondos de 36px (área de toque ampliada) Ligar / WhatsApp.
- **Cartão do quadro**: etiquetas, nome (com ponto de saúde quando não está verde), "→ próximo passo" (azul quando é a vez de quem olha), prazo + iniciais do técnico, linha de progresso de 3px no rodapé. Sem números de %.
- **Abas do card**: 5 grupos (Visão geral, Cliente, Execução, Conversa, Tempos) com pílulas para as abas de cada grupo.
- **Indicador**: rótulo 12 muted, valor 26/650 colorido pela meta (verde cumpriu, laranja não), meta e variação contra o mês anterior em 12px.
- Ícones: lucide, 12–18px, cor do texto ou da ação; emoji só em etiquetas curtas já existentes.

## O que evitar

- Caixas coloridas grandes e blocos escuros pesados.
- Grades de "ícone + número grande + rótulo" iguais para tudo.
- Bordas fortes, sombras dramáticas, gradientes.
- Texto abaixo de 11px; toque abaixo de 32px (44px no que é de celular).
