# Backup do CRM Comercial: como funciona e como restaurar

Refeito em 23/11/2026, a pedido da Jessica: "dados reais, preciso que sejam de fato feitos sem nenhum problema nunca".

## O que havia de errado (achado em 23/11/2026)

- Desde **23/10/2026, 14h**, todo backup diário saía **sem as mensagens do WhatsApp** (`WhatsappMensagem`, mais de 600 MB de fotos e PDFs em base64): a tabela inteira não cabia numa leitura só ("Failed to convert rust String into napi string"). O log dizia "OK — 1 erros".
- A cópia "no MEGA" **nunca foi para a nuvem**: o MEGAsync do computador da Jessica só sincroniza a pasta `legal_hub`; a pasta `C:\Users\prosy\MEGA\backup-crm-comercial` (19 GB) ficava só no disco do computador.
- A cópia no computador parou em 19/11: a tarefa do Windows chamava um `.bat` de uma pasta antiga (`Documents\crmcomercialprosystem`), com senha, limite de 30 min e bloqueio na bateria.
- O backup do deploy não conferia o `mysqldump` (sem `pipefail`): um dump quebrado não impedia o deploy.
- Cópia completa de emergência feita e conferida em 23/11/2026, 12h17 (UTC): `/root/backups-deploy/emergencia-completo-20261123-121657.sql.gz` (480 MB, 113 tabelas).

## Como funciona agora

| Onde | O quê | Quando | Guarda |
|---|---|---|---|
| Servidor `/var/backups-comercial/<carimbo>/` | `banco-completo.sql.gz` (mysqldump inteiro, foto única) + `.sha256`, JSON de cada tabela, `_arquivos-clientes.tar.gz`, `_ok` | 3h e 14h (Brasília), cron `0 6,17 * * *` | 7 dias (nunca menos de 10 backups bons) |
| Servidor (Docker) | **Teste de restauração**: MySQL descartável, sem rede, carrega o dump e compara as linhas de cada tabela | 1 vez por dia (3h) | resultado em `_restauracao.txt` |
| MEGA, pasta `Backups CRM Comercial` | dump + sha256 + arquivos dos clientes + `_resumo.json`, enviados **pelo servidor** (rclone, destino `mega:`) e conferidos pelo tamanho | depois de cada backup bom | 10 dias (nunca menos de 6) |
| Computador da Jessica `C:\Users\prosy\backups-crm-comercial` | cópia extra: dump + sha256 conferido | tarefa das 17h e no logon | 14 backups |
| Servidor `/root/backups-deploy/` | dump antes de cada deploy (agora conferido; sem backup bom, nada é publicado) | a cada deploy | sem limpeza automática |

Scripts (em `backend/scripts/`): `backup-servidor.sh` (principal), `backup-diario.cjs` (JSON em lotes), `backup-testar-restauracao.sh`, `backup-nuvem-mega.sh`, `backup-configurar-mega.sh` (liga o MEGA, uma vez), `backup-instalar.sh` (aponta o cron para o repositório), `sync-backup-vps.py` + `backup-diario.bat` (cópia no computador).

Situação de cada execução: `/var/backups-comercial-status/servidor.json`. O **vigia** (`backend/src/services/backup-monitor.service.ts`, a cada hora) avisa a gestão no WhatsApp se: o último backup bom tiver mais de 13 h; a última execução falhar; o teste de restauração falhar ou parar por mais de 30 h; o MEGA estiver desligado, sem envio há mais de 30 h ou com menos de 3 GB livres; o disco do servidor passar de 85%; a cópia do computador parar por mais de 7 dias.

Log: `/var/log/backup-comercial.log`. Rodar à mão (no servidor): `/usr/local/bin/backup-comercial.sh` ou, com teste de restauração, `TESTAR_RESTAURACAO=1 bash /var/www/comercial-prosystem/backend/scripts/backup-servidor.sh`.

## Restaurar (emergência)

1. Escolher o backup: o mais novo com `_ok` em `/var/backups-comercial/` (ou baixar do MEGA, ou pegar no computador da Jessica).
2. Conferir: `cd <pasta> && sha256sum -c banco-completo.sql.gz.sha256`.
3. **Antes de tudo, um backup do estado atual** (`/usr/local/bin/backup-comercial.sh`), parar o backend (`pm2 stop comercial-backend`).
4. Restaurar num banco novo e conferir antes de trocar: criar o banco (precisa do usuário administrador do MySQL), depois `zcat banco-completo.sql.gz | mysql -u<usuario> <banco_novo>`; conferir contagens; só então apontar o `DATABASE_URL` ou renomear.
5. Restaurar só uma tabela: extrair o trecho dela do dump (`zcat ... | sed -n '/^-- Table structure for table `X`/,/^-- Table structure for table/p'`) ou usar o `X.json` da mesma pasta.
6. Arquivos dos clientes: `tar -xzf _arquivos-clientes.tar.gz -C /root/`.
7. Religar (`pm2 start comercial-backend`) e conferir o site.

Nunca restaurar por cima do banco de produção sem a autorização da Jessica.
