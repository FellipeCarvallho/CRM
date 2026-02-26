# TLS and reverse proxy

Initial certificate issuance:

```bash
cd /opt/crm
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d crm.seudominio.com.br -d evolution.seudominio.com.br \
  --email admin@seudominio.com --agree-tos --no-eff-email

docker compose restart nginx
```

## Validate

```bash
curl -I https://crm.seudominio.com.br
curl -I https://evolution.seudominio.com.br
```

Expect HTTP 200/301/302 and valid certificate chain.
