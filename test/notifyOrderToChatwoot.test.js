import test from 'node:test';
import assert from 'node:assert/strict';

import {
  notifyOrderToChatwoot,
  extractContacts,
  extractConversations,
  selectConversation,
} from '../src/integrations/chatwoot/notifyOrderToChatwoot.js';

test('extractContacts aceita múltiplos formatos de resposta', () => {
  assert.equal(extractContacts({ payload: [{ id: 1 }] }).length, 1);
  assert.equal(extractContacts({ data: { payload: [{ id: 1 }] } }).length, 1);
  assert.equal(extractContacts({ data: { contacts: [{ id: 1 }] } }).length, 1);
  assert.equal(extractContacts({ contacts: [{ id: 1 }] }).length, 1);
  assert.equal(extractContacts({ foo: 'bar' }).length, 0);
});

test('extractConversations aceita múltiplos formatos de resposta', () => {
  assert.equal(extractConversations({ payload: [{ id: 1 }] }).length, 1);
  assert.equal(extractConversations({ data: { payload: [{ id: 1 }] } }).length, 1);
  assert.equal(extractConversations({ data: { conversations: [{ id: 1 }] } }).length, 1);
  assert.equal(extractConversations({ conversations: [{ id: 1 }] }).length, 1);
  assert.equal(extractConversations({ foo: 'bar' }).length, 0);
});

test('selectConversation filtra status e pega conversa mais recente', () => {
  const selected = selectConversation([
    { id: 1, status: 'resolved', last_activity_at: '2020-01-01T00:00:00.000Z' },
    { id: 2, status: 'open', last_activity_at: '2020-01-01T00:00:00.000Z' },
    { id: 3, status: 'pending', last_activity_at: '2024-01-01T00:00:00.000Z' },
  ]);

  assert.equal(selected.id, 3);
});

test('notifyOrderToChatwoot pula evento duplicado por idempotência', async () => {
  const calls = [];
  const apiClient = {
    async get(url) {
      calls.push(['get', url]);
      if (url.endsWith('/contacts/search')) {
        return {
          data: {
            payload: [{
              id: 100,
              phone_number: '+551199999999',
              custom_attributes: { order_confirmed_note_keys: ['order:confirmed:abc'] },
            }],
          },
        };
      }
      throw new Error('chamada inesperada');
    },
    async post() {
      throw new Error('não deveria postar');
    },
    async patch() {
      throw new Error('não deveria patch');
    },
  };

  const result = await notifyOrderToChatwoot({
    order: { id: 'abc' },
    customerPhone: '+551199999999',
    accountId: 1,
    apiClient,
    logger: () => {},
  });

  assert.equal(result.status, 'skipped');
  assert.equal(result.reason, 'duplicate_event');
  assert.equal(calls.length, 1);
});

test('notifyOrderToChatwoot envia nota e atualiza contato', async () => {
  const calls = [];
  const apiClient = {
    async get(url) {
      calls.push(['get', url]);
      if (url.endsWith('/contacts/search')) {
        return {
          data: {
            payload: [{ id: 123, phone_number: '+551188877766', custom_attributes: {} }],
          },
        };
      }
      if (url.endsWith('/contacts/123/conversations')) {
        return {
          data: {
            payload: [
              { id: 90, status: 'open', last_activity_at: '2022-01-01T00:00:00.000Z' },
              { id: 99, status: 'pending', last_activity_at: '2024-01-01T00:00:00.000Z' },
            ],
          },
        };
      }
      throw new Error(`URL não esperada: ${url}`);
    },
    async post(url, payload) {
      calls.push(['post', url, payload]);
      return { data: { id: 777 } };
    },
    async patch(url, payload) {
      calls.push(['patch', url, payload]);
      return { data: { id: 123, ...payload } };
    },
  };

  const result = await notifyOrderToChatwoot({
    order: { id: 'ORD-9' },
    customerPhone: '+551188877766',
    accountId: 1,
    apiClient,
    logger: () => {},
  });

  assert.equal(result.status, 'sent');
  assert.equal(result.correlation.orderId, 'ORD-9');
  assert.equal(result.correlation.contactId, 123);
  assert.equal(result.correlation.conversationId, 99);

  assert.equal(calls[2][0], 'post');
  assert.match(calls[2][2].content, /order:confirmed:ORD-9/);
  assert.equal(calls[3][0], 'patch');
  assert.deepEqual(calls[3][2].custom_attributes.order_confirmed_note_keys, ['order:confirmed:ORD-9']);
});
