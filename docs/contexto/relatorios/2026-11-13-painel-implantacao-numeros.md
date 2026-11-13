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

## Pendente
- **Jessica:** decidir se as 11 implantações antigas sem conclusão devem ser encerradas no CRM. Elas não aparecem mais no painel, mas continuam abertas no banco.

## Próxima sessão
- Se ela pedir para encerrar as antigas: listar as 11 com a query `concluida_fila_em IS NULL AND data_conclusao IS NULL AND data_assinatura < INICIO_PORTAL AND status <> 'CANCELADA'`, mostrar para ela e só então marcar a conclusão.
