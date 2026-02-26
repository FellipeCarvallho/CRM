# Runbook de Operação — Persistência, Backup e Validação

## 1) Paths de dados persistentes (compose atual)

No `docker-compose.yml` principal, os dados persistem em bind mounts do host:

- `/opt/crm/data/postgres` → `/var/lib/postgresql/data`
- `/opt/crm/data/redis` → `/data`
- `/opt/crm/data/chatwoot/storage` → `/app/storage`
- `/opt/crm/data/chatwoot/public` → `/app/public`
- `/opt/crm/data/evolution` → `/evolution/instances`

## 2) Backup e restauração

### 2.1 Backup

```bash
sudo mkdir -p /opt/crm/backups/$(date +%F)
BACKUP_DIR="/opt/crm/backups/$(date +%F)"

# (opcional) reduzir escrita durante backup
cd /opt/crm
docker compose stop chatwoot_web chatwoot_worker evolution

sudo tar -czf "$BACKUP_DIR/postgres.tar.gz" -C /opt/crm/data/postgres .
sudo tar -czf "$BACKUP_DIR/redis.tar.gz" -C /opt/crm/data/redis .
sudo tar -czf "$BACKUP_DIR/chatwoot_storage.tar.gz" -C /opt/crm/data/chatwoot/storage .
sudo tar -czf "$BACKUP_DIR/chatwoot_public.tar.gz" -C /opt/crm/data/chatwoot/public .
sudo tar -czf "$BACKUP_DIR/evolution.tar.gz" -C /opt/crm/data/evolution .

cd /opt/crm
docker compose up -d
```

### 2.2 Restauração

```bash
# pare a stack
cd /opt/crm
docker compose down

# restaure os dados para os bind mounts
sudo tar -xzf /opt/crm/backups/YYYY-MM-DD/postgres.tar.gz -C /opt/crm/data/postgres
sudo tar -xzf /opt/crm/backups/YYYY-MM-DD/redis.tar.gz -C /opt/crm/data/redis
sudo tar -xzf /opt/crm/backups/YYYY-MM-DD/chatwoot_storage.tar.gz -C /opt/crm/data/chatwoot/storage
sudo tar -xzf /opt/crm/backups/YYYY-MM-DD/chatwoot_public.tar.gz -C /opt/crm/data/chatwoot/public
sudo tar -xzf /opt/crm/backups/YYYY-MM-DD/evolution.tar.gz -C /opt/crm/data/evolution

# suba novamente
cd /opt/crm
docker compose up -d
```

## 3) Checklist pós-restart

1. Containers ativos:

```bash
cd /opt/crm
docker compose ps
```

2. Mensagem de teste WhatsApp chega no Chatwoot.
3. Upload de anexo no Chatwoot funciona após reload da página.
4. Evolution permanece conectada (sem exigir novo QR indevidamente).
5. Logs sem erro crítico:

```bash
cd /opt/crm
docker compose logs --tail=200 chatwoot_web chatwoot_worker evolution
```
