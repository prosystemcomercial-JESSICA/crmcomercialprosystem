# 29/10/2026: uso da IA por assistente

**Pedido da Jessica:** um documento para saber quantas requisições cada assistente fez à OpenAI. Depois disso, ela pediu: "Então vamos fazer isso, preciso de controle total".

## O que havia
- O CRM contava só o total por dia e por fonte em `ia.uso.<dia>` (openai, grok, laya, evitada, whisper), sem dizer qual assistente fez a chamada.
- Todas as chamadas passam por `chamarGemini` / `pesquisarComGemini` (`services/ia-gemini.service.ts`), com uma chave só.

## O que foi feito
- `backend/src/lib/uso-ia-agentes.ts` (novo): `agenteDaPilha` (lê da pilha qual serviço chamou), `tokensDaResposta`, `somarPorAgente`, `totalPorAgente`, `nomeDoAgente`.
- `uso-ia.service.ts`: `registrarChamadaIa(agente, fonte, { ok, tokens })` e `usoIaPorAgente(prisma, dias)`. `gravarUsoIa` também grava `ia.agentes.<dia>`.
- `ia-gemini.service.ts`: o parâmetro opcional `agente` passa por OpenAI, Grok, transcrição OpenAI e Whisper local. Registra a falha (erro HTTP ou sem resposta) e os tokens (`usage`).
- Quem chama e diz o próprio nome: a Caroline (`agenteDe(sdr)`: Caroline, Julio, Luiz Felipe), a Olívia e a Mila (pesquisas) e a conversa no Escritório (`conversa-<agente>`). Os outros são reconhecidos pelo arquivo.
- `routes/desempenho.ts`: `ia.por_agente`. `PainelDesempenho.tsx`: barras e tabela "Uso da IA por assistente".
- Documentação: os 6 documentos de `docs/produto`, o manual, as novidades e o ESTADO.

## Conferido
- `npx vitest run tests/uso-ia-agentes.test.ts`: 8 testes passaram.
- Teste à parte com Node: a pilha mostra o serviço que chamou, inclusive quando ele faz `await` antes da chamada.
- `tsc` do backend: nenhum erro novo nos arquivos mudados. Os erros que aparecem em `caroline.service.ts:931` e `sdr-desempenho.ts` já existiam. `tsc` do frontend: sem erros em `PainelDesempenho`.

## Cuidados
- Outra sessão tem mudanças não commitadas (Heitor, `sdr.ts`, `server.ts`, `caroline.service.ts`). O commit foi montado com um índice temporário: do `caroline.service.ts` só entrou a linha do `agente`.
- Os dias antes de 29/10/2026 não têm a divisão por assistente.
- O Gemini (legado) não entra na divisão.

## Pendências
- Ler o total por dia que já está gravado em produção, para completar o documento da Jessica. A leitura do servidor foi recusada pela permissão desta sessão.
