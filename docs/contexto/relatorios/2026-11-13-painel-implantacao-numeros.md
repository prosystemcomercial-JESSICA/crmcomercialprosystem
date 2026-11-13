# 13/11/2026 — Painel da implantação: números iguais aos do quadro

## Pedido
A Jessica mandou um print do Painel da implantação, com os Indicadores do mês todos em "—" e "Prazo estourado 12", e perguntou: "Esses indicadores no painel de implantação não estão funcionando?". Depois do diagnóstico, pediu: "CORRIJA O QUE PRECISAR".

## Feito
- **Indicadores do mês (`GET /implantacoes/indicadores`):** não houve mudança, porque estavam certos. Desde 02/10/2026 entraram só 2 implantações: a de banco zerado, assinada em 26/10, e o contrato 56/2026, assinado em 12/11. Nenhuma das duas teve a loja virada e não há conclusão nem pesquisa no mês, por isso aparece "—".
- **Bloco de baixo (`GET /implantacoes/painel`, `backend/src/routes/implantacao-portal.ts`):**
  - Antes, o bloco contava 11 implantações antigas, assinadas antes de 02/10. Elas estão fora do quadro (`coluna` NULL) e nunca receberam `concluida_fila_em` nem `data_conclusao`; 9 estão em AGUARDANDO_INSTALACAO e 2 em INSTALADO. Era isso que inflava "Prazo estourado".
  - Agora as contas de ativas/SLA, esperas, viradas do período, cobranças a lançar e prazo médio usam `data_assinatura >= INICIO_PORTAL`, a mesma regra de `ehLegado` usada pelo quadro.
  - A situação do prazo passou a usar `slaDaDemanda`, a mesma função do card, que desconta a espera do cliente. Antes, o painel usava `situacaoSla` com o prazo sem esse desconto.
  - As horas e o aproveitamento dos técnicos continuam contando todas as sessões do cronômetro.
- Documentos atualizados: os 6 de `docs/produto/`, o manual, o arquivo de novidades e o `ESTADO.md`.

## Verificado
- `npx tsc --noEmit -p . --rootDir .`: nenhum erro em `implantacao-portal.ts`.
- `npx vitest run tests/implantacao`: 12 arquivos e 90 testes, todos ok.
- Consulta em produção (só leitura) antes da correção: as 11 antigas entravam como ativas.
- Simulação com o filtro novo: ficam 3 demandas ativas (o serviço de 08/10 e as duas implantações). As esperas da semana continuam as mesmas (7 do cliente, contando os pré-requisitos), porque todas são de demandas novas.
- Situação final dos cartões depois do deploy: ver o resultado registrado no ESTADO.md. Não verificado na tela.

## Decisões e porquês
- Escolhi o filtro por data, e não "coluna preenchida", porque é a mesma regra do quadro (`ehLegado`) e dos Indicadores do mês.
- Nenhum dado foi alterado. As 11 antigas continuam no banco e no CRM, porque a regra do projeto é nunca apagar e marcar a conclusão delas depende de a Jessica confirmar quais terminaram.

## Publicado e concluído depois
- No ar com o deploy de `794d3df`, que contém `e69bd03`: CI verde, backup feito, banco sem mudança de estrutura e sem erro no log.
- **As 11 antigas foram concluídas** a pedido da Jessica ("todas já foram concluídas há tempos, pode apenas concluir com a data de 30 dias depois da assinatura"):
  - Feito direto no banco de produção. `data_conclusao` e `concluida_fila_em` ficaram com a data de assinatura + 30 dias; `etapa_execucao` e `coluna` foram para FINALIZADO e `status` para INSTALADO.
  - Cada uma ganhou uma nota MUDANCA_ETAPA no histórico.
  - Backup das linhas antes da mudança: `/root/backups/implantacoes-antigas-antes-concluir-20261113.sql`, na VPS.
  - Conferido: 11 atualizadas e 0 antigas ainda abertas.
  - Nenhum agendador reage a `INSTALADO` ou `FINALIZADO` (conferido no código), então nenhuma mensagem foi enviada a clientes.

## Pendente
- Nada.

## Próxima sessão
- Abrir o Painel da implantação e conferir na tela os cartões de prazo. Ainda não foi verificado.
