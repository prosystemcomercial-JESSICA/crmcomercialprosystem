# 23/11/2026 · Trava do laço de repetição (Laya + Caroline)

## Pedido
A Jessica mostrou o quadro da Caroline "Com erro" e perguntou o que estava acontecendo e "por que tantas falhas?" (também no quadro do Luiz Felipe). Depois pediu: "se a Laya segurar a mesma conversa por repetição 2 ou 3 vezes, a Caroline para de escrever nela até o cliente mandar uma mensagem nova… corrija e ensine a Laya e a Caroline".

## Feito
- Diagnóstico com leitura em produção (scripts temporários, já apagados): pausa da Vitória até 25/11 9h16; 410 mensagens descartadas de 16 a 18/11, 388 por repetição, em 27 conversas (duas com 218 e 96). Causa: a rodada de respostas atrasadas (`rodarCaroline`, a cada 2 min) chamava `falar` de novo em toda rodada, porque a mensagem segurada não muda `ultima_caroline_em`; a Laya segurava, o Rafael descartava e o ciclo recomeçava.
- Trava em `falar` (`backend/src/services/caroline.service.ts`): 2 seguradas por repetição desde a última fala do cliente → `nada`, `dados.parou_repeticao`, `ultima_caroline_em = agora` (AGUARDANDO fora da fase de resposta), ORIENTACAO da Laya para o agente, aviso único à gestão com link.
- Ensino: reescrita da Laya cita as falas repetidas (`falasRepetidas`); prompt mostra as versões descartadas por qualquer pessoa com o motivo da Laya.
- Regras puras e testes: `backend/src/lib/laya-guardia.ts`, `backend/tests/laya-guardia.test.ts`. Texto do mural do Rafael ajustado.
- Documentos: os 6 de `docs/produto/`, manual, novidades e `ESTADO.md`.

## Verificado
- vitest `laya-guardia` e `rafael-aprovador`: 20/20.
- `tsc` do backend: nenhum erro novo nos arquivos mexidos (só o antigo `demo_a_partir`).
- Deploy e comportamento em produção: ver o commit e o ESTADO.md. A trava em si só será vista em ação quando houver nova repetição (não verificado com caso real).

## Decisões e porquês
- Limite 2 (não 3): com 2 a Laya já pediu uma reescrita e ela voltou repetida; a 3ª só gastava IA.
- A contagem é por conversa (não por lead do agente) e zera com mensagem nova do cliente, como ela pediu.
- Gestão avisada uma vez por fala do cliente, para o cliente não ficar sem ninguém (regra de 16/10: conversa não fica sem continuidade).
- Commit montado só com os trechos desta tarefa: a outra sessão tem mudanças não commitadas (Heitor, Joana, `loja_nova` no `caroline.service.ts`, documentos).

## Pendente
- Jessica: decidir se religa a Caroline antes de 25/11 (a pausa da Vitória foi mantida).
- Luiz Felipe sem trabalho há 7 dias (0 propostas para follow-up): só observar.

## Próxima sessão
Conferir no Escritório se aparece a ação "parou de escrever… a Laya segurou 2 mensagens repetidas" e se as descartadas por repetição caíram. Skills: `graphify`, `diagnosing-bugs`.
