// Test the Linq webhook handler end-to-end against a running dev server.
//
// Usage:
//   npm run dev   (in packages/api, separate terminal)
//   node tests/test-linq-webhook.js [phone] [message] [url]
//
// If LINQ_WEBHOOK_SECRET is set in .env.local, this signs the request using
// the same Standard Webhooks scheme Linq uses in production.

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) return {}
  const env = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
  return env
}

async function main() {
  const env = loadEnvLocal()
  const sender = process.argv[2] || '+15555550100'
  const text = process.argv[3] || 'hey pinch, should i take a sick day tomorrow?'
  const url = process.argv[4] || 'http://localhost:3000/api/webhook/linq?version=2026-02-03'
  const eventId = crypto.randomUUID()

  const payload = {
    api_version: 'v3',
    webhook_version: '2026-02-03',
    event_type: 'message.received',
    event_id: eventId,
    created_at: new Date().toISOString(),
    trace_id: crypto.randomBytes(16).toString('hex'),
    partner_id: 'partner_test',
    data: {
      chat: {
        id: crypto.randomUUID(),
        is_group: false,
        owner_handle: {
          id: crypto.randomUUID(),
          handle: env.LINQ_FROM_NUMBER || '+15555550101',
          is_me: true,
          joined_at: new Date().toISOString(),
          service: 'iMessage',
          status: 'active',
        },
      },
      id: crypto.randomUUID(),
      direction: 'inbound',
      sender_handle: {
        id: crypto.randomUUID(),
        handle: sender,
        is_me: false,
        joined_at: new Date().toISOString(),
        service: 'iMessage',
        status: 'active',
      },
      parts: [{ type: 'text', value: text }],
      sent_at: new Date().toISOString(),
      service: 'iMessage',
    },
  }

  const rawBody = JSON.stringify(payload)
  const headers = { 'Content-Type': 'application/json' }

  if (env.LINQ_WEBHOOK_SECRET) {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const encodedSecret = env.LINQ_WEBHOOK_SECRET.startsWith('whsec_')
      ? env.LINQ_WEBHOOK_SECRET.slice('whsec_'.length)
      : env.LINQ_WEBHOOK_SECRET
    const key = Buffer.from(encodedSecret, 'base64')
    const signature = crypto
      .createHmac('sha256', key)
      .update(`${eventId}.${timestamp}.${rawBody}`)
      .digest('base64')

    headers['webhook-id'] = eventId
    headers['webhook-timestamp'] = timestamp
    headers['webhook-signature'] = `v1,${signature}`
    console.log('🔐 Signing request with LINQ_WEBHOOK_SECRET from .env.local')
  } else {
    console.log('⚠️  No LINQ_WEBHOOK_SECRET in .env.local - sending unsigned')
  }

  console.log(`📤 POST ${url}`)
  console.log(`📤 From: ${sender}`)
  console.log(`📤 Message: "${text}"`)

  const start = Date.now()
  const response = await fetch(url, { method: 'POST', headers, body: rawBody })
  const responseText = await response.text()

  console.log(`📥 HTTP ${response.status} (${Date.now() - start}ms)`)
  console.log(`📥 Body: ${responseText}`)

  if (response.ok) {
    console.log('✅ Webhook accepted the message - check the dev server logs')
    console.log('   for the AI response and the Linq send result.')
  } else {
    console.log('❌ Webhook rejected the message')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('❌ Test failed:', error.message)
  process.exit(1)
})
