const CHATWOOT_URL = process.env.CHATWOOT_URL
const CHATWOOT_TOKEN = process.env.CHATWOOT_TOKEN
const ACCOUNT_ID = process.env.ACCOUNT_ID
const EVOLUTION_URL = process.env.EVOLUTION_URL
const EVOLUTION_APIKEY = process.env.EVOLUTION_APIKEY
const RECOMPRA_DIAS = Number(process.env.RECOMPRA_DIAS || 7)

if (!CHATWOOT_URL || !CHATWOOT_TOKEN || !ACCOUNT_ID || !EVOLUTION_URL || !EVOLUTION_APIKEY) {
  throw new Error('Variáveis obrigatórias ausentes para followup job')
}

async function runRecompraFollowUp() {
  const contacts = await listAllContacts()
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - RECOMPRA_DIAS)

  for (const contact of contacts) {
    const lastOrder = contact.additional_attributes?.last_order_date
    if (!lastOrder) continue

    const lastOrderDate = new Date(lastOrder)
    if (lastOrderDate >= threshold || contact.additional_attributes?.recompra_agendada) {
      continue
    }

    const firstName = contact.name?.split(' ')[0] || 'cliente'
    const payload = {
      number: contact.phone_number,
      text: `Olá ${firstName}! 💧 Faz ${RECOMPRA_DIAS} dias desde seu último pedido. Tá precisando de água? Responda *SIM* para renovar!`
    }

    const sent = await retry(() => sendEvolutionText(payload), 3)
    if (!sent) {
      console.error('followup_send_failed', { contact_id: contact.id })
      continue
    }

    await markContactFollowup(contact)
    console.log(`Follow-up enviado para ${contact.name}`)
  }
}

async function listAllContacts() {
  let page = 1
  const all = []

  while (true) {
    const res = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts?page=${page}`, {
      headers: { api_access_token: CHATWOOT_TOKEN }
    })

    if (!res.ok) {
      throw new Error(`contacts_list_failed:${res.status}`)
    }

    const data = await res.json()
    const contacts = data.payload?.contacts || []
    all.push(...contacts)

    if (!contacts.length) break
    page += 1
  }

  return all
}

async function sendEvolutionText(body) {
  const res = await fetch(`${EVOLUTION_URL}/message/sendText/principal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: EVOLUTION_APIKEY
    },
    body: JSON.stringify(body)
  })

  return res.ok
}

async function markContactFollowup(contact) {
  const res = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/${contact.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      api_access_token: CHATWOOT_TOKEN
    },
    body: JSON.stringify({
      additional_attributes: {
        ...(contact.additional_attributes || {}),
        recompra_agendada: true
      }
    })
  })

  if (!res.ok) {
    throw new Error(`mark_followup_failed:${res.status}`)
  }
}

async function retry(fn, maxRetries) {
  let attempt = 0
  while (attempt < maxRetries) {
    const ok = await fn()
    if (ok) return true
    attempt += 1
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
  }
  return false
}

runRecompraFollowUp().catch((error) => {
  console.error('followup_job_failed', error)
  process.exit(1)
})
