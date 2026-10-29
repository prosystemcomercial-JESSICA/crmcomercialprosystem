# 29/10/2026: OpenRouter grátis como segunda camada

## Pedido
A Jessica colou a chave da OpenRouter no servidor e pediu o mesmo tratamento do Groq: economizar antes de usar a IA paga.

## Teste da conta (no servidor)
- Plano grátis: 50 pedidos por dia nos modelos `:free`.
- Com `data_collection: deny` (só provedores que não guardam os dados), responderam em português o Flint (3,7 s) e o Dots 3 (6,7 s). O Gemma 4 31B aceita a regra, mas estava congestionado. Os modelos da NVIDIA e da Poolside exigem liberar o uso para treino e ficaram de fora. O Inkling só funciona em "agentic harnesses".

## O que mudou
- `ia-gemini.service.ts`: `tentarOpenRouter` entra no automático logo depois do Groq e também pode ser escolhido no painel. Ela tem um limite do dia em memória e pausas depois de um 429.
- `lib/ia-rotas.ts`: os modelos Flint, Dots 3 e Gemma 4 31B entram no catálogo. Há 1 teste novo (29 testes de IA passando).
- Uso: o campo `openrouter` foi incluído no contador, e a tabela de Desempenho ganhou a coluna "OpenRouter (grátis)".
- Painel Modelos de IA: os textos explicam as duas camadas grátis.
- Documentos: os seis de `docs/produto/`, o manual, as novidades e o `ESTADO.md`.

## Pendências
- Acompanhar se a coluna "Falhas" sobe por causa da OpenRouter, que tem modelos grátis congestionados.
