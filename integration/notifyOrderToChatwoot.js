import { notifyOrderToChatwoot as coreNotifyOrderToChatwoot } from '../src/integrations/chatwoot/notifyOrderToChatwoot.js';

const CHATWOOT_URL = process.env.CHATWOOT_URL;
const CHATWOOT_TOKEN = process.env.CHATWOOT_AGENT_TOKEN;
const ACCOUNT_ID = Number(process.env.ACCOUNT_ID || 1);

if (!CHATWOOT_URL || !CHATWOOT_TOKEN || !ACCOUNT_ID) {
  throw new Error('CHATWOOT_URL, CHATWOOT_AGENT_TOKEN e ACCOUNT_ID são obrigatórios');
}

function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    api_access_token: CHATWOOT_TOKEN,
  };
}

const apiClient = {
  async get(path, options = {}) {
    const url = new URL(path, CHATWOOT_URL);
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        url.searchParams.set(key, String(value));
      }
    }

    const res = await fetch(url, { headers: { api_access_token: CHATWOOT_TOKEN } });
    if (!res.ok) throw new Error(`chatwoot_get_failed:${res.status}:${path}`);
    return { data: await res.json() };
  },

  async post(path, payload) {
    const url = new URL(path, CHATWOOT_URL);
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`chatwoot_post_failed:${res.status}:${path}`);
    return { data: await safeJson(res) };
  },

  async patch(path, payload) {
    const url = new URL(path, CHATWOOT_URL);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`chatwoot_patch_failed:${res.status}:${path}`);
    return { data: await safeJson(res) };
  },
};

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function notifyOrderToChatwoot(order) {
  return coreNotifyOrderToChatwoot({
    order,
    customerPhone: order?.clientPhone,
    accountId: ACCOUNT_ID,
    apiClient,
    logger: (entry) => console.info('notify_order_chatwoot', entry),
  });
}
