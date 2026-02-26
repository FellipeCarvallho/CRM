'use strict';

/**
 * Follow-up job:
 * 1) Pagina contatos até exaurir resultados.
 * 2) Processa em lotes com limite de concorrência.
 * 3) Retry com backoff para erros transitórios (Evolution/Chatwoot).
 * 4) Registra resultado por contato para observabilidade.
 * 5) Marca recompra_agendada somente após confirmação de envio.
 */

const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULTS = {
  CONTACTS_PAGE_SIZE: Number(process.env.CONTACTS_PAGE_SIZE || 100),
  CONCURRENCY_LIMIT: Number(process.env.CONCURRENCY_LIMIT || 8),
  MAX_RETRIES: Number(process.env.MAX_RETRIES || 4),
  BASE_BACKOFF_MS: Number(process.env.BASE_BACKOFF_MS || 500),
  OBSERVABILITY_FILE: process.env.OBSERVABILITY_FILE || path.resolve(process.cwd(), 'followup-results.jsonl'),
};

const TRANSIENT_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(error) {
  const status = error?.status ?? error?.response?.status;
  if (TRANSIENT_STATUS_CODES.has(status)) return true;

  const code = error?.code;
  if (code && ['ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED', 'EAI_AGAIN'].includes(code)) {
    return true;
  }

  const message = String(error?.message || '').toLowerCase();
  return message.includes('timeout') || message.includes('network') || message.includes('temporar');
}

async function withRetry(actionName, fn, { maxRetries, baseDelayMs }) {
  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (error) {
      const transient = isTransientError(error);
      if (!transient || attempt >= maxRetries) {
        error.message = `[${actionName}] ${error.message}`;
        throw error;
      }

      const jitter = Math.floor(Math.random() * 200);
      const delay = Math.min(30_000, baseDelayMs * 2 ** attempt + jitter);
      attempt += 1;
      console.warn(`Tentativa ${attempt}/${maxRetries} falhou em ${actionName}; retry em ${delay}ms.`, {
        status: error?.status ?? error?.response?.status,
        code: error?.code,
        message: error?.message,
      });
      await sleep(delay);
    }
  }
}

async function appendResult(record, filePath) {
  const payload = JSON.stringify({
    ...record,
    timestamp: new Date().toISOString(),
  });
  await fs.appendFile(filePath, `${payload}\n`, 'utf8');
}

async function fetchContactsPage({ cursor = null, limit = DEFAULTS.CONTACTS_PAGE_SIZE }) {
  // TODO: substituir pela integração real do CRM.
  const response = await fetch('http://localhost:3000/internal/contacts/followup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cursor, limit }),
  });

  if (!response.ok) {
    const err = new Error(`Falha ao buscar contatos: HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

async function sendMessageViaEvolution(contact) {
  const response = await fetch('http://localhost:3000/internal/evolution/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contactId: contact.id,
      phone: contact.phone,
      message: contact.followupMessage,
    }),
  });

  if (!response.ok) {
    const err = new Error(`Falha no envio Evolution: HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  if (!data?.sent) {
    const err = new Error('Evolution não confirmou envio (sent=false).');
    err.status = 502;
    throw err;
  }

  return data;
}

async function syncMessageToChatwoot(contact, evolutionResult) {
  const response = await fetch('http://localhost:3000/internal/chatwoot/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contactId: contact.id,
      externalMessageId: evolutionResult.messageId,
      content: contact.followupMessage,
    }),
  });

  if (!response.ok) {
    const err = new Error(`Falha no Chatwoot: HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

async function markRecompraAgendada(contactId, payload = {}) {
  const response = await fetch(`http://localhost:3000/internal/contacts/${contactId}/recompra-agendada`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ recompra_agendada: true, ...payload }),
  });

  if (!response.ok) {
    const err = new Error(`Falha ao marcar recompra_agendada: HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

async function processContact(contact) {
  if (!contact?.id) {
    return {
      status: 'ignored',
      reason: 'contact_id_missing',
    };
  }

  if (contact.recompra_agendada) {
    return {
      status: 'ignored',
      reason: 'already_scheduled',
    };
  }

  if (!contact.phone || !contact.followupMessage) {
    return {
      status: 'ignored',
      reason: 'missing_required_data',
    };
  }

  const evolutionResult = await withRetry(
    `evolution-send:${contact.id}`,
    () => sendMessageViaEvolution(contact),
    { maxRetries: DEFAULTS.MAX_RETRIES, baseDelayMs: DEFAULTS.BASE_BACKOFF_MS },
  );

  await withRetry(
    `chatwoot-sync:${contact.id}`,
    () => syncMessageToChatwoot(contact, evolutionResult),
    { maxRetries: DEFAULTS.MAX_RETRIES, baseDelayMs: DEFAULTS.BASE_BACKOFF_MS },
  );

  // Somente marca após confirmação de envio da mensagem.
  await markRecompraAgendada(contact.id, {
    sent_message_id: evolutionResult.messageId,
    sent_at: evolutionResult.sentAt || new Date().toISOString(),
  });

  return {
    status: 'sent',
    messageId: evolutionResult.messageId,
  };
}

async function runWithConcurrency(items, limit, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) continue;
      await worker(item);
    }
  });

  await Promise.all(workers);
}

async function runFollowupJob() {
  let cursor = null;
  let pageNumber = 0;
  let totalProcessed = 0;

  while (true) {
    pageNumber += 1;

    const page = await withRetry(
      `fetch-contacts-page:${pageNumber}`,
      () => fetchContactsPage({ cursor, limit: DEFAULTS.CONTACTS_PAGE_SIZE }),
      { maxRetries: DEFAULTS.MAX_RETRIES, baseDelayMs: DEFAULTS.BASE_BACKOFF_MS },
    );

    const contacts = Array.isArray(page?.contacts) ? page.contacts : [];
    if (contacts.length === 0) {
      console.info(`Página ${pageNumber} sem contatos. Encerrando job.`);
      break;
    }

    await runWithConcurrency(contacts, DEFAULTS.CONCURRENCY_LIMIT, async (contact) => {
      try {
        const result = await processContact(contact);
        totalProcessed += 1;
        await appendResult(
          {
            contactId: contact.id,
            phone: contact.phone,
            page: pageNumber,
            ...result,
          },
          DEFAULTS.OBSERVABILITY_FILE,
        );
      } catch (error) {
        totalProcessed += 1;
        await appendResult(
          {
            contactId: contact.id,
            phone: contact.phone,
            page: pageNumber,
            status: 'error',
            error: {
              message: error?.message,
              status: error?.status ?? error?.response?.status,
              code: error?.code,
            },
          },
          DEFAULTS.OBSERVABILITY_FILE,
        );
      }
    });

    cursor = page?.nextCursor ?? null;
    if (!cursor) {
      console.info(`Sem nextCursor após página ${pageNumber}. Encerrando job.`);
      break;
    }
  }

  console.info(`Follow-up finalizado. Total processado: ${totalProcessed}.`);
}

if (require.main === module) {
  runFollowupJob().catch((error) => {
    console.error('Erro fatal no follow-up:', error);
    process.exitCode = 1;
  });
}

module.exports = {
  runFollowupJob,
  processContact,
  withRetry,
  isTransientError,
};
