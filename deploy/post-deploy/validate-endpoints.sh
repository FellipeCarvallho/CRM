#!/usr/bin/env bash
set -euo pipefail

# Uso:
#   CRM_DOMAIN=crm.seudominio.com.br \
#   EVOLUTION_DOMAIN=evolution.seudominio.com.br \
#   WEBHOOK_URL=https://seubot.com/webhook \
#   EVOLUTION_APIKEY_CHECK_PATH=/manager/apikey \
#   ./deploy/post-deploy/validate-endpoints.sh

CRM_DOMAIN="${CRM_DOMAIN:-crm.seudominio.com.br}"
EVOLUTION_DOMAIN="${EVOLUTION_DOMAIN:-evolution.seudominio.com.br}"
WEBHOOK_URL="${WEBHOOK_URL:-}"
EVOLUTION_APIKEY_CHECK_PATH="${EVOLUTION_APIKEY_CHECK_PATH:-/}"

step() {
  printf '\n==> %s\n' "$1"
}

check_https() {
  local host="$1"
  local status
  status="$(curl -sS -o /dev/null -w '%{http_code}' "https://${host}")"

  if [[ "$status" =~ ^2|3 ]]; then
    echo "OK: HTTPS acessível em https://${host} (HTTP ${status})"
  else
    echo "ERRO: HTTPS falhou em https://${host} (HTTP ${status})" >&2
    return 1
  fi
}

check_webhook() {
  if [[ -z "$WEBHOOK_URL" ]]; then
    echo "AVISO: WEBHOOK_URL não informado; validação de webhook foi pulada."
    return 0
  fi

  local status
  status="$(curl -sS -o /dev/null -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -X POST "$WEBHOOK_URL" \
    -d '{"event":"external_test","source":"post-deploy-validation"}')"

  if [[ "$status" =~ ^2 ]]; then
    echo "OK: webhook recebeu chamada externa (HTTP ${status})"
  else
    echo "ERRO: webhook não confirmou chamada externa (HTTP ${status})" >&2
    return 1
  fi
}

check_evolution_apikey() {
  local response
  response="$(curl -sS "https://${EVOLUTION_DOMAIN}${EVOLUTION_APIKEY_CHECK_PATH}")"

  if grep -qi 'apikey' <<<"$response"; then
    echo "OK: endpoint da Evolution respondeu conteúdo contendo 'apikey'."
  else
    echo "ERRO: endpoint da Evolution não retornou conteúdo com 'apikey'." >&2
    return 1
  fi
}

step "Validação HTTPS: CRM"
check_https "$CRM_DOMAIN"

step "Validação HTTPS: Evolution"
check_https "$EVOLUTION_DOMAIN"

step "Validação de recebimento de webhook externo"
check_webhook

step "Validação de endpoint da Evolution com apikey"
check_evolution_apikey

echo "\nTodas as validações pós-deploy concluídas."
