const CHATWOOT_URL = process.env.CHATWOOT_URL
const CHATWOOT_TOKEN = process.env.CHATWOOT_AGENT_TOKEN
const ACCOUNT_ID = process.env.ACCOUNT_ID || 1

const processedOrders = new Set()

export async function notifyOrderToChatwoot(order) {
  if (!order?.id || processedOrders.has(order.id)) {
    return
  }

  try {
    const contact = await searchContactByPhone(order.clientPhone)
    if (!contact) return

    const conversation = await findBestConversation(contact.id)
    if (!conversation) return

    await postOrderNote(conversation.id, order)
    await updateContactAttributes(contact, order)

    processedOrders.add(order.id)
    console.info('order_notified', {
      order_id: order.id,
      contact_id: contact.id,
      conversation_id: conversation.id
    })
  } catch (error) {
    console.error('order_notify_failed', { order_id: order?.id, error: error.message })
    throw error
  }
}

async function searchContactByPhone(phone) {
  const search = await fetch(
    `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/search?q=${encodeURIComponent(phone)}`,
    { headers: { api_access_token: CHATWOOT_TOKEN } }
  )
  if (!search.ok) throw new Error(`contacts_search_failed:${search.status}`)

  const data = await search.json()
  const contacts = data?.payload?.contacts || []
  return contacts[0]
}

async function findBestConversation(contactId) {
  const convRes = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/${contactId}/conversations`, {
    headers: { api_access_token: CHATWOOT_TOKEN }
  })
  if (!convRes.ok) throw new Error(`contact_conversations_failed:${convRes.status}`)

  const convData = await convRes.json()
  const conversations = convData?.payload || []

  return conversations
    .filter((c) => ['open', 'pending'].includes(c.status))
    .sort((a, b) => new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0))[0]
}

async function postOrderNote(conversationId, order) {
  const payload = {
    content:
      `🧾 *Pedido Confirmado #${order.id}*\n\n` +
      `📦 Itens: ${order.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}\n` +
      `💰 Total: R$ ${Number(order.total).toFixed(2)}\n` +
      `📍 Endereço: ${order.deliveryAddress}`,
    message_type: 'activity',
    private: true
  }

  const res = await fetch(
    `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        api_access_token: CHATWOOT_TOKEN
      },
      body: JSON.stringify(payload)
    }
  )

  if (!res.ok) throw new Error(`post_order_note_failed:${res.status}`)
}

async function updateContactAttributes(contact, order) {
  const body = {
    additional_attributes: {
      ...(contact.additional_attributes || {}),
      ltv: Number(contact.additional_attributes?.ltv || 0) + Number(order.total),
      last_order_id: String(order.id),
      last_order_date: new Date().toISOString()
    }
  }

  const res = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/${contact.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      api_access_token: CHATWOOT_TOKEN
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) throw new Error(`update_contact_attributes_failed:${res.status}`)
}
