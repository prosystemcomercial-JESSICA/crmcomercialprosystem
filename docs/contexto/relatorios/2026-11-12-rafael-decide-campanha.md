# 12/11/2026 · Rafael decide a campanha e lê o registro do CRM no treino

## Pedido
Print da Jessica no painel do Rafael › Perguntas para você. Pergunta dele (origem "Rafael (treinamento)"): "Qual campanha e quais condições foram mencionadas nas mensagens da Farmácia Econômica, e onde está o registro de aprovação?". Resposta dela: "Não sei, você deve ter esse registro, você está liberado para avaliar a proposta enviada para todos, para tomar as atitudes e instruir os agentes da continuidade."

## Feito
- **Causa:** no treino (`treinarAgente`, `backend/src/services/especialista.service.ts`) o Rafael só via o texto das conversas, não o registro do lead (`SdrLead.dados.desconto_autorizado`: %, por quem, quando). O item ia para "pesquisar" → `pesquisarDuvida` (pesquisa na internet) → pergunta à Jessica.
- **Treino com registro do CRM:** cada conversa traz no topo "REGISTRO DO CRM" (`registroCrm` + `textoRegistroCampanha` em `backend/src/lib/assistente/negociacao.ts`): campanha autorizada/recusada/inexistente, validade, vigente ou vencida, e a proposta (plano, total, status, validade, condição). O roteiro do treino e o de `pesquisarDuvida` proíbem perguntar à Jessica o que aconteceu numa conversa.
- **Rafael decide a campanha:** `rafaelRevisa` agora vale para tudo; pendente com `negociacao` vai para `revisarCampanha` (`backend/src/services/rafael-aprovador.service.ts`): IA escolhe 30, 20 ou 0 (`lerDecisaoCampanha`; fora disso = inválido), chama `decidirNegociacao` com `por = Rafael`, anota ORIENTACAO para o agente e avisa a gestão. IA sem resposta em 2 min: 20% (`CAMPANHA_NO_PRAZO`). `pedirAutorizacaoNegociacao` não manda mais botões à gestão, só chama o Rafael (a versão antiga ficou como `pedirAutorizacaoNegociacaoGestao`). A Jessica ainda pode decidir antes pela tela /aprovar.
- Docs: os 6 de `docs/produto/`, manual, novidades (selo "Publicação pendente"), ESTADO.

## Verificado
- `npx vitest run tests/negociacao.test.ts tests/rafael-aprovador.test.ts`: 10 testes passando.
- `npx tsc --noEmit -p . --rootDir .`: nenhum erro nos arquivos mudados.
- **Não verificado em produção:** a leitura (só leitura) da pergunta e do lead Farmácia Econômica foi barrada pelo controle de permissões da sessão. Não sei se a Jessica já clicou em "Responder".
- **Não publicado:** o deploy do main está barrado pela tabela `AgendaTecnico` (outra tarefa, aguarda autorização da Jessica).

## Decisões e porquês
- A resposta dela foi lida como autorização para o Rafael decidir a campanha padrão. Os limites continuam no código (só 30/20/0), então o Rafael não consegue dar desconto maior.
- Prazo vencido sem IA = 20% (a opção menor que já é condição padrão), em vez de travar a conversa.
- `caroline.service.ts` não foi mexido (tem mudanças não salvas de outra sessão); a troca foi feita em `assistente-negociacao.service.ts`.

## Pendente
- Jessica: se ainda não enviou a resposta do print, tocar em **"Não se aplica"** (senão o texto "Não sei, você deve ter esse registro…" vira "fonte oficial" no material dos agentes). Se já enviou, apagar/arquivar o documento "Resposta da Jessica: Qual campanha…" no painel do Rafael.
- Jessica: autorizar a criação da tabela `AgendaTecnico` para o deploy seguir; este commit entra junto.

## Próxima sessão
Depois do deploy, conferir no log `[RAFAEL]` a primeira pendente com `negociacao` decidida (`decidido_por = 'rafael'`) e o aviso à gestão. Skills: `relatorio-final`, `handoff` se ficar pela metade.
