# Operação de proxy reverso (Nginx + Certbot)

## 1) Nginx reverse proxy

Arquivo de configuração: `deploy/nginx/crm-reverse-proxy.conf`.

Ele inclui:
- `server_name crm.seudominio.com.br` para `chatwoot_web:3000`.
- `server_name evolution.seudominio.com.br` para `evolution:8080`.
- Headers de proxy (`Host`, `X-Forwarded-Proto`, `X-Forwarded-For`, `X-Real-IP`).
- Redirecionamento de HTTP para HTTPS.

### Instalação sugerida

```bash
sudo cp deploy/nginx/crm-reverse-proxy.conf /etc/nginx/conf.d/crm-reverse-proxy.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 2) Renovação automática de certificado

Script de renovação + reload do Nginx:
- `deploy/certbot/certbot-renew-and-reload.sh`

### Opção A (systemd timer)

```bash
sudo cp deploy/certbot/certbot-renew-and-reload.sh /usr/local/bin/certbot-renew-and-reload.sh
sudo chmod +x /usr/local/bin/certbot-renew-and-reload.sh
sudo cp deploy/systemd/certbot-renew-nginx.service /etc/systemd/system/
sudo cp deploy/systemd/certbot-renew-nginx.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now certbot-renew-nginx.timer
```

### Opção B (cron)

```cron
0 3,15 * * * /usr/local/bin/certbot-renew-and-reload.sh
```

## 3) Validação pós-deploy

Script:
- `deploy/post-deploy/validate-endpoints.sh`

### Exemplo de execução

```bash
CRM_DOMAIN=crm.seudominio.com.br \
EVOLUTION_DOMAIN=evolution.seudominio.com.br \
WEBHOOK_URL=https://bot.seudominio.com.br/webhook \
EVOLUTION_APIKEY_CHECK_PATH=/manager/apikey \
./deploy/post-deploy/validate-endpoints.sh
```

O script valida:
1. HTTPS dos dois domínios.
2. Recebimento de chamada externa no webhook do bot.
3. Resposta do endpoint Evolution contendo `apikey`.
