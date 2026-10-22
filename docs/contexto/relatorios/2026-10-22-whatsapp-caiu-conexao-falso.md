# 22/10/2026: números "Caiu a conexão" com a UAZAPI conectada

## Pedido
A Jessica mandou dois prints: o painel da UAZAPI mostrava "Comercial 1" (principal, final 1370) e "Comercial 2" (Número 2, final 8103) como `connected`, mas a tela do WhatsApp do CRM dizia "1 de 4 conectados" e "O WhatsApp da empresa está desconectado". Pedido: "investigue o que está acontecendo agora, e corrija para que não aconteça novamente". Ela também pediu os horários em Brasília.

## Feito
- **Causa (produção):** das 10h06 às 10h17 (Brasília), a UAZAPI respondeu `401 Invalid token` ao `GET /instance/status` e ao `/send/text` com os tokens certos (os mesmos que davam `connected` até 21/10 e de novo às 10h25). O `obterStatus` tratava qualquer erro como DESCONECTADO e gravava no banco. Efeito: envio bloqueado para os contatos desses números (`decidirInstanciaEnvio`), números fora do rodízio e avisos de lead qualificado perdidos. A vaga extra (Número 2) só se corrigia quando alguém abria Configurações › Números.
- **Correção:** veja a seção "Correção 22/10/2026" em `docs/produto/02-TRD.md` e o registro em `docs/contexto/ESTADO.md`. Resumo:
  - nova tentativa, tempo limite e `falhaApi` com tolerância de 15 min (`backend/src/lib/whatsapp-status.ts`, `backend/src/services/evolution.service.ts`, `whatsapp-gratis.service.ts`);
  - as rotas e o webhook de conexão mantêm o último status (`backend/src/routes/whatsapp.ts`);
  - vigia a cada 5 min (`backend/src/services/whatsapp-conexao.service.ts`, ligado no `server.ts`).
- Documentos: os 6 de `docs/produto/`, `docs/comercial/manual-de-uso-assistente.md` e `docs/comercial/novidades-crm.html`.

## Verificado
- Em produção, só leitura: no banco, `empresa` e `uazapi-2` estavam DESCONECTADO (atualizados às 10h06 e 10h14). Uma consulta direta às 10h25, com os mesmos tokens e na conta `prosystemnet`, respondeu `200 connected` para os dois. Os webhooks de entrada seguiram aceitos (sem "token não confere" depois de 19/10).
- `tests/whatsapp-status-falha.test.ts`: 7 testes passando. Os testes de WhatsApp existentes também passam.
- A suíte completa tem 5 falhas, as mesmas que aparecem sem esta mudança (auth, backup, candidatos, health-score, previsão: dependem do banco local).
- `tsc`: nenhum erro novo nos arquivos mudados. 5 erros antigos de `whatsapp.ts` sumiram.
- Deploy e status em produção depois do deploy: veja "Publicação" abaixo.

## Decisões e porquês
- A tolerância é de 15 min e não infinita: se o token for apagado de verdade, o número precisa aparecer como caído em algum momento.
- O controle da falha fica em memória, sem mudar o banco. Ao reiniciar o backend, ele zera; no pior caso, isso atrasa o "desconectado" em 15 min.
- Desconexão informada pela própria API (`disconnected`) continua valendo na hora.
- O tempo limite de 20 s vale só para a consulta de status. O envio de mensagens não mudou, para não arriscar envio em dobro.
- A causa do lado da UAZAPI (por que ela recusou tokens válidos) não dá para ver daqui. Se voltar a acontecer, vale abrir chamado com eles, informando o horário.

## Pendente
- Jessica (desde 19/10): o Número 4 (API gratuita) usa o mesmo celular do Número 2 e está desconectado de verdade. Ela decide se as 53 conversas dele passam para o Número 2 e se a vaga é liberada.
- Avisos de lead qualificado das 10h06 às 10h17 não saíram (401). Os leads estão no CRM, mas o aviso no WhatsApp não chegou.

## Próxima sessão
- Se reaparecer "Caiu a conexão", procure `[WPP] Vigia:` e `obterStatus ERRO` em `/root/.pm2/logs/comercial-backend-out.log`.
- Skill sugerida: `diagnosing-bugs`.

## Publicação
- `ec0526f` publicado em 22/10, com backup do banco (378 MB, sem alteração no banco), build ok, backend e frontend no ar.
- Conferido em produção: no log, `[BOOT] Vigia das conexões do WhatsApp iniciado` e, 30 s depois, `Vigia: "empresa" DESCONECTADO → CONECTADO` e `"uazapi-2" DESCONECTADO → CONECTADO`. No banco: principal, Número 2 e Número 3 conectados; Número 4 desconectado (esperado).
