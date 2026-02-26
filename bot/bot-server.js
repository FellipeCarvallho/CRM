import Fastify from 'fastify'

const app = Fastify({ logger: true })
const CHATWOOT_URL = process.env.CHATWOOT_URL
const CHATWOOT_TOKEN = process.env.CHATWOOT_TOKEN
const ACCOUNT_ID = process.env.ACCOUNT_ID
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat'
const TEAM_ID = Number(process.env.TEAM_ID_VENDAS || 1)
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000)

if (!CHATWOOT_URL || !CHATWOOT_TOKEN || !ACCOUNT_ID) {
  throw new Error('CHATWOOT_URL, CHATWOOT_TOKEN e ACCOUNT_ID são obrigatórios')
}

const SYSTEM_PROMPT = `
Você é o assistente virtual da [NOME DA EMPRESA], distribuidora de água.
Responda de forma curta, direta e cordial.
Produtos disponíveis: Galão 20L (R$X), Caixa 500ml (R$Y).
Horário: Seg-Sab 7h-18h.
Se não souber responder, diga "Vou chamar um atendente para te ajudar!".
Nunca invente preços ou prazos.
`

app.post('/bot/chatwoot', async (req, reply) => {
  try {
    const { event, conversation, messages } = req.body
    if (event !== 'message_created') return reply.send({ status: 'ignored' })

    const lastMessage = messages?.[0]
    if (!lastMessage || lastMessage.message_type !== 0 || !lastMessage.content) {
      return reply.send({ status: 'ignored_non_inbound' })
    }

    const conversationId = conversation?.id
    if (!conversationId) return reply.code(400).send({ error: 'conversation_id ausente' })

    const userText = lastMessage.content
    const history = await fetchConversationHistory(conversationId)
    const botReply = await askOllama(userText, history)

    const transferKeywords = ['atendente', 'humano', 'pessoa', 'falar com alguém']
    const shouldTransfer = transferKeywords.some((k) => userText.toLowerCase().includes(k))

    if (shouldTransfer || botReply.toLowerCase().includes('atendente')) {
      await assignToTeam(conversationId, TEAM_ID)
      await sendChatwootMessage(conversationId, '👤 Te conectando com um atendente agora mesmo!')
    } else {
      await sendChatwootMessage(conversationId, botReply)
    }

    return reply.send({ status: 'ok' })
  } catch (error) {
    req.log.error({ err: error }, 'Falha no processamento do bot')
    return reply.code(500).send({ status: 'error', message: 'falha_no_bot' })
  }
})

async function fetchConversationHistory(conversationId) {
  const histRes = await fetch(
    `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}/messages`,
    { headers: { api_access_token: CHATWOOT_TOKEN }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
  )

  if (!histRes.ok) {
    throw new Error(`Falha ao buscar histórico: ${histRes.status}`)
  }

  const histData = await histRes.json()
  return (histData.payload || [])
    .filter((m) => !m.private && m.content)
    .slice(-10)
    .map((m) => ({
      role: m.message_type === 0 ? 'user' : 'assistant',
      content: m.content
    }))
}

async function askOllama(userText, history) {
  const ollamaRes = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model: 'llama3',
      stream: false,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content: userText }]
    })
  })

  if (!ollamaRes.ok) {
    return 'Vou chamar um atendente para te ajudar!'
  }

  const ollamaData = await ollamaRes.json()
  return ollamaData.message?.content || 'Vou chamar um atendente para te ajudar!'
}

async function assignToTeam(conversationId, teamId) {
  const res = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}/assignments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      api_access_token: CHATWOOT_TOKEN
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({ team_id: teamId })
  })

  if (!res.ok) {
    throw new Error(`Falha ao atribuir conversa: ${res.status}`)
  }
}

async function sendChatwootMessage(conversationId, content) {
  const res = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      api_access_token: CHATWOOT_TOKEN
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({ content, message_type: 'outgoing', private: false })
  })

  if (!res.ok) {
    throw new Error(`Falha ao enviar mensagem Chatwoot: ${res.status}`)
  }
}

app.listen({ port: 3001, host: '0.0.0.0' })
