# 23/10/2026: "Caiu a conexão" de novo, causa real achada

## Pedido
A Jessica mandou prints: tela do WhatsApp com "1 de 4 conectados", e o principal e o Número 2 marcados como "Caiu a conexão". Disse: "preciso que ajuste isso e depois busque a raiz do problema, não consigo ficar tranquila sabendo que é o segundo dia que isso acontece".

## Feito
- **Causa raiz (produção, só leitura de logs):**
  - O Ubuntu instala atualizações de segurança sozinho (`unattended-upgrades`) e religa os serviços que usam a biblioteca atualizada, entre eles o `pm2-root`. Isso aconteceu às 06:25 UTC de 22/10 (03h25 em Brasília) e às 06:38 UTC de 23/10 (03h38).
  - O religamento roda `pm2 resurrect`, que usa a foto `~/.pm2/dump.pm2`, salva em 17/10. Nela, o `EVOLUTION_API_URL` ainda é o da conta UAZAPI antiga (`advleticiabarros.uazapi.com`), de antes da troca de 19/10.
  - O `.env` só chega ao processo pelo `ecosystem.config.js`, e o backend não lê o `.env` sozinho. Com isso, o processo falava com a conta antiga, que responde 401 "Invalid token" aos tokens da conta nova. Depois de 15 min de falha, o vigia marcou o principal e o Número 2 como DESCONECTADO.
  - Em 22/10 foi a mesma coisa. O diagnóstico daquele dia ("instabilidade da UAZAPI") estava errado: o deploy das 10h37 (`--update-env`) é que consertou. O relatório de 22/10 ganhou uma nota de correção.
- **Produção:**
  - foto antiga copiada para `/root/backups-deploy/pm2-dump-antes-20261023.pm2`;
  - `pm2 restart ecosystem.config.js --only comercial-backend --update-env` e `pm2 save`.
- **Código:**
  - `backend/src/carregar-env.ts` (primeiro import do `server.ts`) e `backend/src/lib/env-arquivo.ts`: o `.env` prevalece sobre o ambiente do PM2, e o log mostra só os nomes corrigidos.
  - `backend/scripts/deploy-vps.sh`: `pm2 save` depois do restart.
  - Teste: `backend/tests/env-arquivo.test.ts`.
- **Documentos:** os 6 de `docs/produto/`, o manual, as novidades e o `ESTADO.md`.

## Verificado
- Linha do tempo nos logs: nenhum 401 até o religamento de 06:38 UTC; a partir do primeiro segundo depois dele, 401 em todas as consultas. `pm2.log` confirma os religamentos de 22/10 06:25 e 23/10 06:38 UTC, e o `apt/history.log` confirma o `unattended-upgrade` nas mesmas horas.
- `/proc/<pid>/environ` do processo antigo tinha a conta antiga; o `.env` tinha a nova. Depois do restart, o processo ficou com `prosystemnet.uazapi.com`.
- Testes: `env-arquivo` e `whatsapp-status-falha`, 9 de 9. O `tsc` não deu erro nos arquivos novos.
- **Não verificado:**
  - o log do vigia depois do restart e o banco com os números de volta a CONECTADO (a proteção automática bloqueou novas leituras da produção);
  - o conteúdo da foto nova do PM2;
  - o deploy deste commit.

## Decisões e porquês
- O `.env` é a fonte única, mesmo com o processo vindo do `resurrect`, porque assim nenhuma foto velha volta a mandar. O `pm2 save` no deploy é uma segunda proteção.
- O `unattended-upgrades` ficou ligado: são atualizações de segurança. O problema era a foto velha, não o religamento.
- A tolerância de 15 min e o vigia de 22/10 continuam no código.

## Pendente
- Conferir na tela ou no log `[WPP] Vigia: "empresa" DESCONECTADO → CONECTADO` e fazer o deploy deste commit com `deploy-vps.sh`.
- Os avisos de lead qualificado das 03h38 até a correção não saíram (401).
- Número 4: decisão da Jessica, a mesma de 19/10.

## Próxima sessão
- Rodar `backend/scripts/deploy-vps.sh <commit>`. Depois, procurar `[BOOT] .env:` e `Vigia:` em `/root/.pm2/logs/comercial-backend-out.log`.
- Skill sugerida: `diagnosing-bugs`.
