#!/bin/bash
# Envia o backup do servidor para o MEGA (23/11/2026, escolha da Jessica: "MEGA direto do servidor").
# Chamado pelo backup-servidor.sh depois de um backup bom. Usa o rclone com o destino "mega:" (configurado uma vez
# com backup-configurar-mega.sh; a senha fica só em /root/.config/rclone/rclone.conf, ofuscada, fora do Git).
# Sobe o dump completo + sha256 + arquivos dos clientes + _resumo.json, confere o tamanho de cada arquivo na nuvem
# e só então apaga na nuvem as pastas com mais de RETENCAO_DIAS (mantendo sempre as MINIMO mais novas).
# Uso: bash backup-nuvem-mega.sh /var/backups-comercial/<carimbo>
set -Eeuo pipefail
PASTA="${1:?informe a pasta do backup}"
CARIMBO=$(basename "$PASTA")
RAIZ="mega:Backups CRM Comercial"
RETENCAO_DIAS=${MEGA_RETENCAO_DIAS:-10}
MINIMO=6

ARQS=(banco-completo.sql.gz banco-completo.sql.gz.sha256 _resumo.json)
[ -f "$PASTA/_arquivos-clientes.tar.gz" ] && ARQS+=(_arquivos-clientes.tar.gz)

for a in "${ARQS[@]}"; do
  rclone copyto "$PASTA/$a" "$RAIZ/$CARIMBO/$a" --retries 5 --low-level-retries 20 --contimeout 60s --timeout 10m
done

# Conferência: cada arquivo tem que estar na nuvem com o mesmo tamanho.
LISTA=$(rclone lsjson "$RAIZ/$CARIMBO")
for a in "${ARQS[@]}"; do
  LOCAL=$(stat -c %s "$PASTA/$a")
  NUVEM=$(echo "$LISTA" | python3 -c "import json,sys;print(next((str(x['Size']) for x in json.load(sys.stdin) if x['Name']==sys.argv[1]),'-1'))" "$a")
  [ "$LOCAL" = "$NUVEM" ] || { echo "[MEGA] $a: $LOCAL bytes aqui, $NUVEM na nuvem"; exit 1; }
done
echo "[MEGA] enviado e conferido: $CARIMBO (${#ARQS[@]} arquivos)"

# Limpeza na nuvem (só chega aqui com o envio de hoje conferido).
LIMITE=$(date -u -d "-$RETENCAO_DIAS days" +%Y-%m-%d)
mapfile -t PASTAS < <(rclone lsf --dirs-only "$RAIZ" | tr -d '/' | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' | sort -r)
for i in "${!PASTAS[@]}"; do
  n="${PASTAS[$i]}"
  [ "$i" -lt "$MINIMO" ] && continue
  [ "${n:0:10}" \< "$LIMITE" ] || continue
  rclone purge "$RAIZ/$n" && echo "[MEGA] removido da nuvem: $n"
done

# Espaço da conta, para o vigia avisar antes de lotar.
rclone about "mega:" --json 2>/dev/null | python3 -c "
import json, sys
a = json.load(sys.stdin)
json.dump({'destino': 'MEGA', 'total_bytes': a.get('total'), 'usado_bytes': a.get('used'), 'livre_bytes': a.get('free'),
           'backups_na_nuvem': $(( ${#PASTAS[@]} ))}, open(sys.argv[1], 'w'))
" "$PASTA/_nuvem.json" || true
