# 12/11/2026: prioridade de atendimento definida pela Laya

## 1. Pedido

A Jessica mostrou duas conversas em que o cliente respondeu com interesse e a Caroline não deu retorno (Amor e Açúcar, que pediu para ser chamada em outro número, e Marcilene, que respondeu "Sim / Data sistema"). Pediu: "atendimentos de prioridade" (campanha/página = prioridade; interesse com outro contato = prioridade máxima), "quem define a prioridade é a Laya", resposta em 1 a 2 minutos e conversa "de igual para igual", ouvindo o cliente e entendendo as dores da empresa.

## 2. Feito

Descrição completa em `docs/produto/01-PRD.md` (seção "Atualização 12/11/2026: prioridade de atendimento definida pela Laya") e no ESTADO.md. Resumo:

- Regras puras da prioridade: `backend/src/lib/assistente/prioridade-conversa.ts`.
- `backend/src/services/caroline.service.ts`: `marcarPrioridade` (só sobe), `avisarSemResposta` (vigia de 2 minutos), descarte de mensagem pendente velha, liberação da resposta reescrita quando a Laya reprova por nota, chamada na hora do outro número do mesmo cliente, prioridade Alta para lead de formulário, busca de respostas atrasadas ordenada da mais recente.
- `backend/src/lib/assistente/sdr.ts`: regras "pediu para ser chamado em outro número" e "conversa de igual para igual" no roteiro; campo `novo_contato.mesma_pessoa`; linha na ficha do lead.
- `backend/src/services/laya-cerebro.service.ts`: falas curtas não vão para o julgamento de robô.
- Nível Alta: `whatsapp-sla.service.ts`, `routes/whatsapp.ts`, `frontend/app/whatsapp/page.tsx` ("Crítica" passou a se chamar "Máxima" na tela).

## 3. Verificado

- Consulta de leitura em produção (autorizada pela Jessica): Amor e Açúcar com mensagem `PENDENTE` segurada pela Laya (nota 3/10); Marcilene marcada como `interlocutor: robo`; 18 conversas em `CONVERSANDO` esperando o agente, 14 delas com 4 pedidos de socorro (16/10 a 11/11) e 4 com mensagem pendente desde 11/11; 11 mensagens `PENDENTE` no total; os três agentes ligados e sem aprovação obrigatória.
- Testes: `tests/prioridade-conversa.test.ts` e os 19 arquivos `sdr-*`/`laya*` passaram (129 testes).
- Tipos: backend sem erro novo nos arquivos alterados (os dois erros que aparecem em `caroline.service.ts` linha do `demo_a_partir` e `routes/whatsapp.ts` 1616 já existiam); frontend sem erros.
- Não verificado: o comportamento em conversa real depois do deploy (a regra nova do roteiro depende da IA) e o envio real para um "outro número".

## 4. Decisões e porquês

- A prioridade pela fala usa regras fixas, sem chamada de IA: decide no segundo em que a mensagem chega e não falha. A nota da conversa (IA) complementa depois.
- Reprovação da Laya por nota não segura mais resposta a cliente; defeito objetivo continua segurando. Motivo: o cliente esperando calado custa mais que uma resposta nota 5.
- O outro número é chamado com texto fixo, sem IA, para sair na hora e no contexto. Entra no mesmo lead para não duplicar.
- Falas curtas nunca são robô: saudação automática de loja é texto comprido, e as curtas conhecidas já estão nas regras fixas.
- A lista de conversas não foi reordenada por prioridade (mexeria numa tela grande; a conversa que recebe mensagem já sobe).

## 5. Pendente (com a Jessica)

- Assumir à mão as conversas da Amor e Açúcar e da Marcilene: a correção não reenvia nada para elas.
- Decidir o que fazer com as 14 conversas antigas travadas e com as 11 mensagens em "Para você aprovar".

## 6. Próxima sessão

Conferir no log do servidor (`[CAROLINE]`, `[AGENTES]`) e no Escritório se a Laya está marcando prioridade e se os avisos "🚨 Prioridade máxima" chegam; rodar de novo a consulta de conversas esperando resposta. Skills: `superpowers:systematic-debugging` se algum cliente voltar a ficar sem retorno.
