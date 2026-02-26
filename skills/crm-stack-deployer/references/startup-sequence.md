# Startup sequence

```bash
./scripts/bootstrap-crm.sh
cd /opt/crm
nano .env

docker compose up -d postgres redis
docker compose up -d chatwoot_web chatwoot_worker
docker compose exec chatwoot_web bundle exec rails db:chatwoot_prepare
docker compose up -d evolution nginx certbot
```

## Expected checkpoints

- `chatwoot_web` and `chatwoot_worker` are healthy and not restarting.
- `db:chatwoot_prepare` exits with status 0.
- `evolution` container starts without authentication/config errors.
