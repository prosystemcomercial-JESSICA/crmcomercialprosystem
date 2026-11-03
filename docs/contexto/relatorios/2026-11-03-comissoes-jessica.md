# 03/11/2026 · Comissões da Jessica: relatório e baixa como paga

## Pedido
A Jessica pediu primeiro para "montar o que eu vou receber": as instalações e os serviços com 15% de venda e 5% de supervisão, o Pacote Fiscal (R$ 50) e duas indicações Imendes (R$ 50 cada), além de um "relatório personalizado para o pagamento". Depois pediu: "dê baixa em toda essa comissão, deixe como paga, e inclua também no centro de custos como paga". Ela vai mandar os meses anteriores.

## Feito
- Relatório de pagamento publicado em https://claude.ai/artifact/9x7aN6WaASY5jicM9C4Rpb, com o total de R$ 1.396,00 e o selo "PAGO em 03/11/2026". Ele é compartilhado por link.
- Produção (banco MySQL, usuário `Jessica Cardoso`), feito depois do backup `/root/backups/comissoes-baixa-2026-11-03-193417.sql`:
  - 13 comissões existentes passaram para `estagio`/`status` PAGA, com `mes_pagamento` 2026-11 e `paga_em` igual a agora.
  - A venda do upgrade da Prime estava em R$ 50 fixos e foi corrigida para 15% de R$ 350, ou seja, R$ 52,50.
  - 4 comissões `MANUAL` foram criadas já pagas (`created_by = claude-pedido-jessica`): Wellison, com venda de R$ 105 e supervisão de R$ 35, e as indicações Imendes de São Geraldo e Araguaína 6, com R$ 50 cada.
  - O centro de custos recebeu 17 lançamentos `SAIDA/COMISSAO`, competência 11/2026, com `origem_tipo=COMISSAO` e `origem_id` da comissão, o que impede que a sincronização automática os duplique.
- Detalhes no `docs/contexto/ESTADO.md` (entrada de 03/11/2026).

## Verificado
- Depois do commit da transação, as comissões pagas hoje somam 17 registros e R$ 1.396,00, e os lançamentos criados também somam 17 registros e R$ 1.396,00.
- A primeira tentativa falhou por um erro de collation e não chegou ao COMMIT. Foi conferido que nada tinha sido gravado antes de rodar de novo.
- Não foi verificado na tela do CRM, nas páginas de Comissões e Centro de Custos.

## Decisões e porquês
- Os itens que já existiam no CRM foram reaproveitados, em vez de criar duplicados. Só foram criados os 4 que não existiam.
- A competência no centro de custos é 11/2026, o mês do pagamento. A sincronização do sistema usaria o `periodo` da comissão (08 a 11/2026). Foi escolhida a data do pagamento porque a Jessica pediu os lançamentos "como pagos".
- A Prime foi corrigida para R$ 52,50, que é o valor do relatório aprovado por ela.

## Pendente
- **Jessica:** mandar os meses anteriores para dar baixa.
- **Técnico:** o centro de custos não tem saídas de comissão desde 08/2026. É preciso investigar por que `sincronizarLancamentosDeComissao` (`backend/src/lib/comissao-fluxo.ts`) não está gerando os lançamentos.
- **Técnico:** o lote "relatório outubro/2026" (12 comissões pagas, R$ 710,20) está no usuário `Jessica Supervisao`, separado do `Jessica Cardoso`, e não aparece no centro de custos. É preciso decidir se ele deve ser unificado.

## Próxima sessão
Quando a Jessica mandar os meses anteriores, siga o mesmo caminho:
1. Ler as comissões do usuário `d99bc07f-…` que batem com a lista.
2. Fazer backup.
3. Marcar PAGA e criar só as que faltam.
4. Lançar no centro de custos com `origem_id`.

Use literais em vez de variáveis `@` no MySQL, por causa do erro de collation. Skills: `relatorio-final`.
