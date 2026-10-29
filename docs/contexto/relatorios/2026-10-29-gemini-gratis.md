# 29/10/2026: Gemini grátis como terceira camada

## Pedido
"Coloca o gemini para economizarmos a paga também."

## O que mudou
- `ia-gemini.service.ts`: `tentarGeminiGratis` entra no automático depois do Groq e da OpenRouter e antes do Grok e da OpenAI. Ele vale também para pedidos com imagem ou PDF e para as pesquisas na internet (`pesquisarComGemini`), que antes iam direto para a OpenAI paga.
- Painel Modelos de IA: o texto explica as três camadas grátis.
- Documentos: os seis de `docs/produto/`, o manual, as novidades e o `ESTADO.md`.

## Decisões
- As conversas com leads (Caroline, Julio e Luiz Felipe) ficam fora do Gemini grátis, porque o plano grátis do Google pode usar o conteúdo para treino. A Jessica não respondeu se queria incluir os leads, então ficou a opção mais segura. Para incluir, basta deixar `GEMINI_GRATIS_FORA=` vazio no `.env`.
- Quando o Gemini atinge o limite (429), ele pausa 10 minutos e a IA paga cobre.
- O áudio continua no Whisper local.

## Pendências
- Acompanhar a coluna "Gemini" e a coluna "Falhas" em Desempenho.

## Teste em produção
- `gemini-2.5-flash`: 404, "no longer available to new users".
- `gemini-3.8-flash`, `gemini-flash-latest`, `gemini-3.5-flash`, `gemini-3.1-flash-lite` e `gemma-4-31b-it`: todos deram 402, "Your prepayment credits are depleted". O projeto da chave tem cobrança pré-paga ligada e está sem crédito, então não tem a cota grátis.
- Correção: o modelo padrão passou a ser `gemini-flash-latest`, e os erros 402, 401, 403 e 404 pausam a camada por 1 hora. Sem isso, cada pedido tentaria o Gemini à toa antes da paga.
- A Jessica precisa criar uma chave em um projeto sem cobrança no AI Studio. Com ela no `.env` (`GEMINI_API_KEY`), a camada passa a funcionar sem mudar código.

