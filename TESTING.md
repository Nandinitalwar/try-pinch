# Testing iMessage Integration

For the production agent, birth-chart, and voice harness (independent of the messaging
provider), see [`docs/08-testing.md`](docs/08-testing.md). The short commands are:

```bash
cd packages/api
npm run test:quality:groq -- --dry-run
npm run test:harness
PINCH_BASE_URL=http://localhost:3000 npm run test:harness:live
```

The Groq command is the minimal raw-model diagnostic: no server, database, memory, tools,
onboarding, or voice rewrites. Remove `--dry-run` after adding `GROQ_API_KEY` to run the
seven fixed quality cases on the free plan.

## 1. Start the API

```bash
cd packages/api
npm run dev
```

The server runs at `http://localhost:3000`.

## 2. Test Linq (sole iMessage provider)

First run the request-shape unit tests (no credentials or server required):

```bash
cd packages/api
npm run test:linq:unit
```

These assert that conversational replies use the inbound chat ID and proactive sends use
Linq's managed line-selection endpoint.

Then, in a second terminal, simulate the inbound webhook:

```bash
cd packages/api
npm run test:linq
```

This sends a current `2026-02-03` `message.received` payload to
`/api/webhook/linq`. If `LINQ_WEBHOOK_SECRET` is present in `.env.local`, the
script also signs the request using Linq's Standard Webhooks scheme.

To choose the simulated sender, message, or endpoint:

```bash
node tests/test-linq-webhook.js \
  +15551234567 \
  "hey pinch, should i take a sick day tomorrow?" \
  "http://localhost:3000/api/webhook/linq?version=2026-02-03"
```

The default fake number exercises the inbound pipeline but cannot receive the final
reply. It will still make the live send attempt when credentials are present, so prefer
the unit test unless you are intentionally exercising the full local pipeline.

## 3. Configure real Linq credentials

Add these to `packages/api/.env.local` and to the Vercel project:

```env
LINQ_API_KEY=your_linq_api_key
LINQ_WEBHOOK_SECRET=whsec_your_linq_webhook_signing_secret
```

Create a Linq subscription for `message.received` at this exact URL:

```text
https://your-app.vercel.app/api/webhook/linq?version=2026-02-03
```

The version query is deliberate. It pins the webhook to the payload shape the route
parses, while the parser also accepts Linq's older `2025-01-01` shape during migration.

For this project the active production target is:

```text
https://aiastrologer.vercel.app/api/webhook/linq?version=2026-02-03
```

## 4. Expected behavior

- The webhook verifies the signature when a secret is configured.
- Delivery/status events, outbound echoes, and reconciled historical messages are ignored.
- A text or attachment-only message is accepted and acknowledged immediately.
- Photos/videos are analyzed and voice notes are transcribed before the agent replies.
- Voice transcripts participate in chat history, memory recall/extraction, links, and reminders.
- The reply is sent to the incoming Linq `chat_id`, preserving the thread.
- Link ingestion, follow-up scheduling, memory extraction, and Braintrust flushing continue
  after the reply.

Useful logs include:

```text
[Linq] ✅ Payload parsed successfully
[Linq] ✅ Webhook acknowledged, processing in background
[Linq] ✅ Message sent: <message-id>
```

If `LINQ_API_KEY` is absent, the inbound pipeline still runs but sending logs:

```text
[Linq] Not configured - skipping iMessage support
```

## 5. Twilio SMS/WhatsApp smoke test

```bash
curl -X POST "http://localhost:3000/api/webhook/twilio" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=+15551234567" \
  -d "To=+18889211387" \
  -d "Body=Hey Pinch"
```
