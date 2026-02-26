# Bot debug

1. Validate envs: `CHATWOOT_URL`, `CHATWOOT_TOKEN`, `ACCOUNT_ID`, `OLLAMA_URL`, `TEAM_ID_VENDAS`.
2. Confirm Chatwoot sends webhook to `/bot/chatwoot`.
3. Validate message filter only processes inbound user messages.
4. Confirm transfer keywords produce assignment and transfer response.

Quick checks:

```bash
node --check bot/bot-server.js
```
