# Próximos passos (execução assistida)

Este guia transforma a entrega em um plano operacional direto para ir a produção.

## 1) Bootstrap da VPS

No repositório:

```bash
./scripts/bootstrap-crm.sh
```

Depois:

```bash
cd /opt/crm
nano .env
```

Preencha obrigatoriamente:
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `AUTHENTICATION_API_KEY`
- `CHATWOOT_TOKEN` e `CHATWOOT_AGENT_TOKEN`
- `FRONTEND_URL`, `CHATWOOT_URL`, `EVOLUTION_URL` com seus domínios reais.

## 2) Subida da stack

```bash
cd /opt/crm
docker compose up -d postgres redis
docker compose up -d chatwoot_web chatwoot_worker
docker compose exec chatwoot_web bundle exec rails db:chatwoot_prepare
docker compose up -d evolution nginx certbot
```

## 3) SSL (primeira emissão)

```bash
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d crm.seudominio.com.br -d evolution.seudominio.com.br \
  --email admin@seudominio.com --agree-tos --no-eff-email

docker compose restart nginx
```

## 4) Configuração funcional no Chatwoot

1. Criar superadmin (rails console).
2. Criar Inbox API “WhatsApp Principal”.
3. Configurar automações (novo, follow-up, cancelar).
4. Criar custom attributes (`ltv`, `last_order_id`, `last_order_date`, `recompra_agendada`).

## 5) Conectar Evolution

- Criar instância `principal` com `integration=WHATSAPP-BAILEYS`.
- Conectar via QR code.
- Validar mensagem inbound no Chatwoot.

## 6) Subir automações Node

```bash
npm install
pm2 start bot/bot-server.js --name crm-bot
pm2 start bot/followup.job.js --cron "0 9 * * *" --name followup
pm2 save
```

## 7) Integrar com Pede.ai

Importar `integration/notifyOrderToChatwoot.js` no serviço do Pede.ai e conectar ao evento:
- `order:confirmed` -> `notifyOrderToChatwoot(order)`.

## 8) Go-live checklist

- [ ] Inbound WhatsApp aparece em Inbox correta.
- [ ] Bot responde e transfere para humano por keyword.
- [ ] Pedido confirmado gera nota interna na conversa certa.
- [ ] Atributos LTV/último pedido atualizam sem duplicidade.
- [ ] Follow-up executa e marca `recompra_agendada=true`.
- [ ] Certificados TLS renovam com sucesso.
