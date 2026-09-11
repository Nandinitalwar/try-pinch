# Architecture

Next.js 14 App Router on Vercel. GPT-5.6 Sol through the OpenAI Responses API remains the
production user-facing reply agent. A provider-selectable Groq Responses path uses
GPT-OSS 120B for free local testing without duplicating the agent loop. GPT-5.6 Luna handles durable-memory extraction,
`text-embedding-3-small` handles memory vectors, and Gemini remains on narrow birth-data
and media workloads. Convex for storage. Braintrust for observability.

Monorepo: `packages/api` is the whole backend and the test console. `packages/website` is
marketing. `packages/evals` is behavioural evals. `packages/prototype` is the local-only
ChatGPT growth interview demo. `packages/sandbox` is unrelated.

## Message flow

A message arrives at a webhook, gets logged raw, gets buffered for 1.5s in case more
messages follow, then runs through the agent, then the reply goes back out. Messaging-route
memory extraction runs after the reply inside the background webhook task; the web test
route awaits it before returning. Media understanding happens *before* history is saved:
photos/videos become private visual context, while exact voice-note transcripts become
user-authored text for the reply, retrieval, reminders, and durable-memory extraction.

## Where things live

| Concern | File |
|---|---|
| iMessage in/out | `packages/api/app/api/webhook/linq/route.ts` (sole provider) |
| WhatsApp in/out | `packages/api/app/api/webhook/twilio/route.ts` |
| Web test console API | `packages/api/app/api/chat/route.ts` |
| Test console UI | `packages/api/app/test/page.tsx` |
| ChatGPT onboarding growth prototype | `packages/prototype` (localhost port 3006; optional coarse edge context at `/api/context`) |
| Birth chart image API | `packages/api/app/api/chart/route.ts` |
| Birth chart SVG renderer | `packages/api/lib/chartImage.ts` |
| Vault read API | `packages/api/app/api/vault/route.ts` |
| The agent and its prompt | `packages/api/lib/agents/agents/generalTaskAgent.ts` |
| Voice enforcement | `packages/api/lib/voiceCheck.ts` |
| Owned memory extraction/retrieval | `packages/api/lib/simpleMemory.ts`; `packages/api/convex/memories.ts` |
| Vault service | `packages/api/lib/vault.ts` |
| Link detection | `packages/api/lib/linkExtractor.ts` |
| Video/link understanding | `packages/api/lib/contentIngest.ts` |
| Photo/video/voice-note understanding | `packages/api/lib/mediaIngest.ts` |
| Natal chart + transit maths | `packages/api/lib/astrology.ts` |
| Convex schema | `packages/api/convex/schema.ts` |

## The agent layer

`InteractionAgent` now hands the user's message straight to `GeneralTaskAgent`, which is
where all the real work happens: the system prompt, the tools, the tool-calling loop, and
the voice check.

The tool loop is capped at four rounds, runs independent calls in a round concurrently,
and returns a final limit result to the model instead of letting a webhook hang. Every LLM
turn logs latency, token counts, tool rounds, rewrite counts, and initial voice violations
to Braintrust when configured. Voice enforcement includes repeated proper nouns and
near-duplicate wording across recent turns, with a carve-out for a proper noun the user
explicitly raised again.

The reply loop uses the OpenAI SDK against either OpenAI or Groq's OpenAI-compatible beta
Responses endpoint. It replays returned response items plus tool outputs so tool use keeps
its reasoning context without making either provider the conversation database. OpenAI
calls explicitly disable storage and can replay encrypted reasoning; Groq calls omit the
OpenAI-only `store`, `include`, `safety_identifier`, and `prompt_cache_key` fields it
rejects. Reasoning defaults to `medium` for OpenAI, `low` for Groq, and `low` for
mechanical rewrites. `PINCH_REPLY_PROVIDER`, `PINCH_REPLY_MODEL`, and
`PINCH_REPLY_REASONING_EFFORT` can change those defaults without a code edit.

`TaskDecomposer` and the multi-agent synthesis path still exist in the repo but are **not
on the reply path** and should not be reinstated without reading
[04-voice.md](04-voice.md). The decomposer replaced the user's actual words with an LLM
summary, which silently broke the voice for a long time.

The `ExecutionAgent` base class is still the right shape for future persistent agents
(reminders, background tasks). It just isn't a routing layer any more.

## Tools available to the agent

| Tool | Does |
|---|---|
| `search_vault` | Looks up places the user saved. Called before any recommendation. |
| `search_web` | Exa search for real-world facts, events, restaurants, hours. **Forbidden for anything astrological.** |
| `save_birth_data` | Computes and permanently stores the natal chart. |

Today's transits are not a tool. They're computed on every message and injected into the
prompt as a private briefing, because the agent should never have the option of getting
them wrong.

## Memory

The raw event log is the source of truth. GPT-5.6 Luna extracts only explicit durable
facts from the newest user message into stable-keyed Convex records. Same-key corrections
supersede old rows; forgetting soft-deletes them. Every current record points back to its
source event, except the legacy Mem0 migration, which preserves the provider record ID.

Recall embeds the newest user message at 512 dimensions, runs Convex vector and full-text
search, and joins ranks. The newest eight records are additionally scored in process so a
message immediately following a write cannot lose the new fact to search-index lag.

## Birth chart images

`computeNatalChart()` uses Western tropical, geocentric ecliptic longitudes and records a
calculation version plus accuracy metadata. With an exact time and coordinates it also
computes the Ascendant. Without a time, the Moon is checked at both ends of the local birth
date; if it can cross a sign, both possible signs are recorded and the Ascendant is omitted.

`renderNatalChartSvg()` turns those stored values into a deterministic SVG wheel. It is a
diagram of verified ephemeris data, not a generative-image prompt. `/api/chart` returns the
session's SVG via POST with `private, no-store`; `/api/chat` tells the test client when a new
chart exists or the user asks to see the one on file. New test sessions use random UUIDs,
and production chart reads reject identifiers outside the web-test namespace.

The first personal horoscope request is also a chart-reveal trigger. If no birth data is
stored, the agent asks once for date, time, and city; the reply after those details are
saved includes the new wheel, a short natal personality read, and the requested forecast.
If a chart already exists but has never been shown, that first horoscope attaches it.
`profiles.chartIntroducedAt` makes this a lifetime onboarding event rather than something
that repeats whenever the ten-message history window rolls over.

For Linq, the wheel is converted to PNG and included as a media part in the same reply.
Linq downloads it from `/api/chart/imessage` using a 15-minute HMAC-signed URL; no phone
number or chart can be selected by an unsigned request. The introduction flag is written
only after Linq accepts the media message, so a failed attachment can retry later.

## Gotchas

- **Convex functions use the `*Generic` variants** (`queryGeneric`, `mutationGeneric`) so
  they compile before codegen has run. The API package deploys via Vercel, not Convex CI.
- **Server code references Convex functions through `anyApi`**, so a typo in a function
  name fails at runtime, not compile time.
- **Twilio media URLs need HTTP Basic auth** on the account credentials. Fetching them
  anonymously returns 401, this is the classic "WhatsApp images arrive empty" bug.
- **Media analysis and link ingestion run before the web-console reply.** The messaging
  adapters still do slow link ingestion afterward; this ordering drift remains worth
  consolidating when the channel pipelines are unified.
- **Attachment context has two different trust levels.** A voice transcript is the user's
  own speech and is persisted; a Gemini visual description is model-derived context and
  is not silently stored as if the user said it.
- **Linq voice memos are not one format.** OpenAI-supported MP3/M4A/WAV/WebM recordings go
  directly to `gpt-transcribe`; CAF/AAC/AIFF/AMR/OGG-style inputs are normalized with the
  bundled ffmpeg binary. Keep the 25 MB transcription ceiling and Vercel trace include.
- **Proactive follow-up rows are not sending permission.** Do not add a cron sender until
  consent, STOP handling, timezone and Linq chat-health checks exist.
