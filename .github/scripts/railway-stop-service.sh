#!/usr/bin/env bash
# Para o deployment ativo de um serviço no Railway (deploymentStop).
# Espera o deployment sair de estados transitórios (BUILDING/DEPLOYING/INITIALIZING)
# antes de tentar parar — deploymentStop só funciona em deployments com status SUCCESS.
set -euo pipefail

SERVICE_ID="$1"
ENVIRONMENT_ID="$2"
LABEL="$3"
RAILWAY_API="https://backboard.railway.com/graphql/v2"
MAX_TENTATIVAS=6
ESPERA_SEGUNDOS=10

consultar_deployment() {
  curl -s -X POST "$RAILWAY_API" \
    -H "Authorization: Bearer ${RAILWAY_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"query(\$sid: String!, \$eid: String!) { serviceInstance(serviceId: \$sid, environmentId: \$eid) { latestDeployment { id status } } }\",\"variables\":{\"sid\":\"$SERVICE_ID\",\"eid\":\"$ENVIRONMENT_ID\"}}"
}

for TENTATIVA in $(seq 1 "$MAX_TENTATIVAS"); do
  RESP=$(consultar_deployment)
  echo "[$LABEL] Tentativa $TENTATIVA — deployment atual: $RESP"
  DEPLOY_ID=$(echo "$RESP" | jq -r '.data.serviceInstance.latestDeployment.id')
  STATUS=$(echo "$RESP" | jq -r '.data.serviceInstance.latestDeployment.status')

  if [ -z "$DEPLOY_ID" ] || [ "$DEPLOY_ID" == "null" ]; then
    echo "[$LABEL] Nenhum deployment ativo encontrado — nada a parar."
    exit 0
  fi

  if [ "$STATUS" == "SUCCESS" ]; then
    STOP_RESP=$(curl -s -X POST "$RAILWAY_API" \
      -H "Authorization: Bearer ${RAILWAY_API_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"query\":\"mutation(\$id: String!) { deploymentStop(id: \$id) }\",\"variables\":{\"id\":\"$DEPLOY_ID\"}}")
    echo "[$LABEL] Resultado do stop: $STOP_RESP"
    if echo "$STOP_RESP" | jq -e '.errors' > /dev/null 2>&1; then
      echo "[$LABEL] ERRO ao parar o deployment."
      exit 1
    fi
    echo "[$LABEL] Deployment $DEPLOY_ID parado com sucesso."
    exit 0
  fi

  if [ "$STATUS" == "BUILDING" ] || [ "$STATUS" == "DEPLOYING" ] || [ "$STATUS" == "INITIALIZING" ] || [ "$STATUS" == "QUEUED" ]; then
    echo "[$LABEL] Deployment em estado transitório ($STATUS) — aguardando ${ESPERA_SEGUNDOS}s antes de tentar de novo."
    sleep "$ESPERA_SEGUNDOS"
    continue
  fi

  echo "[$LABEL] Status '$STATUS' não é parável (ex.: já parado, falhou) — nada a fazer."
  exit 0
done

echo "[$LABEL] Esgotadas as tentativas sem conseguir parar (deployment ainda em estado transitório)."
exit 1
