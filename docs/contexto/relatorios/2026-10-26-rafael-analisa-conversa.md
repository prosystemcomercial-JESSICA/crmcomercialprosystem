# 26/10/2026: Rafael analisa a conversa e Caroline não manda demonstração sem fluxo

## Pedido
A Jessica mandou o print de uma conversa da Caroline com uma farmácia de Vila Velha (prospecção) e pediu: "Peça para o Rafael analisar essa conversa e mostrar como a Caroline está errada e não deixar que ela repita isso, não existiu um fluxo de conversa aí".

## Feito
- **Causa:** no contato ativo, a Caroline listou recursos sem saber a dor, condicionou os horários à confirmação da loja e, quando o farmacêutico perguntou "com quem estou falando?" e respondeu "SIM" (é a loja), mandou a lista de horários. O roteiro deixava `oferecer_demo` depois da confirmação da loja, e nada no código conferia se havia dor ou pedido.
- **Roteiro** (`backend/src/lib/assistente/sdr.ts`, `promptCaroline`): "FLUXO DO CONTATO ATIVO" (apresentação → uma pergunta fácil → dor ligada a um recurso → convite e "sim" → demonstração) e regra para "com quem estou falando?".
- **Trava** (`demoSemFluxo` em `sdr.ts`, aplicada em `backend/src/services/caroline.service.ts`): no contato ativo, demonstração sem dor e sem pedido/aceite é refeita; se a IA insistir, não sai e o agente pede socorro ao Rafael.
- **Rafael sob demanda:** `analisarConversa` (`backend/src/services/especialista.service.ts`), rota `POST /especialista/analisar-conversa` (`backend/src/routes/especialista.ts`), botão "Pedir análise ao Rafael" no menu … da conversa (`frontend/app/whatsapp/page.tsx`, `frontend/lib/api-client.ts`). Grava ALERTA no painel do Rafael, correção para o agente, lição no mural e o papo no Escritório.
- Documentos: os 6 de `docs/produto/`, manual do assistente, novidades e ESTADO.md.

## Verificado
- `npx vitest run tests/sdr-demo-sem-fluxo.test.ts tests/sdr-contexto-ficha.test.ts`: 12 testes verdes (o caso do print está no teste).
- Tipos: nenhum erro novo nos arquivos mexidos (backend e frontend). O erro `demo_a_partir` em `caroline.service.ts` é antigo.
- **Não verificado:** a conversa completa em produção (a leitura do banco foi negada pela permissão do Claude; a análise partiu do print) O deploy de `9a46b70` foi feito com backup: build ok, banco sem alterações, frontend ok e backend respondendo.

## Decisões e porquês
- A regra fica no roteiro **e** no código: só o roteiro já existia ("QUEM É DE VERDADE") e não impediu o erro.
- A análise do Rafael roda pelo botão, e não por um script direto no banco, porque a gravação em produção pelo Claude é bloqueada; assim a Jessica também usa nas próximas conversas.
- A regra permanente para os agentes é a do código/roteiro; a lição do mural dura 7 dias (padrão do mural).

## Pendente
- **Jessica:** depois do deploy, abrir a conversa da farmácia › … › "Pedir análise ao Rafael" e conferir a análise em Escritório › Rafael (aprovar o documento, se quiser no caderno).


## Próxima sessão
Conferir no log `[CAROLINE]`/Escritório se aparece "segurou a demonstração" em conversas de prospecção e se nenhuma demonstração legítima foi barrada. Skills: `diagnosing-bugs` se algo travar.
