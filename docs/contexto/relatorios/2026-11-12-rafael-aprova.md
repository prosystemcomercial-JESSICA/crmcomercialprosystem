# 12/11/2026: o Rafael aprova as mensagens no lugar da Jessica

## Pedido
"Não deixe mais caroline esperando minhas aprovações, peça para o Rafael fazer isso! Em no maximo 2 minutos por conversa, isso esta atrasando nossa operação."

## Feito
- Commit `832f584`: `backend/src/services/rafael-aprovador.service.ts` (decisão do Rafael por IA), `backend/src/lib/assistente/rafael-aprovador.ts` (regras puras), ligação no motor (`caroline.service.ts`: chama o Rafael 3 s depois de cada mensagem pendente; mensagem segurada pela Laya guarda `fase`; aviso "cliente sem resposta" só depois de 3 min pendente) e rodada a cada 30 s em `server.ts`. Documentos de produto, manual e novidades atualizados no mesmo commit.
- Commit seguinte (este relatório): mensagem cujo envio falha (ex.: número do contato desconectado) espera 10 min antes de nova tentativa, para não gastar IA a cada 30 s.
- Regras detalhadas: entrada de 12/11 em `docs/contexto/ESTADO.md`.

## Verificado
- `tests/rafael-aprovador.test.ts` (5) e `tests/laya-guardia.test.ts` (4) passando; `tsc` sem erro novo nos arquivos mudados (o erro da linha ~991 de `caroline.service.ts`, `demo_a_partir`, já existia).
- CI verde de `832f584` (a primeira rodada foi cancelada por push de outra sessão; rodada de novo).
- Deploy de `7af09f9` (contém `832f584`) com backup, banco sem alterações, backend 401 sem login, frontend ok.
- Produção logo depois: 4 mensagens já decididas pelo Rafael (pedidos de reescrita), 16 pendentes (a mais antiga de 11/11), nenhuma de proposta/preço. Log mostrou envio recusado porque o "Número 4 (API gratuita)" estava desconectado.
- O ajuste de espera de 10 min: testado só localmente (tipos), deploy feito junto com este relatório (ver ESTADO).
- **Não verificado:** a qualidade das decisões do Rafael em volume; o tempo real até a decisão em horário de pico.

## Decisões e porquês
- Vale para os 3 SDRs (mesmo motor da Caroline), porque o atraso é o mesmo.
- Autorização de proposta/preço da campanha continua com a Jessica: é decisão comercial com botões no WhatsApp dela, e liberar desconto sozinho é arriscado. Se ela quiser, dá para passar ao Rafael também.
- Se a IA do Rafael não responder em 2 min, a mensagem não fica parada: defeito objetivo vai para reescrita, o resto sai (a mensagem já passou pela Laya ou é só o portão de aprovação).
- Limite de 2 reescritas por conversa em 6 h, para não entrar em laço de IA.
- Envio de primeiro contato/retomada aprovado: 1 por minuto (proteção do número; a fila antiga de 11/11 não sai toda de uma vez).
- A Jessica ainda pode decidir pelo painel antes do Rafael.
- Commit montado com índice temporário: as mudanças da outra sessão (lojas novas do Heitor, Joana, e-mail de descadastro) continuam só na pasta de trabalho.

## Pendente
- Jessica: reconectar o "Número 4 (API gratuita)"; conversas presas a ele não enviam nada.
- Jessica: dizer se a autorização de proposta/preço também deve passar ao Rafael.
- Acompanhar no Escritório › ações do Rafael se as correções estão boas.

## Próxima sessão
Consultar em produção `SdrMensagem` com `decidido_por = 'rafael'` (status e tempo entre `created_at` e `decidido_em`) e ler alguns textos editados. Skills: `diagnosing-bugs` se algo travar.
