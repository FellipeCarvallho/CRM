# Follow-up debug

1. Validate pagination loops through all contacts (not only page=1).
2. Validate retry/backoff for transient Evolution/Chatwoot errors.
3. Ensure `recompra_agendada` is patched only after successful send.
4. Check cron/PM2 schedule and logs for daily execution.

Quick checks:

```bash
node --check bot/followup.job.js
```
