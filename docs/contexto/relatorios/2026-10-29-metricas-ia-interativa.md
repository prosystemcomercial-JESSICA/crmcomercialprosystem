# Métricas da IA interativa (29/10/2026)

## Pedido
"📊 Métricas da IA: quero essa janela mais interativa" (Jessica, Escritório virtual).

## O que mudou
- Arquivo único de código: `frontend/components/desempenho/PainelDesempenho.tsx`. Ele é usado pela janela "📊 Métricas da IA" do Escritório (`compacto`) e pela tela `/desempenho`; as duas ganharam o mesmo comportamento.
- Período "Hoje" (`dias=1`, o backend já aceitava 1 a 365), atualização sozinha a cada 60 s em "Hoje" (só com a aba visível), botão "↻ Atualizar" e horário da última atualização.
- Cartões do topo viram botões que abrem a aba do assunto.
- Abas: Visão geral, Agentes, Uso da IA, Compromissos e propostas.
- Funil por agente (leads → contatados → responderam → efetivos → demos, % passo a passo).
- Gráfico por dia empilhado (OpenAI, Grok, Groq, Laya) com legenda que liga/desliga e detalhe do dia.
- Uso da IA: clique no assistente mostra a origem das respostas; filtro "Só quem teve falhas".
- Tabelas ordenáveis (`TabelaOrdenavel`).

## Decisões
- Nada de backend: os dados que já vêm de `GET /relatorios/desempenho` bastaram. O gráfico por dia não tem OpenRouter/Gemini porque `ia.por_dia` só traz openai, grok, laya e groq.
- O carregamento usa uma chave de pedido (período + nº) em vez de `setState` dentro do efeito, para passar no lint `react-hooks/set-state-in-effect`.

## Verificação
- `npx tsc --noEmit` do frontend: sem erros no arquivo. `npx eslint` no arquivo: limpo (a versão anterior tinha 1 erro).
- Não testei no navegador com dados reais (precisa do login de gestão).

## Documentos
6 de `docs/produto/`, `manual-de-uso-assistente.md`, `novidades-crm.html`, `ESTADO.md`.
