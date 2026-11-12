# 12/11/2026: motivo de cada falha das IAs registrado

## Pedido

A Jessica mandou um print do Escritório › Consumo de IA ("56% das chamadas falharam neste mês"; Julio com 3.786 falhas em 4.144 chamadas, Sofia com 110 em 111) e perguntou "o que são esses erros de chamadas". Depois pediu: "precisamos desses erros registrados para análises futuras". Ela liberou a leitura da produção.

## Feito

- **Diagnóstico (produção, só leitura):** `ia.agentes.2026-11-*`, `ia.falhas.*` e o log `comercial-backend-error.log`. A causa principal foi a chave antiga da OpenAI recusada (cerca de 3.900 "A chave da IA é inválida") de 02 a 05/11, até a troca em 05/11 (ver ESTADO.md, entrada de 05/11). Números por agente e por dia estão no ESTADO.md (entrada de 12/11).
- **Código:**
  - `backend/src/lib/ia-erros.ts` + `backend/tests/ia-erros.test.ts`: classificação do motivo e soma por dia, agente, IA e motivo.
  - `backend/src/services/uso-ia.service.ts`: `registrarChamadaIa({ erro })`, `registrarErroIa`, gravação em `ia.erros.<dia>` e `errosIaPorDia`.
  - `backend/src/services/ia-gemini.service.ts`: todos os pontos de falha passam a mensagem e o modelo. OpenAI 429 `insufficient_quota` virou "Sem crédito".
  - `backend/src/services/escritorio-painel.service.ts`: `erros_por_agente`.
  - `frontend/components/escritorio/painel/ConsumoEscritorio.tsx` e `tipos.ts`: o número de falhas abre os motivos.
- **Documentos:** os 6 de `docs/produto/` ("Atualização 12/11/2026 (6)"), `docs/comercial/manual-de-uso-assistente.md` e `docs/comercial/novidades-crm.html`.
- **Servidor:** `time: true` no `comercial-backend` do `ecosystem.config.js` da VPS (arquivo só do servidor), para o log ter data e hora.

## Verificado

- `npx vitest run` nos testes de IA (10 arquivos, 67 testes): passaram.
- `tsc` do backend (arquivos mudados) e do frontend: sem erros novos.
- Deploy de `7868fa2` concluído com backup e banco sem alterações. O deploy seguinte, `7b79657`, o inclui. Site 200.
- Na produção, `consumoDoMes` já devolve `erros_por_agente` com motivos reais. O log do backend saiu com data e hora.
- A tela (botão nas falhas) **não foi aberta no navegador**: não verificado visualmente.

## Decisões e porquês

- **Contadores intocados:** o motivo fica numa chave nova (`ia.erros.<dia>`) para não mudar a série histórica de chamadas e falhas.
- **Falha do Groq:** anota só o motivo, porque o Groq nunca entrou no contador de falhas.
- **Histórico de 02 a 11/11:** não foi reconstruído em `ia.erros`, porque o log não tinha data. O diagnóstico ficou só no texto do ESTADO.md.
- **Guarda sem prazo:** cada dia ocupa poucos KB.

## Pendente

- Gemini grátis "sem crédito" (HTTP 402: chave de projeto com cobrança pré-paga). Decide a Jessica: trocar por uma chave de projeto sem cobrança ou pôr crédito.
- Usar os motivos na análise semanal, se a Jessica quiser.

## Próxima sessão

Depois de alguns dias, ler `ia.erros.<dia>` na produção (script de leitura do arquivo local de acessos) e ver se algum motivo se repete. Skills: `diagnosing-bugs` se aparecer erro novo.
