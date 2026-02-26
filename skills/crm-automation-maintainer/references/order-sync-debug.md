# Order sync debug

Core module: `src/integrations/chatwoot/notifyOrderToChatwoot.js`
Adapter: `integration/notifyOrderToChatwoot.js`

Checklist:

- Contact search shape parsing (`extractContacts`) still handles provider payload variants.
- Conversation selection filters open/pending and latest activity.
- Idempotency key `order:confirmed:<id>` persists in contact attributes.
- Adapter does not reimplement core logic; it should delegate.

Run:

```bash
npm test
```
