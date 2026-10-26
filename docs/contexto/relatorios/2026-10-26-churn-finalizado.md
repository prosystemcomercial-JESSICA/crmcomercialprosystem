# 26/10/2026: etapa "Finalizado" nos casos de churn

## Pedido
1. Print do seletor de status do caso de churn: "Inclua a coluna finalizado (totalmente resolvido)".
2. Print da aba Exclusões (CEO): "quando eu marcar esses dois checkbox, ele tem que ir para finalizado, assim sabemos que foi concluido definitivamente".
3. Print do Kanban e dos Concluídos: "tire do kambam, e só deixe em concluido, onde eu possa clicar e ver o card inteiro com o historico de como terminou, com toda a trilha do cancelamento, tire o checkbox, para nao correr o risco de desmarcar (...) coloque abrir card com a trilha ou fluxograma (...) e todas as informações do cliente até ali."

## Feito
- 1ª parte (commit `31241d7`): status `FINALIZADO`, lista única de status em `backend/src/lib/caso-churn-status.ts`, contagem como perda nos gráficos, painel do CEO e relatório de retenção; antiduplicação corrigida.
- 2ª parte (commit seguinte, "feat(churn): finalizado pelas confirmações do CEO e card da trilha"):
  - Finalização automática quando as duas confirmações ficam marcadas (`marcarExclusao` + `statusAposConfirmacao`); finalizado não aceita desmarcar.
  - Finalizado fora do Kanban e da lista (`CasoChurnService.list` sem filtro); retirados a coluna, o botão "Finalizar caso" e a opção manual da 1ª parte.
  - Concluídos sem caixinhas, com o botão "📂 Abrir card": `frontend/components/casos/TrilhaCancelamento.tsx`, rota `GET /casos-churn/:id/trilha`, serviço `trilhaCancelamento`, regra `etapasDoCancelamento`.
  - Script `backend/scripts/finalizar-exclusoes-concluidas.ts` para os casos já concluídos antes.
- Detalhes nas seções "Atualização 26/10/2026" (1ª e 2ª parte) dos 6 documentos de `docs/produto/` e do manual.

## Verificado
- `vitest`: `caso-churn-status`, `churn-exclusao` e `churn-exclusao-pdf`, 17 testes passando.
- `tsc` do backend e do frontend: nenhum erro novo nos arquivos mudados. ESLint: arquivo novo limpo; os avisos de `ExclusaoCeo.tsx` são os mesmos de antes.
- Card da trilha conferido com fotos em 1440px e 400px (página temporária com dados fictícios, já apagada).
- Não verificado: fluxo completo com banco (marcar as duas caixas → Finalizado) e produção, porque não foi publicado.

## Decisões e porquês
- Finalizado = fim de um cliente **perdido**, só pelas duas confirmações do CEO (não escolhido à mão), para "concluído definitivamente" ter um único caminho.
- Definitivo: o backend recusa desmarcar confirmação de caso finalizado (não só a tela).
- Os 7 já concluídos passam por script com simulação, em nome de quem enviou ao CEO, em vez de mudar sozinho ao abrir a tela (evita gravar em nome de quem só olhou).
- Linha do tempo junta as atualizações do caso e os eventos da ficha do cliente (inclui inativação, suporte retirado, cobrança suspensa).
- Sem mudança de banco (`CasoChurn.status` é texto; registro do CEO segue em `ConfiguracaoIntegracao`).

## Publicação
- 26/10/2026, 18h40, a pedido da Jessica: backup `pre-alter-20261026-183738.sql.gz`, ALTER TABLE pendente do `f017b30`, `deploy-vps.sh 72cdace` (pipeline ok, build ok, site e API respondendo).
- `finalizar-exclusoes-concluidas.ts --aplicar`: 8 casos finalizados (7 do print + 1713, que também tinha as duas confirmações). Simulação seguinte: 0.

## Pendente
- Nada desta tarefa. Conferir com a Jessica um card real em Exclusões › Concluídos.

## Próxima sessão
Se a Jessica pedir ajustes no card: `frontend/components/casos/TrilhaCancelamento.tsx` e `trilhaCancelamento` em `backend/src/services/churn-exclusao.service.ts`.
