# CRM WhatsApp (Chatwoot + Evolution API + Bot)

Implementação pronta para VPS Ubuntu 24.04 usando Docker Compose.

## 1) Arquivos principais

- `docker-compose.yml`: stack completa (Postgres, Redis, Chatwoot web/worker, Evolution, Nginx, Certbot).
- `.env.example`: variáveis de ambiente base.
- `nginx/conf.d/crm.conf`: reverse proxy para `crm.*` e `evolution.*`.
- `bot/bot-server.js`: Agent Bot webhook para Chatwoot com fallback para humano.
- `bot/followup.job.js`: job diário de follow-up de recompra.
- `integration/notifyOrderToChatwoot.js`: integração para eventos de pedido confirmado no Pede.ai.

## 2) Provisionamento

```bash
sudo mkdir -p /opt/crm/data/{postgres,redis,chatwoot/storage,chatwoot/public,evolution}
sudo mkdir -p /opt/crm/certbot/{www,conf}
cp .env.example .env
```

Ajuste `.env` com segredos reais.

## 3) Inicialização dos serviços

```bash
docker compose up -d postgres redis
docker compose up -d chatwoot_web chatwoot_worker
docker compose exec chatwoot_web bundle exec rails db:chatwoot_prepare
docker compose up -d evolution nginx certbot
```

## 4) Certificados SSL

Emissão inicial (exemplo):

```bash
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d crm.seudominio.com.br -d evolution.seudominio.com.br \
  --email admin@seudominio.com --agree-tos --no-eff-email

docker compose restart nginx
```

## 5) Configuração Chatwoot

1. Criar superadmin:
   ```bash
   docker compose exec chatwoot_web bundle exec rails console
   ```
   ```ruby
   SuperAdmin.create!(email: 'admin@seudominio.com', password: 'senhaforte')
   ```
2. Criar Inbox API no painel e copiar token/inbox identifier.
3. Criar automações (novo, follow-up, cancelar).
4. Criar custom attributes:
   - `ltv` (Number)
   - `last_order_id` (Text)
   - `last_order_date` (Date)
   - `recompra_agendada` (Boolean)

## 6) Instância Evolution API

```bash
curl -X POST "https://evolution.seudominio.com.br/instance/create" \
  -H "apikey: $AUTHENTICATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "principal",
    "integration": "WHATSAPP-BAILEYS",
    "chatwoot_account_id": 1,
    "chatwoot_token": "TOKEN_INBOX",
    "chatwoot_url": "https://crm.seudominio.com.br",
    "chatwoot_sign_msg": false,
    "chatwoot_reopen_conversation": true,
    "chatwoot_conversation_pending": false
  }'
```

## 7) Bot + job com PM2

```bash
npm install
pm2 start bot/bot-server.js --name crm-bot
pm2 start bot/followup.job.js --cron "0 9 * * *" --name followup
pm2 save
```

## 8) Revisão operacional (go-live)

- [ ] Mensagens inbound chegam no Chatwoot.
- [ ] Bot responde e transfere para humano por keyword.
- [ ] Evento `order:confirmed` gera nota interna + atualiza LTV.
- [ ] Follow-up de recompra enviado após janela definida.
- [ ] Volumes persistentes preservados após restart (`chatwoot` e `evolution`).
- [ ] SSL renovando automaticamente.
