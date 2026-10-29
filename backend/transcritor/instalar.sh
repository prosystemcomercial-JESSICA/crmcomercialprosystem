#!/usr/bin/env bash
# Instala (ou atualiza) o transcritor local no servidor, como root:
#   bash /var/www/comercial-prosystem/backend/transcritor/instalar.sh
# Cria o ambiente Python em /opt/transcritor e sobe o pm2 "transcritor" (127.0.0.1:8766).
set -euo pipefail

PASTA="$(cd "$(dirname "$0")" && pwd)"
VENV=/opt/transcritor

if [ ! -x "$VENV/bin/python" ]; then
  apt-get install -y python3-venv >/dev/null
  python3 -m venv "$VENV"
fi
"$VENV/bin/pip" install --quiet --upgrade pip
# requests: o faster-whisper usa para baixar o modelo e não o instala sozinho.
"$VENV/bin/pip" install --quiet "faster-whisper==1.2.1" requests

# Cópia fora da pasta do app: o deploy troca a pasta e o transcritor continua de pé.
cp "$PASTA/servidor.py" "$VENV/servidor.py"
pm2 delete transcritor >/dev/null 2>&1 || true
pm2 start "$VENV/servidor.py" --name transcritor --interpreter "$VENV/bin/python"
pm2 save

# O modelo é baixado na primeira subida; espera responder.
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8766/health >/dev/null 2>&1; then
    echo "transcritor no ar: $(curl -fsS http://127.0.0.1:8766/health)"; exit 0
  fi
  sleep 5
done
echo "o transcritor não respondeu em 5 minutos; veja: pm2 logs transcritor" >&2
exit 1
