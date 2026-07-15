# 🔮 Pinch

> **Your AI astrologer, right in your texts.**
> No apps. No accounts. Just SMS/iMessage and real talk about your chart.

<div align="center">

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/pinch)
[![Powered by Gemini](https://img.shields.io/badge/Powered%20by-Gemini%202.5-blue.svg)](https://ai.google.dev/)
[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js%2014-black)](https://nextjs.org/)

</div>

---

## What is Pinch?

Pinch is an AI astrologer that lives in your text messages (SMS or iMessage). Text it anything — *"should I take this job?"*, *"what should I eat for dinner?"*, *"how do I deal with my boss?"* — and get advice rooted in your birth chart and personality.

**No mystical jargon. No vague horoscopes. Just direct, personality-driven guidance from someone who actually knows you.**

### ✨ What makes it different

- **Personality-first astrology** — Advice based on who you are, not just planet positions
- **Conversational memory** — Remembers your previous chats, your preferences, your life
- **Real-time insights** — Searches today's astrology forecasts to inform recommendations
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
│   iMessage   │────────▶│   SendBlue   │────────▶│   Next.js    │
│   or SMS     │         │   or Twilio  │         │   Webhooks   │
└──────────────┘         └──────────────┘         └──────┬───────┘
                                                          │
                         ┌────────────────────────────────▼────────┐
                         │         Agent System                    │
                         │  ┌──────────────────────────────────┐  │
                         │  │  Task Decomposer                 │  │
                         │  │  (routes to appropriate agent)   │  │
                         │  └──────────────┬───────────────────┘  │
                         │                 │                       │
                         │  ┌──────────────▼───────────────────┐  │
                         │  │  General Task Agent              │  │
                         │  │  • Loads user profile + chart    │  │
                         │  │  • Loads conversation history    │  │
                         │  │  • Loads user memories           │  │
                         │  │  • Searches web for today's      │  │
                         │  │    astrology (via Exa AI)        │  │
                         │  │  • Calls Gemini 2.5 Flash        │  │
                         │  │  • Logs to Braintrust            │  │
                         │  └──────────────┬───────────────────┘  │
                         └─────────────────┼──────────────────────┘
                                           │
                         ┌─────────────────▼──────────────────┐
                         │  Gemini 2.5 Flash                  │
                         │  • System prompt with personality  │
                         │  • Full conversation history       │
                         │  • Function calling (web search)   │
                         └─────────────────┬──────────────────┘
                                           │
                         ┌─────────────────▼──────────────────┐
                         │  Response via SendBlue/Twilio      │
                         │  ──────────────────────▶ WhatsApp  │
                         └────────────────────────────────────┘
```

**Tech Stack:**
- **Framework:** Next.js 14 (App Router) on Vercel
- **AI:** Google Gemini 2.5 Flash with function calling
- **Messaging:** Twilio WhatsApp Business API
- **Web Search:** Exa AI (for real-time astrology forecasts)
- **Database:** Supabase (user profiles, birth data, conversation memory)
- **Sandbox:** bubblewrap-based Linux jail for LLM-authored code execution (see [`packages/sandbox/`](packages/sandbox/))

---

## 🛡️ Sandboxed Code Execution

Pinch's agent grounds forecasts in web search (Exa) and does real ephemeris math via LLM-authored Python — both of which expand the trust boundary: search results are attacker-controllable, and LLM-written code is untrusted. A prompt-injection payload in a crawled blog post could otherwise cause the agent to emit Python that reads `SUPABASE_SERVICE_KEY` and exfiltrates it.

The [`packages/sandbox/`](packages/sandbox/) package is a two-runner code-execution service — `naked_run` (unsafe baseline) and `jail_run` (bubblewrap + user / mount / net / pid namespaces, tmpfs rootfs, scrubbed env, rlimits, wall-clock cap) — tested against an escape-attempt suite.

| Attack | naked | jail | Defense |
|---|---|---|---|
| Read env secret | lands | **blocked** | env scrubbed before exec |
| Write outside scratch | lands | **blocked** | tmpfs rootfs; host `/tmp` invisible |
| Read host file | lands | **blocked** | read-only binds hide host paths |
| Network egress | lands | **blocked** | empty net namespace |
| Fork bomb | lands | *xfail* | deferred to Stage 1b (cgroup `pids.max`) |
| Hang | lands | **blocked** | parent enforces default 1 s wall cap |

Two narrow tools are planned for the Gemini agent — `compute_ephemeris(code)` for chart math and `analyze_user_history(code)` for per-user data analysis — neither of which holds Supabase, Twilio, or Gemini credentials. Full threat model and defense-in-depth layering in [`packages/sandbox/docs/design.md`](packages/sandbox/docs/design.md); roadmap in [`packages/sandbox/ROADMAP.md`](packages/sandbox/ROADMAP.md).

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Twilio account ([sign up](https://www.twilio.com/try-twilio))
- Google AI API key ([get one](https://ai.google.dev/))
- Supabase project ([create one](https://supabase.com/))
- (Optional) Exa AI key for web search ([get one](https://exa.ai/))

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/pinch.git
cd pinch
npm install
```

### 2. Set up Database

Run `database/unified_schema.sql` in your Supabase SQL editor to create the required tables.

### 3. Configure Environment Variables

Create `.env.local`:

```env
# Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# Google AI
GOOGLE_AI_API_KEY=your_gemini_api_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

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
│   │       └── generalTaskAgent.ts    # Core AI agent (Gemini + tools)
│   ├── birthDataParser.ts             # Parse birth info from messages
│   ├── userProfile.ts                 # User profile + chart storage
│   ├── simpleMemory.ts                # Conversation memory
│   ├── messageBuffer.ts               # Message buffering/deduplication
│   └── supabase.ts                    # Supabase client
├── database/
│   └── unified_schema.sql             # Database schema
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

### 3. **Pinch searches today's astrology**
Queries Exa AI for today's forecasts for your sign + current transits

### 4. **Gemini generates response**
System prompt guides Gemini to:
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

Gemini can call:
1. **`search_web`** — Searches Exa AI for real-time astrology forecasts
2. **`save_birth_data`** — Stores user's birth date/time/location when shared

**Planned (sandboxed, see [`packages/sandbox/`](packages/sandbox/)):**
3. **`compute_ephemeris(code)`** — LLM-authored Python using `pyswisseph` / `skyfield` for real chart / transit / aspect math. No credentials, no network, no filesystem, 128 MB / 0.5 CPU / 2 s cap.
4. **`analyze_user_history(code)`** — LLM-authored pandas over *the requesting user's own* rows, piped in via stdin. Multi-tenant isolation enforced in the API layer (row-scoped query) before the sandbox ever runs.

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

### User Profile Storage (Supabase)

```sql
users (
  id, phone_number, name,
  birth_date, birth_time, birth_city, birth_country,
  sun_sign, moon_sign, rising_sign,
  created_at, updated_at
)
```

### Conversation Memory (Supabase)

```sql
chats (
  id, user_id, role, content,
  created_at
)
```

Last 10 messages loaded per conversation for context.

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
- [Gemini 2.5 Flash](https://ai.google.dev/) by Google
- [Twilio WhatsApp API](https://www.twilio.com/whatsapp)
- [Exa AI](https://exa.ai/) for semantic web search
- [Next.js](https://nextjs.org/) by Vercel
- [Supabase](https://supabase.com/) for backend

---

<div align="center">

**[Try Pinch](#) • [Report Bug](#) • [Request Feature](#)**

Made with 🔮 by people who believe astrology should actually be useful

</div>