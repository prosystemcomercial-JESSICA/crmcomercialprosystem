# 23/11/2026: backup do CRM refeito (completo, conferido, restaurado todo dia, MEGA pelo servidor)

## Pedido
Jessica: "Verifique como está o backup do sistema, preciso que não dê mais erro, se trata de dados reais, então preciso que sejam de fato feitos sem nenhum problema nunca. Sua missão é deixar isso completo."

## Feito
- Diagnóstico completo e tudo o que mudou: entrada de 23/11 em `docs/contexto/ESTADO.md` e guia em `docs/contexto/backup.md` (como funciona e como restaurar).
- Resumo dos achados: backup diário sem `WhatsappMensagem` desde 23/10 (estouro de string do Prisma); MEGA nunca enviou nada para a nuvem (MEGAsync só sincroniza `legal_hub`); cópia no PC parada desde 19/11 (tarefa do Windows apontando para pasta antiga, com senha); deploy sem conferir o dump.
- Dump de emergência conferido: `/root/backups-deploy/emergencia-completo-20261123-121657.sql.gz`.
- Código novo/alterado em `backend/scripts/` (`backup-servidor.sh`, `backup-diario.cjs`, `backup-testar-restauracao.sh`, `backup-nuvem-mega.sh`, `backup-configurar-mega.sh`, `backup-instalar.sh`, `sync-backup-vps.py`, `backup-diario.bat`, `deploy-vps.sh`; removido `copiar-backup-mega.ps1`), vigia `backend/src/services/backup-monitor.service.ts`, teste `backend/tests/backup-vigia.test.ts`.
- Computador da Jessica: tarefas `CRM_Backup_Diario_17h` e `CRM_Backup_Diario_Logon` apontam para `C:\Users\prosy\crmcomercialprosystem\backend\scripts\backup-diario.bat` (3 h de limite, funciona na bateria, gatilho de logon refeito).

## Verificado
- Execução completa do `backup-servidor.sh` no servidor numa pasta isolada (`/root/teste-backup`), com teste de restauração: 113 tabelas, 36.803 linhas restauradas iguais ao JSON, 6.162 mensagens de WhatsApp; saída 0; contêiner de teste removido.
- `tests/backup-vigia.test.ts` 7/7; `tsc` sem erros nos arquivos mexidos; `bash -n` em todos os scripts.
- Instalação no servidor, primeira execução real e cópia no PC: ver o fim deste relatório (atualizado após o deploy).

## Decisões e porquês
- O arquivo de restauração é o **mysqldump** (foto única, restaurável); o JSON fica como segunda via legível.
- Teste de restauração num MySQL descartável no Docker (sem rede, em memória): o usuário do app só tem acesso ao `db_comercial` e não se mexe no banco de produção.
- Nuvem = **MEGA direto do servidor** (escolha da Jessica), via rclone; não depende do PC ligado.
- Retenção: servidor 7 dias (cada backup tem ~1,2 GB) com mínimo de 10 bons; MEGA 10 dias (~5 GB de 20 GB); PC 14 dumps. Nada antigo é apagado se o backup do dia falhar.
- O PC baixa só o dump conferido (sha256), não o JSON de ~700 MB.

## Pendente
- **Jessica:** preencher `C:\Users\prosy\mega-backup.env` (MEGA_EMAIL e MEGA_SENHA; sem verificação em duas etapas na conta, ou o rclone não entra). Depois: copiar para `/root/segredos/mega.env` e rodar `bash /var/www/comercial-prosystem/backend/scripts/backup-configurar-mega.sh`. Até lá o vigia avisa "nuvem desligada".
- **Jessica decide:** limpeza de `/root/backups-deploy` (58 GB, sem retenção; disco 52%).
- A pasta local `C:\Users\prosy\MEGA\backup-crm-comercial` (19 GB, nunca sincronizada) não foi apagada.

## Próxima sessão
Conferir `/var/backups-comercial-status/servidor.json` e `tail /var/log/backup-comercial.log` no servidor; se o MEGA ainda estiver desligado, pedir o arquivo à Jessica e rodar `backup-configurar-mega.sh`, depois `/usr/local/bin/backup-comercial.sh` para o primeiro envio.
