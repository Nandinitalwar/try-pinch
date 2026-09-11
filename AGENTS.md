# Pinch - SMS/iMessage AI Astrologer

## START HERE: read the wiki

`docs/` holds the working memory for this project. Before doing anything non-trivial:

- `docs/05-decisions.md` — settled calls and why. Don't reverse one without reading it.
- `docs/06-open-issues.md` — known bugs, including one awaiting a decision.
- `docs/04-voice.md` — the voice rules. Most likely thing to regress.

Full index in `docs/README.md`.

## Update the wiki without being asked

This is not optional and it is not a end-of-task chore. Nandini should never have to ask
for it. After anything that changes how the project behaves, write it down before moving
on to the next thing:

| What happened | Where it goes |
|---|---|
| A decision made, with why | `docs/05-decisions.md`, plus a revisit trigger |
| A bug found, fixed, or still open | `docs/06-open-issues.md` |
| Something learned the hard way | The relevant page, written as the lesson |
| A measurement that settled an argument | The page it settles, with the numbers |

The test: **if the next session would waste an hour rediscovering it, it belongs in the
wiki.** A decision recorded without its rationale gets reversed by the next person.

Note: this file's Architecture section below is partly stale. `docs/02-architecture.md`
is current.

## Project Overview
SMS and iMessage-based AI astrologer using:
- **Twilio** for SMS webhooks
- **Linq** as the sole iMessage provider
- **OpenAI GPT-5.6 Sol** for production replies and Luna for durable memory extraction; optional Groq GPT-OSS 120B handles free local reply testing; Gemini handles birth/media parsing
- **Braintrust** for AI observability
- Next.js 14 App Router deployed on Vercel

## Key Commands
- `npm run dev` - Start local dev server (port 3000)
- `npm run build` - Build for production
- `npm run test:quality:groq -- --dry-run` - Inspect the minimal raw-model quality harness without spending a call
- `npm run test:quality:groq` - Run seven isolated GPT-OSS 120B quality cases through Groq
- `vercel --prod` - Deploy to production

## Testing Workflow
Always test webhook changes locally before deploying:
```bash
curl -X POST "http://localhost:3000/api/webhook/twilio" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=+15551234567" \
  -d "To=+18889211387" \
  -d "Body=YOUR_TEST_MESSAGE"
```

## Architecture
- `/app/api/webhook/twilio/route.ts` - Twilio SMS webhook handler
- `/app/api/webhook/linq/route.ts` - Active Linq iMessage webhook handler
- `/lib/agents/agents/generalTaskAgent.ts` - Core AI agent with OpenAI Responses + tools
- `/lib/agents/taskDecomposer.ts` - Routes messages to appropriate agents
- `/lib/linq.ts` - Linq API client, webhook parser, and signature verifier
- `/lib/messagingService.ts` - Unified messaging service (SMS + iMessage)
- `/lib/braintrust.ts` - Braintrust observability integration

## Environment Variables
Required in `.env.local` and Vercel:

### AI & Search
- `OPENAI_API_KEY` - GPT-5.6 reply-model key
- `PINCH_REPLY_PROVIDER`, `PINCH_REPLY_MODEL`, `PINCH_REPLY_REASONING_EFFORT` - select OpenAI production replies or the Groq local-test lane
- `GROQ_API_KEY` - required only when `PINCH_REPLY_PROVIDER=groq`
- `PINCH_MEMORY_EXTRACTION_MODEL`, `PINCH_MEMORY_EMBEDDING_MODEL` - optional memory model overrides
- `GOOGLE_AI_API_KEY` - Gemini key for auxiliary extraction tasks
- `EXA_API_KEY` - Web search via Exa AI

### Messaging
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - Twilio SMS
- `LINQ_API_KEY`, `LINQ_WEBHOOK_SECRET` - Linq iMessage adapter

### Database
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL
- `CONVEX_DEPLOY_KEY` - Convex deployment key for schema/function pushes

### Observability
- `BRAINTRUST_API_KEY` - Braintrust AI observability (get from https://www.braintrust.dev)
- `BRAINTRUST_PARENT` - Braintrust project name (e.g., `project_name:pinch-sms-astrologer`)

## Conventions
- System prompts live in `generalTaskAgent.ts`
- Reply-agent tools use the OpenAI Responses function-calling format
- Always add new env vars to both `.env.local` AND Vercel (`vercel env add`)
