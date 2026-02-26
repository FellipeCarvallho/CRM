'use strict';

const OPEN_STATUSES = new Set(['open', 'pending']);
const WHATSAPP_CHANNELS = new Set(['Channel::Whatsapp', 'whatsapp']);

function nowIso() {
  return new Date().toISOString();
}

function toEpoch(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function defaultLogger(entry) {
  console.log(JSON.stringify(entry));
}

function normalizeListResponse(response, candidates) {
  if (!response || typeof response !== 'object') return [];

  for (const path of candidates) {
    let cursor = response;
    let validPath = true;
    for (const segment of path) {
      if (!cursor || typeof cursor !== 'object' || !(segment in cursor)) {
        validPath = false;
        break;
      }
      cursor = cursor[segment];
    }
    if (validPath && Array.isArray(cursor)) return cursor;
  }

  if (Array.isArray(response)) return response;
  return [];
}

function extractContacts(searchResponse) {
  return normalizeListResponse(searchResponse, [
    ['payload'],
    ['data', 'payload'],
    ['data', 'contacts'],
    ['contacts'],
  ]);
}

function extractConversations(conversationsResponse) {
  return normalizeListResponse(conversationsResponse, [
    ['payload'],
    ['data', 'payload'],
    ['data', 'conversations'],
    ['conversations'],
  ]);
}

function isWhatsAppConversation(conversation, allowedInboxIds) {
  const inboxId = conversation?.inbox_id ?? conversation?.meta?.inbox?.id;
  const inboxChannel = conversation?.meta?.channel ?? conversation?.meta?.inbox?.channel_type;

  if (Array.isArray(allowedInboxIds) && allowedInboxIds.length > 0) {
    return allowedInboxIds.includes(inboxId);
  }

  if (typeof inboxChannel === 'string') {
    return WHATSAPP_CHANNELS.has(inboxChannel);
  }

  return true;
}

function selectConversation(conversations, options = {}) {
  const filtered = conversations
    .filter((conversation) => {
      const status = conversation?.status;
      if (!OPEN_STATUSES.has(status)) return false;
      return isWhatsAppConversation(conversation, options.allowedInboxIds);
    })
    .sort((a, b) => toEpoch(b?.last_activity_at || b?.updated_at || b?.created_at) - toEpoch(a?.last_activity_at || a?.updated_at || a?.created_at));

  return filtered[0] || null;
}

function buildCorrelation({ orderId, contactId, conversationId }) {
  return {
    orderId: orderId ?? null,
    contactId: contactId ?? null,
    conversationId: conversationId ?? null,
  };
}

function buildIdempotencyKey(orderId) {
  return `order:confirmed:${orderId}`;
}

function readIdempotencyKeys(contact) {
  const keys = contact?.custom_attributes?.order_confirmed_note_keys;
  return Array.isArray(keys) ? keys : [];
}

function appendUnique(list, value) {
  return list.includes(value) ? list : [...list, value];
}

async function notifyOrderToChatwoot({
  order,
  customerPhone,
  accountId,
  apiClient,
  logger = defaultLogger,
  allowedInboxIds,
}) {
  if (!order || !order.id) {
    throw new Error('order.id é obrigatório');
  }
  if (!customerPhone) {
    throw new Error('customerPhone é obrigatório');
  }
  if (!accountId) {
    throw new Error('accountId é obrigatório');
  }
  if (!apiClient || typeof apiClient.get !== 'function' || typeof apiClient.post !== 'function' || typeof apiClient.patch !== 'function') {
    throw new Error('apiClient deve implementar get/post/patch');
  }

  const orderId = order.id;
  const idempotencyKey = buildIdempotencyKey(orderId);
  const correlation = buildCorrelation({ orderId });

  let contact;
  try {
    const searchResponse = await apiClient.get(`/api/v1/accounts/${accountId}/contacts/search`, {
      params: { q: customerPhone },
    });
    const contacts = extractContacts(searchResponse?.data ?? searchResponse);

    logger({ timestamp: nowIso(), level: 'info', step: 'search', status: 'ok', count: contacts.length, correlation });

    contact = contacts.find((candidate) => candidate?.phone_number === customerPhone || candidate?.identifier === customerPhone) || contacts[0];
    if (!contact?.id) {
      logger({ timestamp: nowIso(), level: 'warn', step: 'search', status: 'not_found', correlation });
      return { status: 'skipped', reason: 'contact_not_found', correlation };
    }
  } catch (error) {
    logger({ timestamp: nowIso(), level: 'error', step: 'search', status: 'failed', message: error.message, correlation });
    throw error;
  }

  correlation.contactId = contact.id;

  const existingKeys = readIdempotencyKeys(contact);
  if (existingKeys.includes(idempotencyKey)) {
    logger({ timestamp: nowIso(), level: 'info', step: 'idempotency', status: 'duplicate', idempotencyKey, correlation });
    return { status: 'skipped', reason: 'duplicate_event', correlation };
  }

  let conversation;
  try {
    const conversationsResponse = await apiClient.get(`/api/v1/accounts/${accountId}/contacts/${contact.id}/conversations`);
    const conversations = extractConversations(conversationsResponse?.data ?? conversationsResponse);
    conversation = selectConversation(conversations, { allowedInboxIds });

    logger({
      timestamp: nowIso(),
      level: 'info',
      step: 'list_conversations',
      status: conversation ? 'ok' : 'not_found',
      count: conversations.length,
      correlation,
    });

    if (!conversation?.id) {
      return { status: 'skipped', reason: 'conversation_not_found', correlation };
    }
  } catch (error) {
    logger({ timestamp: nowIso(), level: 'error', step: 'list_conversations', status: 'failed', message: error.message, correlation });
    throw error;
  }

  correlation.conversationId = conversation.id;

  const noteContent = `[${idempotencyKey}] Pedido confirmado #${orderId}`;

  try {
    await apiClient.post(`/api/v1/accounts/${accountId}/conversations/${conversation.id}/messages`, {
      content: noteContent,
      message_type: 'outgoing',
      private: true,
    });

    logger({ timestamp: nowIso(), level: 'info', step: 'post_message', status: 'ok', correlation, idempotencyKey });
  } catch (error) {
    logger({ timestamp: nowIso(), level: 'error', step: 'post_message', status: 'failed', message: error.message, correlation });
    throw error;
  }

  try {
    const updatedKeys = appendUnique(existingKeys, idempotencyKey);
    await apiClient.patch(`/api/v1/accounts/${accountId}/contacts/${contact.id}`, {
      custom_attributes: {
        ...(contact.custom_attributes || {}),
        order_confirmed_note_keys: updatedKeys,
      },
    });

    logger({ timestamp: nowIso(), level: 'info', step: 'patch_contact', status: 'ok', correlation, idempotencyKey });
  } catch (error) {
    logger({ timestamp: nowIso(), level: 'error', step: 'patch_contact', status: 'failed', message: error.message, correlation });
    throw error;
  }

  return {
    status: 'sent',
    correlation,
    idempotencyKey,
  };
}

module.exports = {
  notifyOrderToChatwoot,
  extractContacts,
  extractConversations,
  selectConversation,
  buildIdempotencyKey,
};
