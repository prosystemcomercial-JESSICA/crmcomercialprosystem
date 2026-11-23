#!/bin/bash
# Prova que o backup restaura (23/11/2026). Sobe um MySQL descartável no Docker (sem rede, dados só na memória),
# carrega o banco-completo.sql.gz da pasta indicada e compara a contagem de linhas de cada tabela com a cópia
# JSON da mesma execução (_resumo.json). Não encosta no banco de produção. Resultado em <pasta>/_restauracao.txt.
# Uso: bash backup-testar-restauracao.sh /var/backups-comercial/<carimbo>
set -Eeuo pipefail
PASTA="${1:?informe a pasta do backup}"
SQL="$PASTA/banco-completo.sql.gz"
RELATO="$PASTA/_restauracao.txt"
IMAGEM="mysql:8.0"
NOME="backup-teste-restauracao"
SENHA=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')

exec > >(tee "$RELATO") 2>&1
echo "Teste de restauração de $SQL em $(date '+%d/%m/%Y %H:%M')"
[ -f "$SQL" ] || { echo "FALHOU: arquivo não existe"; exit 1; }
(cd "$PASTA" && sha256sum -c banco-completo.sql.gz.sha256) || { echo "FALHOU: o arquivo não confere com o sha256 gravado"; exit 1; }

docker rm -f "$NOME" >/dev/null 2>&1 || true
limpar() { docker rm -f "$NOME" >/dev/null 2>&1 || true; }
trap limpar EXIT

docker image inspect "$IMAGEM" >/dev/null 2>&1 || docker pull -q "$IMAGEM" >/dev/null
docker run -d --name "$NOME" --network none --memory 3g \
  --tmpfs /var/lib/mysql:rw,size=6g \
  -e MYSQL_ROOT_PASSWORD="$SENHA" -e MYSQL_DATABASE=restauracao \
  "$IMAGEM" --max-allowed-packet=1G --innodb-buffer-pool-size=1G --skip-log-bin >/dev/null

# Espera o MySQL do contêiner aceitar conexões (a imagem reinicia uma vez na primeira subida).
PRONTO=0
for i in $(seq 1 90); do
  if docker exec -e MYSQL_PWD="$SENHA" "$NOME" mysql -uroot -N -e "SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='restauracao'" 2>/dev/null | grep -q 1; then
    PRONTO=1; break
  fi
  sleep 2
done
[ "$PRONTO" = 1 ] || { echo "FALHOU: o MySQL de teste não subiu"; docker logs --tail 20 "$NOME"; exit 1; }
sleep 3

INICIO=$(date +%s)
zcat "$SQL" | docker exec -i -e MYSQL_PWD="$SENHA" "$NOME" mysql -uroot --max-allowed-packet=1G restauracao
echo "Carregado em $(( $(date +%s) - INICIO ))s"

# Contagem exata de cada tabela restaurada.
TABELAS=$(docker exec -e MYSQL_PWD="$SENHA" "$NOME" mysql -uroot -N -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='restauracao' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")
CONSULTA=""
for t in $TABELAS; do CONSULTA+="SELECT '$t', COUNT(*) FROM \`$t\`;"; done
docker exec -e MYSQL_PWD="$SENHA" "$NOME" mysql -uroot -N restauracao -e "$CONSULTA" > "$PASTA/.contagens-restauradas.tsv"

python3 - "$PASTA/_resumo.json" "$PASTA/.contagens-restauradas.tsv" <<'P'
import json, sys
resumo = json.load(open(sys.argv[1]))["tabelas"]
rest = {}
for linha in open(sys.argv[2]):
    p = linha.rstrip("\n").split("\t")
    if len(p) == 2: rest[p[0]] = int(p[1])
problemas = []
for t, n in sorted(resumo.items()):
    if t not in rest: problemas.append(f"{t}: não veio na restauração"); continue
    r = rest[t]
    # O JSON é lido logo depois do dump: tabelas que recebem linhas nesse meio tempo podem ter algumas a mais.
    folga = max(25, int(n * 0.02))
    if abs(r - n) > folga: problemas.append(f"{t}: {r} linhas restauradas, {n} no JSON")
for t in rest:
    if t not in resumo: problemas.append(f"{t}: restaurada, mas não está no JSON")
if resumo.get("WhatsappMensagem", 0) > 0 and rest.get("WhatsappMensagem", 0) == 0:
    problemas.append("WhatsappMensagem: nenhuma mensagem restaurada")
print(f"Tabelas restauradas: {len(rest)} | linhas restauradas: {sum(rest.values())} | linhas no JSON: {sum(resumo.values())}")
for t in ("Lead", "Cliente", "WhatsappMensagem", "WhatsappConversa", "ContratoComercial"):
    if t in rest: print(f"  {t}: {rest[t]} (JSON {resumo.get(t)})")
if problemas:
    print("FALHOU:"); [print("  - " + p) for p in problemas]; sys.exit(1)
print("OK: o backup restaura e as contagens batem")
P
rm -f "$PASTA/.contagens-restauradas.tsv"
