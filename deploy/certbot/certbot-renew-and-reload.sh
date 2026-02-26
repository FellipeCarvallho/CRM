#!/usr/bin/env bash
set -euo pipefail

# Renovação automática de certificados Let's Encrypt + reload gracioso do Nginx
if certbot renew --quiet --deploy-hook "nginx -s reload"; then
  echo "[$(date -Iseconds)] Renovação Certbot executada com sucesso."
else
  echo "[$(date -Iseconds)] Falha na renovação Certbot." >&2
  exit 1
fi
