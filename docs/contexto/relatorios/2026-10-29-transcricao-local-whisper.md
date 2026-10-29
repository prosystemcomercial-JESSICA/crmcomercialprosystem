# 29/10/2026: transcrição de áudio no servidor (Whisper local, sem custo)

## Pedido
A Jessica perguntou em que a chave da OpenAI era usada e onde dava para parar de usá-la. Escolheu começar pela transcrição de áudio: "faça isso [...] Sem custo".

## Feito
- `backend/src/services/ia-gemini.service.ts`: áudio em `chamarGemini` vai primeiro para o transcritor local (`TRANSCRITOR_URL`, padrão `http://127.0.0.1:8766`). Se ele falhar, a transcrição falha e nada é cobrado. `TRANSCRICAO_RESERVA=paga` libera a OpenAI como reserva, e `TRANSCRITOR_URL=desligado` volta ao caminho antigo.
- `backend/src/services/uso-ia.service.ts`: novo contador `whisper` em `ia.uso.AAAA-MM-DD`. As telas ainda não o mostram.
- `backend/transcritor/servidor.py` (faster-whisper 1.2.1, modelo `small`, int8, 2 threads, um áudio por vez, 127.0.0.1:8766) e `backend/transcritor/instalar.sh` (venv em `/opt/transcritor`, cópia do servidor para lá, pm2 `transcritor`).
- `backend/tests/transcricao-local.test.ts` (4 testes).
- Documentos: os seis de `docs/produto/`, `docs/comercial/manual-de-uso-assistente.md`, `docs/comercial/novidades-crm.html` e `docs/contexto/ESTADO.md`.
- Na VPS: o instalador foi rodado. O pm2 `transcritor` está online e salvo (`pm2 save`).

## Verificado
- Vitest: `transcricao-local`, `painel-ia` e `laya-caderno` passaram (19 testes). `tsc` sem erros nos arquivos alterados.
- Na VPS: `/health` ok. Um áudio de teste de 15 s em português, gerado por voz sintética e não de cliente, foi transcrito em 3,7 s (wav) e 3,8 s (ogg/opus), com texto correto. A RAM livre continuou em cerca de 8,8 GB.
- O deploy do backend e a primeira transcrição real pelo CRM estão registrados no ESTADO.md (entrada de 29/10).

## Decisões e porquês
- **Whisper local em vez de Gemini:** a Jessica pediu "sem custo". A cota grátis do Gemini tem limite e expõe o áudio a mais um fornecedor.
- **Sem reserva paga por padrão:** se o transcritor cair, a falha aparece e não é cobrada, como ela pediu. A reserva só liga pelo `.env`.
- **Modelo `small` com 2 threads:** a VPS tem 4 núcleos e também roda Laya, Evolution e outro CRM. O `medium` seria cerca de 3 vezes mais lento.
- **Leitura do áudio própria (`ler_audio`):** o leitor do faster-whisper chama `av.open(metadata_errors=...)`, que o `av` 15+ não aceita, e não há wheel do `av` 14 para esse servidor.
- **Transcritor em `/opt/transcritor`, fora da pasta do app:** assim o deploy não o derruba. Quando o `servidor.py` mudar, é preciso rodar o instalador de novo.

## Pendente
- Mostrar o contador `whisper` nas telas Desempenho e Caroline. É opcional; a Jessica decide.
- Próximos cortes de custo sugeridos: a chave do Grok para as tarefas simples e incluir a intenção "outro" no desvio da Laya. Esperam o pedido da Jessica.

## Próxima sessão
Para conferir a transcrição: `pm2 logs transcritor` na VPS deve mostrar `POST /transcrever 200` quando chegar um áudio. Na contagem `ia.uso.<dia>`, `whisper` sobe e `openai` não sobe por áudio.
