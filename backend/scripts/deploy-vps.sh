#!/bin/bash
# Deploy do CRM Comercial na VPS (roda NO SERVIDOR): bash /root/deploy-vps.sh <commit>
# Pipeline verde no GitHub → backup do banco → git pull (+ npm ci se o package-lock mudou) → confere o commit → prisma generate → confere o diff do banco contra PERMITIDO
# (vazio = nenhuma mudança de banco aceita) → build do frontend → pm2 restart → confere site e API.
# Sem senhas nem acessos aqui: as credenciais vêm do .env do servidor; como entrar no servidor e copiar este script está no arquivo local C:/Users/prosy/CONTEXTO-CRM-COMERCIAL-LOCAL.md (fora do Git).
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

# Pipeline (16/10/2026): só publica commit com a CI verde no GitHub. O repositório é público, então a consulta
# não precisa de senha. Espera até 15 min a CI terminar. Emergência: SEM_CI=1 bash /root/deploy-vps.sh <commit>
if [ "${SEM_CI:-0}" != "1" ]; then
  REPO=prosystemcomercial-JESSICA/crmcomercialprosystem
  EST=pendente
  for i in $(seq 1 30); do
    EST=$(curl -fsS "https://api.github.com/repos/$REPO/commits/$RELEASE/check-runs?per_page=50" 2>/dev/null | python3 -c '
import sys, json
try: runs = json.load(sys.stdin).get("check_runs", [])
except Exception: print("pendente"); sys.exit()
if not runs or any(r.get("status") != "completed" for r in runs): print("pendente")
elif all(r.get("conclusion") in ("success", "skipped", "neutral") for r in runs): print("ok")
else: print("falhou")' || echo pendente)
    [ "$EST" = ok ] && { echo "pipeline ok"; break; }
    [ "$EST" = falhou ] && { echo "PIPELINE FALHOU para $RELEASE: veja https://github.com/$REPO/actions e corrija antes de publicar"; exit 1; }
    sleep 30
  done
  [ "$EST" = ok ] || { echo "pipeline de $RELEASE não terminou em 15 min: interrompido (nada foi publicado)"; exit 1; }
else
  echo "ATENÇÃO: publicando sem conferir a pipeline (SEM_CI=1)"
fi
TS=$(date +%Y%m%d-%H%M%S)
mysqldump -u"$DBU" -h"$DBH" -P"$DBPT" --no-tablespaces --single-transaction "$DBN" | gzip > /root/backups-deploy/pre-deploy-$TS.sql.gz
echo "backup: $(ls -lh /root/backups-deploy/pre-deploy-$TS.sql.gz | awk '{print $5}')"
cd /var/www/comercial-prosystem
LOCKS_ANTES=$(md5sum backend/package-lock.json frontend/package-lock.json 2>/dev/null)
git pull --ff-only -q && git log -1 --oneline
# Dependências novas (16/10/2026): se o package-lock mudou, instala antes do build (antes, uma biblioteca nova quebraria o deploy).
for P in backend frontend; do
  if [ "$(echo "$LOCKS_ANTES" | grep " $P/package-lock.json" | cut -d' ' -f1)" != "$(md5sum $P/package-lock.json | cut -d' ' -f1)" ]; then
    echo "dependências do $P mudaram: npm ci"; (cd $P && npm ci --no-audit --no-fund >/tmp/npm-ci-$P-$TS.log 2>&1) || { echo "npm ci do $P falhou"; tail -20 /tmp/npm-ci-$P-$TS.log; exit 1; }
  fi
done
git log -1 --format=%h | grep -q "^$RELEASE" || { echo "HEAD diferente de $RELEASE: interrompido"; exit 1; }
cd backend && npx prisma generate >/dev/null 2>&1 && echo "prisma ok"
npx prisma migrate diff --from-url "$URL" --to-schema-datamodel prisma/schema.prisma --script > /tmp/diff-$TS.sql
# UsuarioPerfil: tabela que existe no banco e não no schema (diferença antiga). Nunca é aplicada: este deploy não mexe no banco.
FORA=$(grep -v '^--' /tmp/diff-$TS.sql | grep -v '^\s*$' | grep -v 'DROP TABLE `UsuarioPerfil`' || true)
if [ -n "$FORA" ] && [ -z "$PERMITIDO" ]; then echo "SCHEMA COM ALTERAÇÃO FORA DO PERMITIDO (nenhuma esperada), abortando:"; echo "$FORA" | head -20; exit 1; fi
echo "banco sem alterações"
# Build falhou (16/10/2026: fonte do Google não baixou e o cache do Turbopack ficou corrompido)? Limpa o .next e tenta
# uma vez mais; se falhar de novo, para SEM reiniciar (o site segue na versão em memória; rode de novo antes de reiniciar).
cd ../frontend && { npm run build > /tmp/build-front-$TS.log 2>&1 || { echo "build falhou: limpando o cache e tentando de novo"; rm -rf .next; npm run build > /tmp/build-front-$TS.log 2>&1; }; } && echo "build ok" || { echo "BUILD FALHOU (o frontend NÃO foi reiniciado)"; tail -30 /tmp/build-front-$TS.log; exit 1; }
cd .. && pm2 restart ecosystem.config.js --only comercial-backend,comercial-frontend --update-env >/dev/null && echo "pm2 reiniciado"
for i in $(seq 1 20); do
  if curl -fsS -o /dev/null https://comercial.prosystemnet.com/escritorio; then echo "frontend ok"; break; fi; sleep 3
done
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w '%{http_code}' https://comercial.prosystemnet.com/api/assistente/caroline || true)
  if [ "$code" = 401 ] || [ "$code" = 200 ] || [ "$code" = 403 ]; then echo "backend responde ($code)"; break; fi; sleep 3
done
pm2 list | grep -E "comercial-(backend|frontend)"
