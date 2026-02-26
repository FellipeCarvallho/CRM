# Instalação, configuração e execução (passo a passo completo)

## 1) Onde pode ser rodado

- **Produção recomendada:** VPS Linux (Ubuntu 24.04 LTS) com IP público e domínio.
- **Homologação/lab:** VM local ou cloud com Docker (sem WhatsApp oficial em produção real).
- **Não recomendado:** hosting compartilhado sem Docker/Compose.

## 2) Requisitos mínimos

### Mínimo funcional (baixo volume)
- 2 vCPU
- 4 GB RAM
- 40 GB SSD
- Ubuntu 24.04

### Recomendado (produção pequena/média)
- 4 vCPU
- 8 GB RAM
- 80+ GB SSD NVMe
- swap configurada (2–4 GB)

### Rede e DNS
- Domínios apontando para VPS:
  - `crm.seudominio.com.br`
  - `evolution.seudominio.com.br`
- Portas abertas: `80/tcp`, `443/tcp`

### Software
- Docker Engine + Docker Compose plugin
- Node.js 20+ (para bot/job)
- PM2 (execução contínua de bot/job)
- OpenSSL (geração de secret)

## 3) Instalação do projeto

```bash
git clone <repo-url> /workspace/CRM
cd /workspace/CRM
./scripts/bootstrap-crm.sh
```

## 4) Configuração de ambiente

```bash
cd /opt/crm
nano .env
```

Ajuste obrigatoriamente:
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `SECRET_KEY_BASE` (gerado automaticamente no bootstrap; valide)
- `AUTHENTICATION_API_KEY`
- `CHATWOOT_TOKEN`, `CHATWOOT_AGENT_TOKEN`
- `FRONTEND_URL`, `CHATWOOT_URL`, `EVOLUTION_URL`

## 5) Subida dos serviços

```bash
cd /opt/crm
docker compose up -d postgres redis
docker compose up -d chatwoot_web chatwoot_worker
docker compose exec chatwoot_web bundle exec rails db:chatwoot_prepare
docker compose up -d evolution nginx certbot
```

## 6) TLS (primeira emissão)

```bash
cd /opt/crm
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d crm.seudominio.com.br -d evolution.seudominio.com.br \
  --email admin@seudominio.com --agree-tos --no-eff-email
docker compose restart nginx
```

## 7) Configurar Chatwoot

1. Criar superadmin via rails console.
2. Criar Inbox API “WhatsApp Principal”.
3. Criar automações (novo contato, follow-up 24h, cancelar).
4. Criar atributos customizados de contato:
   - `ltv`
   - `last_order_id`
   - `last_order_date`
   - `recompra_agendada`

## 8) Configurar Evolution + WhatsApp

1. Criar instância `principal` via API `/instance/create`.
2. Abrir `/instance/connect/principal` e escanear QR.
3. Validar inbound no Chatwoot.

## 9) Subir bot e follow-up

```bash
cd /workspace/CRM
npm install
pm2 start bot/bot-server.js --name crm-bot
pm2 start bot/followup.job.js --cron "0 9 * * *" --name followup
pm2 save
```

## 10) Integrar com Pede.ai

- Importar `integration/notifyOrderToChatwoot.js` no serviço Node do Pede.ai.
- Chamar `notifyOrderToChatwoot(order)` no evento `order:confirmed`.

## 11) Validação final

```bash
cd /workspace/CRM
CRM_DOMAIN=crm.seudominio.com.br \
EVOLUTION_DOMAIN=evolution.seudominio.com.br \
WEBHOOK_URL=https://seu-bot.exemplo.com/bot/chatwoot \
EVOLUTION_APIKEY_CHECK_PATH=/manager/apikey \
./deploy/post-deploy/validate-endpoints.sh
```

E validar manualmente:
- mensagem inbound no inbox correto;
- resposta do bot;
- transferência para humano por palavra-chave;
- nota interna em pedido confirmado;
- atualização de atributos de contato;
- follow-up diário executando.
