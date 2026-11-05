# 05/11/2026 · Consumo das chaves pagas de IA em reais

## Pedido
Jessica: "No Painel de consumo da IA, preciso saber do consumo da Chave em Dinheiro, em Reais".

## Feito
- `backend/src/lib/custo-ia.ts` (novo): tabela de preços (US$ por milhão de tokens), `IA_PRECOS` no `.env` para corrigir, estimativa dos dias sem custo gravado (`custoDoDia`).
- `backend/src/lib/uso-ia-agentes.ts`: campos `custo_openai_usd`, `custo_grok_usd`, `custo_gravado` no uso por assistente.
- `backend/src/services/uso-ia.service.ts` + `ia-gemini.service.ts`: `registrarChamadaIa` recebe o modelo e grava o custo das chamadas pagas (OpenAI, Grok, transcrição paga).
- `backend/src/services/cotacao-dolar.service.ts` (novo): dólar da AwesomeAPI, cache de 6 h, guardado em `ConfiguracaoIntegracao` `ia.cotacao.usd`; `IA_DOLAR` fixa; reserva 5,50 marcada "aproximada".
- `backend/src/routes/desempenho.ts`: `ia.custo` e `custo_brl` por assistente.
- `frontend/components/desempenho/PainelDesempenho.tsx`: cartão "Gasto com a IA paga", quadro "Consumo das chaves pagas em reais" (barras por dia) e coluna "Custo (R$)".
- Documentos: os 6 de `docs/produto/`, manual, novidades e ESTADO.md (seção "Atualização 05/11/2026").

## Verificado
- `npx vitest run tests/custo-ia.test.ts tests/uso-ia-agentes.test.ts`: 16 testes passando.
- `tsc` do backend e do frontend: sem erros nos arquivos mudados (o erro em `src/lib/sdr-desempenho.ts` é antigo).
- Não verificado: o modelo de fato no `.env` da VPS (a leitura foi bloqueada nesta sessão); os valores reais na tela de produção; o deploy **não foi feito** (abaixo).
- Commit `7c6a7ac` no GitHub. `deploy-vps.sh 7c6a7ac` fez o backup do banco e parou: o Git do servidor está na história de antes da limpeza de chaves de 30/10 (`aa3a73a`), 1.115 commits à frente e 1.129 atrás. Nada foi mudado no servidor.

## Decisões e porquês
- Estimativa por preço de tabela, e não a fatura real: a fatura da OpenAI só sai pela Costs API com chave de administrador (`sk-admin-…`), que hoje não existe. Pode ser um próximo passo.
- Sem desconto de cache: o valor nunca fica abaixo do cobrado.
- Dias de 29/10 a 04/11: os tokens eram somados de todas as IAs do assistente; a estimativa tira os do Groq e divide o resto pelas chamadas de cada IA.
- Preços tirados de agregadores que citam as páginas oficiais (eesel.ai, anotherwrapper.com, pricepertoken.com): GPT-6 Luna US$ 0,10/0,50; Grok 4.7 US$ 2/6.

## Pendente
- **Deploy (Jessica decide):** alinhar o Git do servidor ao GitHub (`git fetch && git reset --hard origin/main` em `/var/www/comercial-prosystem`, depois do backup) e rodar `deploy-vps.sh 7c6a7ac`. O conteúdo do servidor é igual ao `d65ee7f` do GitHub, menos o `.claude/settings.json`. Vão junto 12 commits de outras sessões que também não estão no ar: `04036a3` (layout do kanban), `d3843b1` (ranking do analista), `f04014f` e `2330dfa` (lembrete das atividades de marketing).
- Conferir na tela de produção se o total bate com o painel de cobrança da OpenAI (Jessica). Se não bater, ajustar `IA_PRECOS`.
- Opcional: chave de administrador da OpenAI para mostrar a fatura real.

## Próxima sessão
Com o deploy autorizado: alinhar o servidor, publicar e conferir `/desempenho`. Depois, abrir `/desempenho` em produção, aba ⚡ Uso da IA, e comparar com platform.openai.com › Usage. Skills: `diagnosing-bugs` se os valores parecerem errados.
