# 29/10/2026: Groq grátis na frente das IAs pagas

## Pedido
A Jessica criou a conta no Groq e pediu que ele "entre antes de gastar os tokens pagos" ("meu intuito é economizar antes"), e que o uso seja medido.

## O que mudou
- `backend/src/lib/ia-groq.ts` (novo): regras puras: ler a cota dos cabeçalhos `x-ratelimit-*`, bloqueio depois de 429 ou da cota do dia zerada, e se o pedido cabe nos tokens por minuto.
- `backend/src/services/ia-gemini.service.ts`: `tentarGroq` roda antes de tudo em `chamarGemini` quando o pedido é só texto. Se ele não der conta, segue o caminho antigo (Grok → OpenAI → Gemini).
- `backend/src/services/uso-ia.service.ts` e `lib/uso-ia-agentes.ts`: contam `groq`, `groq_reserva` e `groq_tokens`, e guardam a cota em `ia.groq.cota`.
- `backend/src/routes/desempenho.ts` e `frontend/components/desempenho/PainelDesempenho.tsx`: cartão, colunas por dia e colunas na tabela por assistente.
- `backend/tests/ia-groq.test.ts`: 10 testes. Os 18 testes de IA passam.
- Documentos: os seis de `docs/produto/`, o manual, as novidades e o `ESTADO.md`.

## Decisões
- A chave foi colocada pela própria Jessica no `.env` da VPS, com `Read-Host` + ssh. Ela não passou pela conversa.
- Modelo `openai/gpt-oss-120b`: é o maior liberado na conta (a Llama 3.3 deu 404). A cota é de 1.000 pedidos por dia e 8.000 tokens por minuto.
- Pedidos estimados acima de 5000 tokens vão direto para a paga, para não gastar uma tentativa que seria recusada.
- Toda conversa de texto entra no Groq, inclusive a da Caroline com os leads. `GROQ_FORA` permite tirar um assistente se a qualidade cair.
- Pesquisa com busca, imagem, PDF e áudio continuam como estavam.

## Pendências
- Acompanhar, em Desempenho, a coluna "Groq → paga" e as edições das mensagens da Caroline.
- OpenRouter como segunda camada grátis (a Jessica criou a conta).
