import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { LinqClient, parseLinqWebhook } from '../lib/linq'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

test('incoming Linq voice-note media is preserved for the multimodal pipeline', () => {
  const parsed = parseLinqWebhook({
    event_type: 'message.received',
    event_id: 'event-voice',
    data: {
      id: 'message-voice',
      direction: 'inbound',
      service: 'iMessage',
      chat: {
        id: 'chat-voice',
        is_group: false,
        owner_handle: { handle: '+15555550101' },
      },
      sender_handle: { handle: '+15555550100' },
      parts: [
        { type: 'text', value: 'one more thing' },
        { type: 'media', url: 'https://media.linqapp.com/voice-note.m4a' },
      ],
    },
  })

  assert.equal(parsed?.text, 'one more thing')
  assert.deepEqual(parsed?.attachmentUrls, ['https://media.linqapp.com/voice-note.m4a'])
})

test('managed sends let Linq select and reuse the sender line', async () => {
  let requestUrl = ''
  let requestInit: RequestInit | undefined

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input)
    requestInit = init
    return new Response(
      JSON.stringify({
        chat_id: 'chat-managed',
        message: { id: 'message-managed' },
        from: '+15555550101',
        from_selection: { reason: 'reused_active_chat' },
      }),
      { status: 202, headers: { 'Content-Type': 'application/json' } }
    )
  }) as typeof fetch

  const client = new LinqClient({ apiKey: 'linq-test-key' })
  const result = await client.sendMessage({
    to: '+15555550100',
    content: 'your morning brief',
    idempotencyKey: 'brief:user:2026-08-10',
  })

  assert.equal(requestUrl, 'https://api.linqapp.com/api/partner/v3/messages')
  assert.equal(requestInit?.method, 'POST')
  assert.equal(new Headers(requestInit?.headers).get('Authorization'), 'Bearer linq-test-key')
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    to: ['+15555550100'],
    message: {
      parts: [{ type: 'text', value: 'your morning brief' }],
      idempotency_key: 'brief:user:2026-08-10',
    },
  })
  assert.deepEqual(result, {
    status: 'OK',
    message_id: 'message-managed',
    chat_id: 'chat-managed',
  })
})

test('inbound replies stay on the webhook chat', async () => {
  let requestUrl = ''
  let requestBody: unknown

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input)
    requestBody = JSON.parse(String(init?.body))
    return new Response(
      JSON.stringify({
        chat_id: 'chat-inbound',
        message: { id: 'message-reply' },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }) as typeof fetch

  const client = new LinqClient({ apiKey: 'linq-test-key' })
  const result = await client.sendMessage({
    to: '+15555550100',
    content: 'reply text',
    mediaUrl: 'https://pinch.example/api/chart/imessage?token=signed',
    chatId: 'chat-inbound',
    idempotencyKey: 'event:reply:0',
  })

  assert.equal(
    requestUrl,
    'https://api.linqapp.com/api/partner/v3/chats/chat-inbound/messages'
  )
  assert.deepEqual(requestBody, {
    message: {
      parts: [
        { type: 'text', value: 'reply text' },
        { type: 'media', url: 'https://pinch.example/api/chart/imessage?token=signed' },
      ],
      idempotency_key: 'event:reply:0',
    },
  })
  assert.deepEqual(result, {
    status: 'OK',
    message_id: 'message-reply',
    chat_id: 'chat-inbound',
  })
})

test('API failures are returned without leaking the bearer token', async () => {
  global.fetch = (async () =>
    new Response(JSON.stringify({ error: { message: 'recipient opted out' } }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch

  const client = new LinqClient({ apiKey: 'do-not-log-this-token' })
  const result = await client.sendMessage({
    to: '+15555550100',
    content: 'hello',
  })

  assert.deepEqual(result, {
    status: 'ERROR',
    error: 'recipient opted out',
  })
  assert.equal(JSON.stringify(result).includes('do-not-log-this-token'), false)
})
