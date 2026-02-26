---
name: crm-automation-maintainer
description: Maintain and troubleshoot CRM automation flows for Chatwoot, Evolution API, bot webhook, and follow-up jobs in this repository. Use when users ask to debug, improve, or validate bot/follow-up/order-sync automations.
---

# CRM Automation Maintainer

Use this skill for issues in bot replies, human handoff, order notes, idempotency, follow-up scheduling, and contact attribute updates.

## Workflow

1. **Run fast static checks**
   - `node --check bot/bot-server.js`
   - `node --check bot/followup.job.js`
   - `node --check integration/notifyOrderToChatwoot.js`
2. **Run integration-focused tests**
   - `npm test`
3. **Debug by subsystem**
   - Bot webhook: `references/bot-debug.md`
   - Order sync/idempotency: `references/order-sync-debug.md`
   - Follow-up job: `references/followup-debug.md`
4. **Patch smallest safe fix** and rerun checks.

## References

- `references/bot-debug.md`
- `references/order-sync-debug.md`
- `references/followup-debug.md`

## Guardrails

- Preserve idempotency semantics for order-confirmed events.
- Mark `recompra_agendada` only after confirmed send.
- Do not duplicate business logic when an existing tested module already exists.
