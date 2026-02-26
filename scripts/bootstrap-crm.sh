#!/usr/bin/env bash
set -euo pipefail

CRM_DIR="${CRM_DIR:-/opt/crm}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$CRM_DIR/.env"

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERRO] Docker não encontrado no PATH. Instale Docker + plugin compose antes de continuar." >&2
  exit 1
fi

mkdir -p "$CRM_DIR"/data/{postgres,redis,chatwoot/storage,chatwoot/public,evolution}
mkdir -p "$CRM_DIR"/certbot/{www,conf}

cp "$PROJECT_ROOT/docker-compose.yml" "$CRM_DIR/docker-compose.yml"
cp "$PROJECT_ROOT/.env.example" "$ENV_FILE"

if grep -q 'SECRET_KEY_BASE=gere-com-openssl-rand-hex-64' "$ENV_FILE"; then
  SECRET="$(openssl rand -hex 64)"
  sed -i "s|SECRET_KEY_BASE=gere-com-openssl-rand-hex-64|SECRET_KEY_BASE=$SECRET|" "$ENV_FILE"
fi

cat <<EOF

[OK] Bootstrap inicial concluído em: $CRM_DIR

Próximos comandos:
  cd $CRM_DIR
  # 1) Edite o .env com domínios/senhas/tokens reais
  nano .env

  # 2) Suba a base
  docker compose up -d postgres redis
  docker compose up -d chatwoot_web chatwoot_worker

  # 3) Prepare banco Chatwoot
  docker compose exec chatwoot_web bundle exec rails db:chatwoot_prepare

  # 4) Suba proxy/evolution
  docker compose up -d evolution nginx certbot

EOF
