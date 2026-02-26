#!/usr/bin/env bash
set -euo pipefail

./scripts/bootstrap-crm.sh
cd /opt/crm

echo "[INFO] Revise /opt/crm/.env antes de continuar."

docker compose up -d postgres redis
docker compose up -d chatwoot_web chatwoot_worker
docker compose exec chatwoot_web bundle exec rails db:chatwoot_prepare
docker compose up -d evolution nginx certbot

echo "[OK] Startup base concluído. Siga para TLS e validações." 
