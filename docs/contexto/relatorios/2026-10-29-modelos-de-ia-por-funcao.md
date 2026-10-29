# 29/10/2026: Configurações › Modelos de IA e Gemini ligado

## Pedido
A Jessica mandou um print de outro sistema, com uma tabela de funções com modelo principal e fallback, e pediu "um painel assim" em Configurações. Depois pediu para ligar a chave do Gemini, que ela tinha colado como se fosse da OpenRouter.

## O que mudou
- `backend/src/lib/ia-rotas.ts` (novo): catálogo de modelos, as 13 funções, validação do que vem da tela e o plano de tentativa (principal, reserva e automático).
- `backend/src/services/ia-gemini.service.ts`: `seguirRota` roda antes do caminho automático em `chamarGemini` e `pesquisarComGemini`. As chamadas ao Gemini agora passam por `chamarApiGemini` e contam no uso. `tentarGroq` e `chamarOpenAI` aceitam escolher o modelo.
- `backend/src/routes/ia-modelos.ts` (novo) e o registro em `server.ts`: `GET/PUT /configuracoes/ia-modelos`, só para a gestão.
- `frontend/components/configuracoes/ModelosIa.tsx` (novo), `app/configuracoes/page.tsx` e `lib/api-client.ts`: o painel.
- Uso: o campo `gemini` foi incluído no contador por assistente, e a tabela de Desempenho ganhou a coluna "Gemini".
- `backend/tests/ia-rotas.test.ts`: 11 testes. Os 28 testes de IA passam. Na suíte completa, 5 testes que precisam de banco falham aqui (login, backup, churn); não há banco local e eles não têm relação com esta mudança.

## Chave do Gemini
- Testada no servidor: a OpenRouter recusou (401) e o Gemini aceitou (200). Ela foi renomeada de `OPENROUTER_API_KEY` para `GEMINI_API_KEY` no `.env` da VPS. O `.env` anterior está em `/root/env-antes-gemini-20261029.bak`.
- A chave não muda nada sozinha: o Gemini só entra onde a Jessica escolher no painel, ou no fim da fila automática.

## Decisões
- "Automático" é a ordem anterior, com o Groq grátis primeiro. Por isso, sem nenhuma escolha no painel, nada muda.
- Um modelo que não serve para o pedido (o Groq com imagem ou pesquisa) ou que está sem chave é pulado. Se nenhum servir, o pedido vai para o automático e não fica sem IA.
- O commit levou só as linhas desta tarefa em `server.ts` e `api-client.ts`, porque outra sessão tem mudanças do Heitor nesses arquivos.

## Pendências
- OpenRouter: falta a chave `sk-or-v1-…`.
