# 12/11/2026: pedido de "me chama no outro número" se perdia na aprovação

## Pedido
Jessica, com print da conversa Amor e Açúcar: "O que está acontecendo? [...] até agora a Caroline não chamou essa cliente."

## Feito
- Causa: a resposta que prometia chamar no outro número ficou pendente (Laya segurou em 11/11; o Rafael aprovou em 12/11 13h40). Ao aprovar, `decidirMensagem` só enviava o texto; o `novo_contato` não era guardado na pendente, então o número novo nunca era chamado. O 👍 seguinte da cliente foi lido como "só confirmou" (silêncio correto, mas a promessa ficou sem cumprir).
- Commit `b55489f` (`backend/src/services/caroline.service.ts`): `novo_contato` no `acao` das pendentes e execução de `registrarDecisorIndicado` ao aprovar.

## Verificado
- `tsc` sem erro novo; CI verde de `b55489f`.
- Produção (só leitura): nenhum lead para o número novo; pendente `EDITADA` pelo Rafael às 16:40 UTC.
- **Não no ar:** deploy de `ed32f86` parou na trava de banco (tabela da agenda do técnico, de outra sessão).
- Resgate autorizado pela Jessica e feito em 12/11 15h50: mensagem ENVIADA no número novo, lead novo AGUARDANDO.

## Decisões e porquês
- Resgate com a mesma função do código (texto fixo, sem IA, prioridade máxima), para não inventar outro caminho.
- Não liberei a tabela da outra sessão no `PERMITIDO`: decisão dela/da Jessica.

## Pendente
- Jessica: liberar a criação da tabela da agenda do técnico, para o deploy seguir.

## Próxima sessão
Depois do deploy, aprovar uma pendente de teste com `novo_contato` e conferir o lead novo criado com status AGUARDANDO.
