#!/bin/bash
# Instala (ou reinstala) o backup do servidor (23/11/2026). Rodar no servidor, como root:
#   bash /var/www/comercial-prosystem/backend/scripts/backup-instalar.sh
# O cron já existente (0 6,17 * * *) chama /usr/local/bin/backup-comercial.sh, que passa a apontar para os
# scripts do repositório (atualizados a cada deploy). Sem senhas aqui: o banco vem do .env do app.
set -Eeuo pipefail
DIR=/var/www/comercial-prosystem/backend/scripts
[ -f /usr/local/bin/backup-comercial.sh ] && cp /usr/local/bin/backup-comercial.sh "/root/backup-comercial.sh.antes-$(date +%Y%m%d)" 2>/dev/null || true
cat > /usr/local/bin/backup-comercial.sh <<EOF
#!/bin/bash
# Backup do CRM Comercial: ver $DIR/backup-servidor.sh
exec /bin/bash $DIR/backup-servidor.sh >> /var/log/backup-comercial.log 2>&1
EOF
chmod 700 /usr/local/bin/backup-comercial.sh
chmod 700 /root/backup-comercial.sh.antes-* 2>/dev/null || true
crontab -l | grep -q '/usr/local/bin/backup-comercial.sh' || { (crontab -l; echo '0 6,17 * * * /usr/local/bin/backup-comercial.sh') | crontab -; }
chmod 700 /var/backups-comercial /var/backups-comercial-status 2>/dev/null || true
docker image inspect mysql:8.0 >/dev/null 2>&1 || docker pull -q mysql:8.0
echo "instalado: cron -> /usr/local/bin/backup-comercial.sh -> $DIR/backup-servidor.sh"
