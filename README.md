# 🔮 Pinch

> **Your AI astrologer, right in your texts.**
> No apps. No accounts. Just SMS/iMessage and real talk about your chart.

<div align="center">

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/pinch)
[![Powered by GPT-5.6](https://img.shields.io/badge/Powered%20by-GPT--5.6-black.svg)](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js%2014-black)](https://nextjs.org/)

</div>

---

## What is Pinch?

Pinch is an AI astrologer that lives in your text messages (SMS or iMessage). Text it anything — *"should I take this job?"*, *"what should I eat for dinner?"*, *"how do I deal with my boss?"* — and get advice rooted in your birth chart and personality.

**No mystical jargon. No vague horoscopes. Just direct, personality-driven guidance from someone who actually knows you.**

### ✨ What makes it different

- **Personality-first astrology** — Advice based on who you are, not just planet positions
- **Conversational memory** — Remembers your previous chats, your preferences, your life
- **Real-time insights** — Computes current transits against the user's saved chart
- **Zero friction** — No app downloads, no logins. Just text a number.
- **iMessage + SMS support** — Works on both iPhone (iMessage) and any phone (SMS via Twilio)
- **AI observability** — Full Braintrust integration for monitoring AI performance
- **Blunt and direct** — Talks like a friend, not a corporate wellness bot

---

## 🎯 Examples

**You:** "should i take a sick day at work tmr?"  
**Pinch:** "Take the sick day. You're gonna feel scattered tomorrow anyway, and you need to be sharp for your date. Just rest."

**You:** "what should i eat for dinner?"  
**Pinch:** "Dal makhani and garlic naan. You need something rich and grounding tonight — your energy's all over the place."

**You:** "should i go to this party or stay home?"  
**Pinch:** "Stay home. You're drained and forcing yourself out will just make it worse. Recharge tonight, go out when you actually want to."

---

## 🏗️ Architecture

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   iMessage   │────────▶│     Linq     │────────▶│   Next.js    │
│   or SMS     │         │   or Twilio  │         │   Webhooks   │
└──────────────┘         └──────────────┘         └──────┬───────┘
                                                          │
                         ┌────────────────────────────────▼────────┐
                         │         Agent System                    │
                         │  ┌──────────────────────────────────┐  │
                         │  │  Deterministic context loader    │  │
                         │  │  (profile, chart, memory, vault) │  │
                         │  └──────────────┬───────────────────┘  │
                         │                 │                       │
                         │  ┌──────────────▼───────────────────┐  │
                         │  │  General Task Agent              │  │
                         │  │  • Loads user profile + chart    │  │
                         │  │  • Loads conversation history    │  │
                         │  │  • Loads user memories           │  │
                         │  │  • Computes today's transits     │  │
                         │  │  • Calls configured reply model  │  │
                         │  │  • Logs to Braintrust            │  │
                         │  └──────────────┬───────────────────┘  │
                         └─────────────────┼──────────────────────┘
                                           │
                         ┌─────────────────▼──────────────────┐
                         │  OpenAI or Groq / Responses API    │
                         │  • System prompt with personality  │
                         │  • Full conversation history       │
                         │  • Function calling (web search)   │
                         └─────────────────┬──────────────────┘
                                           │
                         ┌─────────────────▼──────────────────┐
                         │  Response via Linq/Twilio          │
                         │  ──────────────────────▶ WhatsApp  │
                         └────────────────────────────────────┘
```

**Tech Stack:**
- **Framework:** Next.js 14 (App Router) on Vercel
- **AI:** GPT-5.6 Sol for production replies, optional Groq GPT-OSS 120B for free local reply testing, GPT-5.6 Luna for durable-memory extraction, OpenAI embeddings and voice transcription, and Gemini for birth/image/video parsing
- **Messaging:** Linq for iMessage; Twilio for WhatsApp and SMS
- **Web Search:** Exa AI for current non-astrology facts and recommendations
- **Database:** Convex (profiles, charts, history, memory, and vault)
- **Sandbox:** bubblewrap-based Linux jail for LLM-authored code execution (see [`packages/sandbox/`](packages/sandbox/))

---

## 🛡️ Sandboxed Code Execution

The live Pinch reply path does not execute model-authored code: chart and transit math are
deterministic TypeScript, and web search is forbidden for astrology. The separate sandbox
package is an experiment for any future feature that deliberately executes generated code.

The [`packages/sandbox/`](packages/sandbox/) package is a two-runner code-execution service — `naked_run` (unsafe baseline) and `jail_run` (bubblewrap + user / mount / net / pid namespaces, tmpfs rootfs, scrubbed env, rlimits, wall-clock cap) — tested against an escape-attempt suite.

| Attack | naked | jail | Defense |
|---|---|---|---|
| Read env secret | lands | **blocked** | env scrubbed before exec |
| Write outside scratch | lands | **blocked** | tmpfs rootfs; host `/tmp` invisible |
| Read host file | lands | **blocked** | read-only binds hide host paths |
| Network egress | lands | **blocked** | empty net namespace |
| Fork bomb | lands | *xfail* | deferred to Stage 1b (cgroup `pids.max`) |
| Hang | lands | **blocked** | parent enforces default 1 s wall cap |

Any future sandbox tool must receive only row-scoped input and no Convex, messaging, or AI
credentials. Full threat model and defense-in-depth layering are in
[`packages/sandbox/docs/design.md`](packages/sandbox/docs/design.md); roadmap in
[`packages/sandbox/ROADMAP.md`](packages/sandbox/ROADMAP.md).

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Linq account and API key ([dashboard](https://dashboard.linqapp.com/))
- Twilio account ([sign up](https://www.twilio.com/try-twilio))
- OpenAI API key with GPT-5.6 access ([platform](https://platform.openai.com/))
- Google AI API key for auxiliary extraction ([get one](https://ai.google.dev/))
- Convex project ([create one](https://convex.dev/))
- (Optional) Exa AI key for web search ([get one](https://exa.ai/))

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/pinch.git
cd pinch
npm install
```

### 2. Set up Database

From the API package, connect and push the Convex schema/functions:

```bash
cd packages/api
npx convex dev --once
```

### 3. Configure Environment Variables

Create `.env.local`:

```env
# Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# iMessage
LINQ_API_KEY=your_linq_api_key
LINQ_WEBHOOK_SECRET=whsec_your_linq_webhook_signing_secret

# Reply provider: use openai for production or groq for free local testing
PINCH_REPLY_PROVIDER=openai
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=your_openai_api_key
PINCH_REPLY_MODEL=gpt-5.6-sol
PINCH_REPLY_REASONING_EFFORT=medium
PINCH_MEMORY_EXTRACTION_MODEL=gpt-5.6-luna
PINCH_MEMORY_EMBEDDING_MODEL=text-embedding-3-small

# Google AI auxiliary extraction
GOOGLE_AI_API_KEY=your_gemini_api_key

# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOY_KEY=your_convex_deploy_key

# Exa AI (optional - for web search)
EXA_API_KEY=your_exa_api_key
```

### 4. Run Locally

```bash
npm run dev
```

Server runs on `http://localhost:3000`

### 5. Deploy to Vercel

```bash
vercel --prod
```

Add all environment variables in Vercel dashboard.

### 6. Configure Twilio Webhook

In Twilio Console:
1. Go to **Messaging > Settings > WhatsApp Sandbox** (for testing)
2. Set **WHEN A MESSAGE COMES IN** to: `https://your-app.vercel.app/api/webhook/twilio` (HTTP POST)

For production:
1. Get WhatsApp Business approval (1-3 weeks)
2. Configure webhook on your production WhatsApp number

### 7. Configure Linq iMessage Webhook

Create a Linq message webhook using this URL:

```text
https://your-app.vercel.app/api/webhook/linq?version=2026-02-03
```

Save the webhook signing secret as `LINQ_WEBHOOK_SECRET`. Linq is the only iMessage
provider in the codebase.

---

## 📂 Project Structure

```
pinch/
├── app/
│   ├── api/
│   │   └── webhook/twilio/route.ts    # Main webhook handler
│   └── page.tsx                        # Landing page
├── lib/
│   ├── agents/
│   │   ├── interactionAgent.ts        # Main orchestrator
│   │   ├── taskDecomposer.ts          # Routes tasks to agents
│   │   ├── executionAgent.ts          # Base agent class
│   │   └── agents/
│   │       └── generalTaskAgent.ts    # Core reply agent (GPT-5.6 + tools)
│   ├── birthDataParser.ts             # Parse birth info from messages
│   ├── userProfile.ts                 # User profile + chart storage
│   ├── simpleMemory.ts                # Conversation memory
│   ├── messageBuffer.ts               # Message buffering/deduplication
│   └── convexClient.ts                # Convex client
├── convex/
│   ├── schema.ts                      # Database schema and indexes
│   └── memories.ts                    # Memory mutations and search
└── vercel.json                         # Vercel config
```

---

## 🎨 How It Works

### 1. **You text Pinch**
"should i quit my job?"

### 2. **Pinch loads your context**
- Your birth chart (sun, moon, rising, full chart if you shared birth time)
- Previous conversations
- What it remembers about you

### 3. **Pinch computes today's sky**
Calculates current transits against the verified saved chart

### 4. **GPT-5.6 generates the response**
The production prompt guides GPT-5.6 to:
- Translate astrology into personality-based advice
- Be direct and conversational (no corporate therapy speak)
- Give ONE recommendation, not a menu of options
- Reference what it knows about you naturally

### 5. **You get a text back**
"Not yet. You're feeling restless, but this energy passes by next week. If you still want out then, we'll talk. For now, just ride it out."

---

## 🛠️ Configuration

### System Prompt

The agent's personality is defined in `lib/agents/agents/generalTaskAgent.ts`. Key principles:

- **Personality-first, never planet-first** — No mentions of "Venus in Pisces" or "Mercury retrograde"
- **Ruthlessly short** — 2-3 sentences for simple questions
- **No name spam** — Uses your name maybe 1 in 20 messages
- **Banned corporate therapy language** — No "show up as your best self", "lean into it", "tune into your heart"
- **Authoritative** — Doesn't flip-flop when you're indecisive

### Tools (Function Calling)

GPT-5.6 can call:
1. **`search_web`** — Searches Exa AI for current non-astrology facts
2. **`save_birth_data`** — Stores user's birth date/time/location when shared
3. **`search_vault`** — Retrieves places the user previously saved

**Planned (sandboxed, see [`packages/sandbox/`](packages/sandbox/)):**
4. **`compute_ephemeris(code)`** — LLM-authored Python using `pyswisseph` / `skyfield` for real chart / transit / aspect math. No credentials, no network, no filesystem, 128 MB / 0.5 CPU / 2 s cap.
5. **`analyze_user_history(code)`** — LLM-authored pandas over *the requesting user's own* rows, piped in via stdin. Multi-tenant isolation enforced in the API layer (row-scoped query) before the sandbox ever runs.

---

## 🌍 Going Live

### WhatsApp Business Setup

1. **Apply for WhatsApp Business** via Twilio (requires Facebook Business Manager)
2. **Wait 1-3 weeks** for approval
3. **Configure production webhook** on approved number
4. **Users text your number** — no sandbox join code needed

### SMS-Only (Instant Launch)

Skip WhatsApp approval and launch with SMS:
1. Buy a Twilio phone number (~$1/month)
2. Configure SMS webhook immediately
3. Users text your number via regular SMS

**Pricing:**
- SMS: ~$0.0079/message (US)
- WhatsApp: ~$0.005/message (business-initiated) or free (user replies within 24h)

---

## 📊 Memory & Data

### Profiles and memory (Convex)

Convex stores the raw event log, profiles and computed charts, the last-ten-message chat
window, vault entities, follow-up candidates, and durable memories. Durable facts use
stable keys, source provenance, soft correction/deletion, 512-dimensional embeddings,
and hybrid vector/full-text retrieval. Pinch never learns from its own assistant reply.

---

## 🤝 Contributing

Pinch is open source and we welcome contributions! Ideas:

- [ ] Vedic astrology support
- [ ] Voice note responses
- [ ] Multi-language support (Hinglish, Spanish, etc.)
- [ ] Chart image generation
- [ ] Compatibility readings (when two users share their charts)

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

Built with:
- [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol) by OpenAI
- [Groq Responses API](https://console.groq.com/docs/responses-api) for the free local reply-provider lane
- [Gemini](https://ai.google.dev/) by Google for auxiliary extraction
- [Twilio WhatsApp API](https://www.twilio.com/whatsapp)
- [Exa AI](https://exa.ai/) for semantic web search
- [Next.js](https://nextjs.org/) by Vercel
- [Convex](https://www.convex.dev/) for backend storage

---

<div align="center">

**[Try Pinch](#) • [Report Bug](#) • [Request Feature](#)**

Made with 🔮 by people who believe astrology should actually be useful

</div>
