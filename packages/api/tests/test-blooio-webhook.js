// Test the Blooio webhook handler end-to-end against a running dev server.
//
// Usage:
//   npm run dev   (in packages/api, separate terminal)
//   node tests/test-blooio-webhook.js [phone] [message] [url]
//
// If BLOOIO_WEBHOOK_SECRET is set in .env.local, the request is signed the
// same way Blooio signs real deliveries (X-Blooio-Signature: t=<ts>,v1=<hmac>
// over "<ts>.<raw_body>"), so signature verification is exercised too.
//
// Pass your own phone number as [phone] to receive Pinch's reply on your
// phone (requires a provisioned Blooio number). With the default fake
// number, the AI pipeline runs but the final send fails harmlessly.

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
  const url = process.argv[4] || 'http://localhost:3000/api/webhook/blooio'

  const payload = {
    id: `evt_test_${Date.now()}`,
    type: 'message.received',
    created_at: Date.now(),
    organization_id: 'org_test',
    data: {
      message_id: `msg_test_${Date.now()}`,
      chat_id: 'chat_test',
      channel_id: 'ch_test',
      channel_type: 'blooio',
      kind: 'received',
      direction: 'inbound',
      text,
      status: 'received',
      protocol: 'imessage',
      message_type: 'text',
      sender,
      recipient: env.BLOOIO_FROM_NUMBER || '+15555550101',
      contact: { identifier: sender },
      channel_address: env.BLOOIO_FROM_NUMBER || '+15555550101',
      attachments: [],
    },
  }

  const rawBody = JSON.stringify(payload)
  const headers = { 'Content-Type': 'application/json' }

  if (env.BLOOIO_WEBHOOK_SECRET) {
    const ts = Math.floor(Date.now() / 1000)
    const hmac = crypto
      .createHmac('sha256', env.BLOOIO_WEBHOOK_SECRET)
      .update(`${ts}.${rawBody}`)
      .digest('hex')
    headers['X-Blooio-Signature'] = `t=${ts},v1=${hmac}`
    console.log('🔐 Signing request with BLOOIO_WEBHOOK_SECRET from .env.local')
  } else {
    console.log('⚠️  No BLOOIO_WEBHOOK_SECRET in .env.local - sending unsigned')
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
    console.log('   for the AI response and the Blooio send result.')
  } else {
    console.log('❌ Webhook rejected the message')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('❌ Test failed:', err.message)
  process.exit(1)
})
