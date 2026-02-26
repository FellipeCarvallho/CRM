# 📘 README — CRM WhatsApp (Chatwoot + Evolution API + Baileys)

Sistema de CRM para atendimento via WhatsApp com automação, bot inteligente e integração com o sistema **Pede.ai**.

O objetivo é criar uma operação **100% autônoma**, onde a equipe trabalha apenas pela interface do CRM, sem depender do dono ou de ferramentas manuais.

---

# 🧠 Arquitetura Geral

```
WhatsApp
   ↓
Evolution API (Baileys)
   ↓
Chatwoot (CRM)
   ↓
Bot Node.js (Ollama IA)
   ↓
Integração Pede.ai (Pedidos)
   ↓
Follow-up Automático
```

---

# 🚀 Stack Tecnológica

| Camada          | Tecnologia                 |
| --------------- | -------------------------- |
| OS              | Ubuntu 24.04 (VPS)         |
| Containers      | Docker + Docker Compose    |
| CRM             | Chatwoot (Rails)           |
| WhatsApp Engine | Evolution API v2 (Baileys) |
| Banco principal | PostgreSQL 15              |
| Cache           | Redis 7                    |
| Proxy reverso   | Nginx + SSL Let's Encrypt  |
| Serviços Node   | PM2                        |
| IA              | Ollama (llama3)            |

---

# 📁 Estrutura de Diretórios

```
/opt/crm
 ├── docker-compose.yml
 ├── .env
 ├── data/
 │    ├── postgres/
 │    └── redis/
 ├── bot/
 │    ├── bot-server.js
 │    └── followup.job.js
```

---

# ⚙️ Instalação — Passo a Passo

## 1️⃣ Criar diretório do projeto

```bash
sudo mkdir -p /opt/crm
cd /opt/crm
```

Copiar:

* docker-compose.yml
* .env

---

## 2️⃣ Subir banco e cache

```bash
docker compose up -d postgres redis
```

---

## 3️⃣ Subir Chatwoot

```bash
docker compose up -d chatwoot_web chatwoot_worker
```

Preparar banco:

```bash
docker compose exec chatwoot_web bundle exec rails db:chatwoot_prepare
```

---

## 4️⃣ Criar Super Admin

```bash
docker compose exec chatwoot_web bundle exec rails console
```

```ruby
SuperAdmin.create!(
  email: 'admin@seudominio.com',
  password: 'senhaforte'
)
```

Acessar:

```
https://crm.seudominio.com.br
```

---

## 5️⃣ Subir Evolution API

```bash
docker compose up -d evolution
```

---

## 6️⃣ Criar Instância WhatsApp

POST:

```
http://evolution.seudominio.com.br/instance/create
```

Body:

```json
{
  "instanceName": "principal",
  "integration": "WHATSAPP-BAILEYS",
  "chatwoot_account_id": 1,
  "chatwoot_token": "<token>",
  "chatwoot_url": "https://crm.seudominio.com.br",
  "chatwoot_sign_msg": false,
  "chatwoot_reopen_conversation": true,
  "chatwoot_conversation_pending": false
}
```

---

## 7️⃣ Conectar WhatsApp

```
GET /instance/connect/principal
```

Escanear QR Code.

---

# 🤖 Bot de Atendimento (Node.js)

Servidor webhook que:

✅ Lê mensagens do Chatwoot
✅ Consulta histórico
✅ Usa IA (Ollama)
✅ Responde automaticamente
✅ Transfere para humano quando necessário

Iniciar com PM2:

```bash
pm2 start bot-server.js --name crm-bot
```

---

# 🔁 Follow-up Automático de Recompra

Script diário que:

* Detecta clientes sem pedido há X dias
* Envia mensagem automática
* Marca atributo no CRM

Executar:

```bash
pm2 start followup.job.js \
  --cron "0 9 * * *" \
  --name followup
```

---

# 🔗 Integração com Pede.ai

Quando um pedido é confirmado:

1. Busca contato no Chatwoot
2. Localiza conversa ativa
3. Adiciona nota interna
4. Atualiza atributos do cliente (LTV)

Evento:

```js
pedeai.on('order:confirmed', notifyOrderToChatwoot)
```

---

# 🧾 Atributos Customizados no Chatwoot

Criar em:

```
Settings → Custom Attributes → Contact
```

| Campo             | Tipo    | Descrição         |
| ----------------- | ------- | ----------------- |
| ltv               | Number  | Valor total gasto |
| last_order_id     | Text    | Último pedido     |
| last_order_date   | Date    | Data do pedido    |
| recompra_agendada | Boolean | Follow-up ativo   |

---

# ⚡ Automações no Chatwoot

### Novo contato

* Evento: Conversation Created
* Ação: Label → `novo`

### Sem resposta 24h

* Evento: Conversation Updated
* Condição: Last Activity > 24h
* Ação:

  * Label → `follow-up`
  * Assign Team → Vendas

### Cancelamento

* Evento: Message Created
* Condição: contém “cancelar”
* Ação:

  * Label → `cancelamento`
  * Assign Agent

---

# 🔐 Variáveis de Ambiente

Arquivo:

```
/opt/crm/.env
```

Principais:

```env
POSTGRES_USER=chatwoot
POSTGRES_PASSWORD=senha
POSTGRES_DB=chatwoot_production

DATABASE_URL=postgresql://chatwoot:senha@postgres:5432/chatwoot_production
REDIS_URL=redis://redis:6379

SECRET_KEY_BASE=<openssl rand -hex 64>

FRONTEND_URL=https://crm.seudominio.com.br
RAILS_ENV=production

EVOLUTION_URL=https://evolution.seudominio.com.br
EVOLUTION_APIKEY=apikey

CHATWOOT_URL=https://crm.seudominio.com.br
CHATWOOT_TOKEN=token
ACCOUNT_ID=1

OLLAMA_URL=http://localhost:11434
```

---

# 📊 Fluxo Completo Esperado

✅ Cliente envia WhatsApp
✅ Mensagem chega no Chatwoot
✅ Bot responde automaticamente
✅ Cliente faz pedido
✅ Pedido aparece como nota interna
✅ LTV atualizado automaticamente
✅ Após 7 dias → follow-up automático
✅ Atendente humano entra quando necessário

---

# 🧪 Teste Final

Checklist:

* [ ] WhatsApp conectado
* [ ] Mensagem aparece no Chatwoot
* [ ] Bot responde
* [ ] Transferência para humano funciona
* [ ] Pedido cria nota interna
* [ ] Follow-up dispara após prazo

---

# 🏁 Resultado

Sistema de CRM WhatsApp profissional com:

* Histórico completo por cliente
* Automação de vendas
* IA integrada
* Operação escalável
* Baixo custo de infraestrutura
* Independência do proprietário

---

# 📞 Operação Diária da Equipe

A equipe usa apenas:

```
https://crm.seudominio.com.br
```

Sem necessidade de:

❌ Celular
❌ WhatsApp Web
❌ Planilhas
❌ Intervenção técnica

---

# 🧠 Possíveis Expansões Futuras

* Disparos em massa (campanhas)
* Integração com ERP
* Dashboard BI
* Detecção de churn
* Reativação automática de clientes
* Multi-números WhatsApp
* IA com contexto de estoque

---

Se quiser, posso gerar também:

* docker-compose.yml pronto
* Configuração Nginx + SSL
* Scripts de deploy automático
* Painel de métricas de vendas

Só pedir 👍.
