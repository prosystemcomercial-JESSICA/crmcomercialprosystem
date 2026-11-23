@echo off
rem Copia extra dos backups do servidor neste computador (tarefas do Windows CRM_Backup_Diario_17h e _Logon).
rem Sem senha: entra no servidor com a chave SSH %USERPROFILE%\.ssh\crm_comercial_vps. Log em %USERPROFILE%\backups-crm-comercial.log
cd /d "%~dp0"
echo ===== %date% %time% >> "%USERPROFILE%\backups-crm-comercial.log"
python sync-backup-vps.py >> "%USERPROFILE%\backups-crm-comercial.log" 2>&1
