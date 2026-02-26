---
name: crm-stack-deployer
description: Deploy and bootstrap a WhatsApp CRM stack with Chatwoot, Evolution API, PostgreSQL, Redis, Nginx and Certbot on Ubuntu VPS using Docker Compose. Use when the user asks to install, configure, or bring this CRM stack to production.
---

# CRM Stack Deployer

Use this skill when the user asks to provision, deploy, or validate this repository's Chatwoot+Evolution stack.

## Workflow

1. **Bootstrap host directories and env**
   - Run `scripts/bootstrap-crm.sh`.
   - Confirm `/opt/crm/.env` exists and placeholders were replaced.
2. **Start services in safe order**
   - Follow the exact sequence in `references/startup-sequence.md`.
3. **Prepare Chatwoot DB**
   - Execute `rails db:chatwoot_prepare` from `chatwoot_web`.
4. **Issue TLS and reload Nginx**
   - Use commands in `references/tls-and-proxy.md`.
5. **Run go-live validation**
   - Execute checks in `references/go-live-checklist.md`.

## Files to load when needed

- Startup order and mandatory commands: `references/startup-sequence.md`
- TLS and reverse-proxy validation: `references/tls-and-proxy.md`
- Operational acceptance checks: `references/go-live-checklist.md`

## Notes

- Prefer existing project scripts over rewriting deployment commands.
- Never log secret values from `.env`.
- If Docker is unavailable, stop and report environment limitation with next actions.
