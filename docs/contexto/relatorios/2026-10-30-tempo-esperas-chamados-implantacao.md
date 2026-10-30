# 30/10/2026: tempo das demandas, pré-requisitos do cliente e chamados internos (implantação)

## Pedido
- "Preciso saber o tempo que essas demandas repassadas demoraram para voltar… quantas horas gastamos de fato executando, quantas esperando", tanto o cliente quanto o desenvolvimento, o N3 e o Sinval.
- Pelo print de um card com 3 tarefas vencidas: "o prazo estipulado deve contar a partir de que o cliente já tenha resolvido tudo".
- "Ao pausar e colocar enviado para N3 ou Sinval precisa ser colocado o motivo também, sem falta."
- "E se tratássemos essas pausas como tickets em aberto?", que voltam para teste e são fechados ou devolvidos, com mais de um aberto para setores diferentes, e também para o cliente. Ela pediu reflexão e pesquisa antes do ok e depois aprovou: "implemente tudo que você me mandou e sugeriu".

## Feito
- O detalhe técnico completo está em `docs/produto/0*.md` (Atualização 30/10/2026); o texto para o usuário, em `docs/comercial/manual-de-uso-assistente.md` e `novidades-crm.html`; o resumo, em `docs/contexto/ESTADO.md`.
- **Pré-requisitos:** `ImplantacaoTarefaCliente.bloqueia_inicio`. A espera `PRE_REQUISITO` é automática, da assinatura até a entrega do último item. O prazo fica parado ("Prazo não começou") e depois começa do zero. A regra vale para todos os cards por meio da marcação inicial única.
- **Repasse:** modal de pausa com "Repassei para: Desenvolvimento (Sinval) / N3 / Aguardando o cliente", com motivo obrigatório (na tela e no backend). Tipo de espera `N3` novo.
- **Chamados internos:** `ImplantacaoEspera.ticket_id/rodada/fechado_em/fechado_por`, `ticketsDaDemanda`, `POST /implantacoes/chamados/:id/voltou`, lembrete de chamado em teste, lista "Chamados desta demanda" (inclui os chamados do cliente, que são as tarefas do cliente, com `devolucoes`) e o selo "chamado voltou: testar".
- **Relatório "Para onde vai o nosso tempo"** no Painel da gestão: executando x cliente x outros setores, tempo até voltar, taxa de devolução, chamados do cliente e visão por demanda.
- Arquivos: `backend/prisma/schema.prisma`, `backend/src/lib/implantacao/{cronometro,portal}.ts`, `backend/src/routes/implantacao-{cronometro,portal}.ts`, `backend/src/services/implantacao-portal.service.ts`, `frontend/components/implantacao/{Cronometro,Portal}.tsx`, `frontend/lib/api-client.ts` e `backend/tests/implantacao-tempo-esperas.test.ts`. Commit: veja o `git log` de 30/10 ("feat(implantacao): tempo das demandas…").

- **Depois (mesmo dia):** "O Sinval ainda não vai ter link! Será apenas o técnico por enquanto". `SINVAL_RECEBE_CHAMADOS = false` desliga o aviso, o lembrete, o link e o "resolvido" do Sinval; os lembretes de chamado aberto vão ao técnico e à gestão (desenvolvimento e N3).

## Verificado
- `npx vitest run tests/implantacao`: 86 testes ok (11 arquivos), 9 deles novos.
- `npx tsc --noEmit -p . --rootDir .` (backend) e `npx tsc --noEmit -p .` (frontend): sem erro nos arquivos mexidos.
- **Não verificado:** tela no navegador (sem foto), `next build` local (fica a cargo da CI), dados reais de produção (a leitura do banco foi bloqueada pela permissão da sessão) e o deploy (ver Pendente).

## Decisões e porquês
- O repasse interno **não pausa o prazo**: nos sistemas de chamados pesquisados, o relógio só para ao esperar o cliente; a demora interna aparece separada no relatório.
- O nome é **chamado interno**, não "ticket", porque o CRM já tem os tickets do suporte.
- **Tarefas do cliente = chamados do cliente:** reaproveita o que existe (pedido, envio, conferido, "pedir para reenviar") em vez de criar outro tipo.
- **Dois botões ("Voltou e funcionou" / "Voltou com problema") e lembrete após 1 dia útil**, para o técnico não esquecer chamados em teste.
- **Esperas em horas úteis da jornada, execução a qualquer hora:** a Jessica disse "não trave de 8 às 18". Se ela quiser que as esperas também contem fora da jornada, basta trocar `msUteis` pela duração corrida.
- **Pré-requisito como espera desde a assinatura:** soma ao prazo, o que equivale a "começar do zero na entrega" e reaproveita toda a régua de prazo existente.
- Itens que impedem começar por padrão: certificado, equipamento/computador, contador/contabilidade (`PRE_REQUISITO_PADRAO`).

## Pendente
- **Publicar:** backup + os 2 `ALTER TABLE` (no ESTADO.md, entrada de 30/10) + `deploy-vps.sh <hash>`. Depende de a permissão da sessão liberar o acesso à VPS (acesso no arquivo local).
- Depois de publicado: trocar o selo da novidade para "No ar" e conferir na tela um card com pré-requisito pendente.
- Jessica: dizer se quer outros itens marcados como "impede começar" por padrão e se, no futuro, o N3 e o Sinval marcarão a volta pelo próprio login.

## Próxima sessão
- Primeiro passo: conferir se o deploy foi feito (ESTADO.md). Se não foi, rodar o backup, os ALTER e o `deploy-vps.sh` do commit desta tarefa.
- Skills: `run` ou `example-skills:webapp-testing` para a foto da tela; `relatorio-final` ao fechar.
