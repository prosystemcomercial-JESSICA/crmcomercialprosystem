#!/bin/bash
# Deploy do CRM Comercial na VPS (roda NO SERVIDOR): bash /root/deploy-vps.sh <commit>
# Backup do banco → git pull → confere o commit → prisma generate → confere o diff do banco contra PERMITIDO
# (vazio = nenhuma mudança de banco aceita) → build do frontend → pm2 restart → confere site e API.
# Sem senhas aqui: as credenciais vêm do .env do servidor. Copiar com: scp -i ~/.ssh/crm_comercial_vps backend/scripts/deploy-vps.sh root@comercial.prosystemnet.com:/root/
set -e
RELEASE="${1:?Informe o commit a publicar (ex.: 93e3bb8)}"
PERMITIDO=''
cd /var/www/comercial-prosystem/backend
URL=$(grep -E '^DATABASE_URL' .env | head -1 | cut -d= -f2- | tr -d '"'"'"' ')
eval $(python3 - "$URL" <<'P'
import sys,urllib.parse as u
p=u.urlparse(sys.argv[1])
print(f"DBU='{u.unquote(p.username)}' DBP='{u.unquote(p.password)}' DBH='{p.hostname}' DBPT='{p.port or 3306}' DBN='{p.path[1:].split('?')[0]}'")
P
)
export MYSQL_PWD="$DBP"
TS=$(date +%Y%m%d-%H%M%S)
mysqldump -u"$DBU" -h"$DBH" -P"$DBPT" --no-tablespaces --single-transaction "$DBN" | gzip > /root/backups-deploy/pre-deploy-$TS.sql.gz
echo "backup: $(ls -lh /root/backups-deploy/pre-deploy-$TS.sql.gz | awk '{print $5}')"
cd /var/www/comercial-prosystem
git pull --ff-only -q && git log -1 --oneline
git log -1 --format=%h | grep -q "^$RELEASE" || { echo "HEAD diferente de $RELEASE: interrompido"; exit 1; }
cd backend && npx prisma generate >/dev/null 2>&1 && echo "prisma ok"
npx prisma migrate diff --from-url "$URL" --to-schema-datamodel prisma/schema.prisma --script > /tmp/diff-$TS.sql
# UsuarioPerfil: tabela que existe no banco e não no schema (diferença antiga). Nunca é aplicada: este deploy não mexe no banco.
FORA=$(grep -v '^--' /tmp/diff-$TS.sql | grep -v '^\s*$' | grep -v 'DROP TABLE `UsuarioPerfil`' || true)
if [ -n "$FORA" ] && [ -z "$PERMITIDO" ]; then echo "SCHEMA COM ALTERAÇÃO FORA DO PERMITIDO (nenhuma esperada), abortando:"; echo "$FORA" | head -20; exit 1; fi
echo "banco sem alterações"
cd ../frontend && npm run build > /tmp/build-front-$TS.log 2>&1 && echo "build ok" || { echo "BUILD FALHOU"; tail -30 /tmp/build-front-$TS.log; exit 1; }
cd .. && pm2 restart ecosystem.config.js --only comercial-backend,comercial-frontend --update-env >/dev/null && echo "pm2 reiniciado"
for i in $(seq 1 20); do
  if curl -fsS -o /dev/null https://comercial.prosystemnet.com/escritorio; then echo "frontend ok"; break; fi; sleep 3
done
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w '%{http_code}' https://comercial.prosystemnet.com/api/assistente/caroline || true)
  if [ "$code" = 401 ] || [ "$code" = 200 ] || [ "$code" = 403 ]; then echo "backend responde ($code)"; break; fi; sleep 3
done
pm2 list | grep -E "comercial-(backend|frontend)"
