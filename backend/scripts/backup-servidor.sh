#!/bin/bash
# Backup do CRM Comercial no servidor (23/11/2026, pedido da Jessica: "dados reais, não pode dar erro nunca").
# Cron: 0 6,17 * * * /usr/local/bin/backup-comercial.sh (3h e 14h de Brasília), que só chama este arquivo.
# Instalar/atualizar: bash backend/scripts/backup-instalar.sh (no servidor).
#
# Cada execução cria /var/backups-comercial/<carimbo>/ com:
#   banco-completo.sql.gz (+ .sha256)  dump do MySQL inteiro, numa foto só (--single-transaction): é o que se usa para restaurar
#   <Tabela>.json + _resumo.json        segunda via legível (backup-diario.cjs)
#   _arquivos-clientes.tar.gz           arquivos enviados pelos clientes no Portal Técnico
#   _ok                                 só existe se tudo acima deu certo
# Depois: teste de restauração num MySQL descartável (Docker, sem rede, 1 vez por dia), envio para o MEGA
# (backup-nuvem-mega.sh) e, só se o backup do dia deu certo, a limpeza dos antigos.
# Resultado em /var/backups-comercial-status/servidor.json (o vigia do CRM lê e avisa a gestão no WhatsApp).
# Restaurar: ver docs/contexto/backup.md.
set -Eeuo pipefail
umask 077

APP=/var/www/comercial-prosystem/backend
DESTINO=${BACKUP_DESTINO:-/var/backups-comercial}             # outra pasta só para teste
STATUS_DIR=${BACKUP_STATUS_DIR:-/var/backups-comercial-status}
RETENCAO_DIAS=7       # apaga pastas mais antigas que isso (cada backup tem ~1,2 GB; o MEGA guarda 10 dias)...
MINIMO_GUARDADOS=10   # ...mas nunca deixa menos que estes backups bons
SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
# Qualquer erro não previsto encerra com a linha de FALHA no log (o vigia lê e avisa; ele também avisa se o
# último backup bom em servidor.json ficar velho).
trap 'log "[BACKUP] FALHA — erro inesperado na linha $LINENO (comando: $BASH_COMMAND)"' ERR

exec 9>/var/lock/backup-comercial.lock
if ! flock -n 9; then log "[BACKUP] já existe um backup em andamento; esta execução foi ignorada"; exit 0; fi
mkdir -p "$DESTINO" "$STATUS_DIR"

# Credenciais do banco: vêm do .env do app (nunca ficam neste arquivo). A senha vai por variável de ambiente.
URL=$(grep -E '^DATABASE_URL' "$APP/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"' ')
eval "$(python3 - "$URL" <<'P'
import sys, shlex, urllib.parse as u
p = u.urlparse(sys.argv[1])
for k, v in (("DBU", u.unquote(p.username or "")), ("DBP", u.unquote(p.password or "")), ("DBH", p.hostname or "localhost"),
             ("DBPT", str(p.port or 3306)), ("DBN", p.path[1:].split("?")[0])):
    print(f"{k}={shlex.quote(v)}")
P
)"
export MYSQL_PWD="$DBP"
MY=(-u"$DBU" -h"$DBH" -P"$DBPT")

INICIO=$(date +%s)
CARIMBO=$(date -u +%Y-%m-%dT%H-%M-%S)
PASTA="$DESTINO/$CARIMBO"
mkdir -p "$PASTA"
ERROS=()
SQL_BYTES=0; SQL_SHA=""; SQL_TABELAS=0
TABELAS_BANCO=$(mysql "${MY[@]}" -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DBN' AND TABLE_TYPE='BASE TABLE'")

# 1) Dump completo do MySQL.
SQL="$PASTA/banco-completo.sql.gz"
log "[BACKUP] dump do banco $DBN ($TABELAS_BANCO tabelas)"
if mysqldump "${MY[@]}" --single-transaction --quick --routines --triggers --hex-blob --no-tablespaces \
     --default-character-set=utf8mb4 --max-allowed-packet=1G "$DBN" | gzip -6 > "$SQL.parcial"; then
  if ! gzip -t "$SQL.parcial"; then
    ERROS+=("dump: arquivo compactado corrompido")
  elif ! zcat "$SQL.parcial" | tail -1 | grep -q '^-- Dump completed'; then
    ERROS+=("dump: arquivo incompleto (sem a linha final do mysqldump)")
  else
    SQL_TABELAS=$(zcat "$SQL.parcial" | grep -c '^CREATE TABLE' || true)
    if [ "$SQL_TABELAS" -ne "$TABELAS_BANCO" ]; then
      ERROS+=("dump: $SQL_TABELAS tabelas no arquivo, $TABELAS_BANCO no banco")
    else
      mv "$SQL.parcial" "$SQL"
      SQL_SHA=$(sha256sum "$SQL" | cut -d' ' -f1)
      echo "$SQL_SHA  banco-completo.sql.gz" > "$SQL.sha256"
      SQL_BYTES=$(stat -c %s "$SQL")
      log "[BACKUP] dump ok: $((SQL_BYTES / 1048576)) MB, $SQL_TABELAS tabelas"
    fi
  fi
else
  ERROS+=("dump: mysqldump falhou")
fi
rm -f "$SQL.parcial"

# 2) Cópia legível em JSON (mesma pasta).
log "[BACKUP] cópia em JSON"
if ! (cd "$APP" && DATABASE_URL="$URL" BACKUP_CARIMBO="$CARIMBO" NODE_PATH="$APP/node_modules" node "$SCRIPTS/backup-diario.cjs" "$DESTINO"); then
  ERROS+=("json: exportação com erro (veja as linhas BACKUP-JSON acima)")
fi
JSON_TABELAS=$(python3 -c "import json,sys;print(len(json.load(open(sys.argv[1]))['tabelas']))" "$PASTA/_resumo.json" 2>/dev/null || echo 0)
JSON_LINHAS=$(python3 -c "import json,sys;print(sum(json.load(open(sys.argv[1]))['tabelas'].values()))" "$PASTA/_resumo.json" 2>/dev/null || echo 0)

[ ${#ERROS[@]} -eq 0 ] && touch "$PASTA/_ok"

# 3) Teste de restauração (1 vez por dia, na execução da madrugada, ou com TESTAR_RESTAURACAO=1).
RESTAURACAO="nao_rodou"
if [ -f "$PASTA/_ok" ] && { [ "$(date -u +%H)" = "06" ] || [ "${TESTAR_RESTAURACAO:-0}" = "1" ]; }; then
  log "[BACKUP] teste de restauração"
  if bash "$SCRIPTS/backup-testar-restauracao.sh" "$PASTA"; then RESTAURACAO="ok"; else RESTAURACAO="falhou"; ERROS+=("restauração: o teste falhou (veja $PASTA/_restauracao.txt)"); fi
fi

# 4) Nuvem (MEGA). Só envia backup bom.
NUVEM="nao_configurada"
if [ -f "$PASTA/_ok" ] && [ "${SEM_NUVEM:-0}" != "1" ]; then
  if rclone listremotes 2>/dev/null | grep -qx 'mega:'; then
    log "[BACKUP] envio para o MEGA"
    if bash "$SCRIPTS/backup-nuvem-mega.sh" "$PASTA"; then NUVEM="ok"; else NUVEM="falhou"; ERROS+=("nuvem: envio para o MEGA falhou"); fi
  else
    log "[BACKUP] MEGA ainda não configurado (rclone sem o destino 'mega:')"
  fi
fi

# 5) Limpeza: só depois de um backup bom; mantém sempre os $MINIMO_GUARDADOS mais novos que deram certo.
if [ -f "$PASTA/_ok" ]; then
  LIMITE=$(date -u -d "-$RETENCAO_DIAS days" +%Y-%m-%d)
  mapfile -t BONS < <(ls -1 "$DESTINO" | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' | sort -r | while read -r n; do [ -f "$DESTINO/$n/_ok" ] && echo "$n"; done)
  PROTEGIDOS=" ${BONS[*]:0:$MINIMO_GUARDADOS} "
  for n in $(ls -1 "$DESTINO" | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' | sort); do
    [ "${n:0:10}" \< "$LIMITE" ] || continue
    case "$PROTEGIDOS" in *" $n "*) continue ;; esac
    rm -rf -- "${DESTINO:?}/$n" && log "[BACKUP] removido backup antigo: $n"
  done
fi

DISCO=$(df --output=pcent "$DESTINO" | tail -1 | tr -dc '0-9')
DURACAO=$(( $(date +%s) - INICIO ))
OK=true; [ ${#ERROS[@]} -eq 0 ] || OK=false
ERROS_ARQ=$(mktemp)
printf '%s\n' "${ERROS[@]}" > "$ERROS_ARQ"
python3 - "$STATUS_DIR/servidor.json" "$ERROS_ARQ" <<P
import json, sys, datetime, os
caminho = sys.argv[1]
erros = [l for l in open(sys.argv[2], encoding="utf-8").read().splitlines() if l]
antigo = {}
try: antigo = json.load(open(caminho))
except Exception: pass
agora = datetime.datetime.now(datetime.timezone.utc).isoformat()
d = {
  "em": agora, "carimbo": "$CARIMBO", "ok": $( $OK && echo True || echo False ), "duracao_s": $DURACAO,
  "erros": erros,
  "sql": {"bytes": $SQL_BYTES, "sha256": "$SQL_SHA", "tabelas": $SQL_TABELAS, "tabelas_banco": $TABELAS_BANCO},
  "json": {"tabelas": $JSON_TABELAS, "linhas": $JSON_LINHAS},
  "disco_pct": int("${DISCO:-0}" or 0),
  "restauracao": antigo.get("restauracao"), "nuvem": antigo.get("nuvem"),
}
if "$OK" == "true": d["ultimo_ok_em"] = agora
else: d["ultimo_ok_em"] = antigo.get("ultimo_ok_em")
if "$RESTAURACAO" != "nao_rodou": d["restauracao"] = {"em": agora, "ok": "$RESTAURACAO" == "ok", "carimbo": "$CARIMBO"}
if "$NUVEM" in ("ok", "falhou"):
  n = dict(antigo.get("nuvem") or {}); n.update({"tentativa_em": agora, "ok": "$NUVEM" == "ok"})
  if "$NUVEM" == "ok": n["ultimo_ok_em"] = agora; n["carimbo"] = "$CARIMBO"
  try: n.update(json.load(open("$PASTA/_nuvem.json")))
  except Exception: pass
  d["nuvem"] = n
elif "$NUVEM" == "nao_configurada" and not antigo.get("nuvem"): d["nuvem"] = {"configurada": False}
tmp = caminho + ".tmp"; json.dump(d, open(tmp, "w"), ensure_ascii=False, indent=2); os.replace(tmp, caminho)
P
rm -f "$ERROS_ARQ"

if $OK; then
  log "[BACKUP] OK — sql $((SQL_BYTES / 1048576)) MB ($SQL_TABELAS tabelas), json $JSON_TABELAS tabelas $JSON_LINHAS linhas, restauração $RESTAURACAO, nuvem $NUVEM, disco ${DISCO}%, 0 erros, ${DURACAO}s"
else
  log "[BACKUP] FALHA — ${#ERROS[@]} erros: ${ERROS[*]}"
  exit 1
fi
