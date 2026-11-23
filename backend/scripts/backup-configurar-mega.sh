#!/bin/bash
# Liga o destino "mega:" do rclone no servidor, uma vez (23/11/2026).
# Precisa de /root/segredos/mega.env (só root lê) com:
#   MEGA_EMAIL=...
#   MEGA_SENHA=...
# A senha vai ofuscada para /root/.config/rclone/rclone.conf e o mega.env é apagado no fim. Nada disso vai para o Git.
# Uso (no servidor): bash backup-configurar-mega.sh
set -Eeuo pipefail
ARQ=/root/segredos/mega.env
[ -f "$ARQ" ] || { echo "Falta $ARQ (MEGA_EMAIL e MEGA_SENHA)"; exit 1; }
set -a; . "$ARQ"; set +a
: "${MEGA_EMAIL:?falta MEGA_EMAIL}" "${MEGA_SENHA:?falta MEGA_SENHA}"
rclone config delete mega >/dev/null 2>&1 || true
rclone config create mega mega user "$MEGA_EMAIL" pass "$(rclone obscure "$MEGA_SENHA")" --non-interactive >/dev/null
chmod 600 /root/.config/rclone/rclone.conf
if rclone about mega: ; then
  rclone mkdir "mega:Backups CRM Comercial"
  shred -u "$ARQ" 2>/dev/null || rm -f "$ARQ"
  echo "MEGA ligado. O próximo backup já sobe para a pasta 'Backups CRM Comercial'."
else
  rclone config delete mega || true
  echo "O MEGA recusou o login (e-mail ou senha errados, ou verificação em duas etapas ligada). Nada foi configurado."
  exit 1
fi
