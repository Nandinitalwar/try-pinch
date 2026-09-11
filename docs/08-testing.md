# Testing

## Minimal raw-quality harness

Use this first when the question is whether the model or the full Pinch pipeline is making
the reply bad. It calls Groq directly with a compact fixed prompt and seven representative
texts. There is no server, database, memory, tool call, onboarding state, or rewrite pass.

```bash
cd packages/api
npm run test:quality:groq -- --dry-run
npm run test:quality:groq
```

`--dry-run` needs no key and prints the cases plus approximate input budget. The live run
loads `GROQ_API_KEY` from `packages/api/.env.local`, uses `openai/gpt-oss-120b` with low
reasoning, and prints raw replies with actual token usage, latency, and deterministic voice
flags. Save a report only when wanted:

```bash
npm run test:quality:groq -- --out quality-results/groq.md
npm run test:quality:groq -- --case historical_photo
```

The free Groq plan's 8K-token-per-minute limit is tighter than its request limit. The
compact prompt and seven cases are designed for that lane; if a 429 occurs, rerun the named
case after the token window resets. Human review is authoritative for specificity and
astrologer credibility. A clean mechanical linter result alone is not a pass.

This harness is diagnostic, not a release gate. Any production prompt, provider, tool, or
activation change still requires the integrated live harness below.

The 2026-08-17 Groq baseline is saved at
`packages/api/quality-results/groq.md`: 3,839 total tokens, 503 ms mean latency, and six of
seven replies with voice violations. Keep it as the raw comparison; do not run its replies
through the production rewrite and call the result a model improvement.

## The test console

```
cd packages/api && npm run dev
```

Then open **http://localhost:3000/test**.

A text thread on the left, the vault filling up live on the right. Same agent, same vault,
same memory as a real text, so anything that works here works over iMessage.

The right column also shows every active durable memory and its stable key after each
reply. Use this to catch over-memory immediately: a transient mood or sensitive fact
should never appear there.

| Control | Does |
|---|---|
| `+` | Upload a photo or video |
| "new user" | Fresh session with an empty vault |
| (session) | Persists across reloads, so the vault accumulates |

### Things worth trying

| Input | Expected |
|---|---|
| `what's my horoscope today?` as a new user | Asks for birth date, exact time, and city; does not invent a forecast |
| Birth details immediately after that request | Attaches the new chart, explains personality/tension, then answers the horoscope |
| `born march 3 1996, 4:15am, new delhi` | Computes the real natal chart |
| `show me my chart` | Attaches the stored deterministic chart wheel |
| A birth date and city with no time | Omits rising; labels Moon ambiguity when it can change signs that day |
| A TikTok or Reel link | Places appear in the right panel within seconds |
| An outfit photo | Garments appear under Wardrobe |
| A photo of a restaurant | Reads the signage, saves the venue |
| "where should i eat in mystic" | Recommends from the vault, not a web search |
| "what should i wear tonight" | Pulls from clothes it has actually seen |

## Scripted checks

The production TypeScript harness imports the real voice and astronomy modules:

```bash
cd packages/api
npm run test:harness
```

It checks banned voice patterns, cross-turn repetition, casing, input validation,
unknown-time Moon uncertainty, XML escaping, and an independent Swiss Ephemeris reference
chart. It also covers DST spring-forward gaps, fall-back times that map to two possible
Ascendants, memory privacy filtering, extraction provenance, hybrid rank fusion and the
fresh-write cosine fallback. This is the fast release gate.

Memory has two separate live checks:

```bash
cd packages/api
npm run test:memory:live
npm run test:memory:roundtrip
```

The first spends extraction calls and verifies that a durable plan is saved while a
question, transient mood and credential are rejected. The second writes a unique Convex
user and proves semantic recall, same-key correction with a superseded audit row, source
provenance and conversational forgetting. It intentionally leaves only inactive test
audit rows.

Production verification on 2026-08-13 passed against the stable Vercel alias and the
production Convex deployment: a durable oat-milk preference produced one memory, a stated
medical diagnosis produced zero, a full semantic recall/correction/forget round trip
passed, and a dashboard request using a phone-form identifier returned 401. Synthetic
active memories were cleared after the check.

For the real GPT-5.6 + Convex + Next route path, start the app in one terminal and run:

```bash
cd packages/api
PINCH_BASE_URL=http://localhost:3000 npm run test:harness:live
```

The live suite creates a fresh session, asks for a horoscope with no profile, verifies that
Pinch requests birth details, saves the reply through the model's tool call, verifies that
the generated chart is attached and explained before the forecast, fetches and checks the
SVG, asks a follow-up advice question, then asks to display the saved chart again. It
spends model calls and writes test data, so keep it separate from unit tests.

For visual chart work, open `http://localhost:3000/chart-lab`. It renders the Midnight,
Prism and Velvet phone cards from the exact same deterministic sample chart, followed by
the full-detail square fallback. Compare them at a narrow browser width as well as desktop
size; the default attachment is designed for an iMessage bubble, not a design canvas.
`tests/astrology-chart.test.ts` separately enforces the 1080×1350 portrait size, omission
of private birth metadata on the shareable card, full-detail preservation, portable-font
PNG output and uncertainty language.

`packages/api/scripts/test-vault.ts` exercises link detection and name normalization with
no network, and takes an optional URL argument to run live extraction end to end.

`cd packages/api && npm run test:linq:unit` covers the sole adapter's same-chat reply,
incoming attachment parsing, managed proactive sends, and PNG media-part request without
making a real send.

`cd packages/api && npm run test:linq` sends a signed payload to the local iMessage
webhook. The simulator uses a fake sender by default, so no real phone receives the reply.

`tests/media-ingest.test.ts` covers supported attachment classification, direct M4A
transcription, Linq CAF normalization, transcript propagation, and failure recovery. It is
part of `npm run test:harness`. The remaining media gate is a real-device Linq pass.

For a Vercel release, deploy from `packages/api`, not the monorepo root:

```bash
cd packages/api
npx vercel --prod --yes
```

The linked Vercel project has root directory `.` and `buildCommand: npm run build`. Running
the command from the repository root therefore reads the root package, which intentionally
has only workspace-specific `build:api` and `build:website` scripts, and fails with
`Missing script: build`.

## Simulating a real webhook

The messaging routes can be driven directly with a form POST, useful for testing the
WhatsApp path, which the console doesn't cover. Twilio sends `From`, `Body`, `NumMedia`
and `MediaUrl0..N` as form fields; a WhatsApp number arrives prefixed with `whatsapp:`.

Note the vault is keyed by the *normalized* number, which differs between channels, see
the identity issue in [06-open-issues.md](06-open-issues.md).

## Schema changes

New Convex tables don't exist until the schema is pushed:

```
cd packages/api && npx convex dev --once
```

Nothing writes to the vault until that has run. The current deployment is a **dev**
deployment.

## What to watch in the logs

| Line | Meaning |
|---|---|
| `Voice violations:` | The checker caught something |
| `Rewrite accepted (N -> M)` | Rewrite was cleaner and was used |
| `Rewrite rejected` | Rewrite wasn't better; original kept |
| `Tool round limit reached` | GPT-5.6 attempted more than four tool rounds; it receives a final limit response |
| `Decomposed into N task(s)` | Should always be 1, if not, the synthesis path is live and will strip the voice |
| `[Vault] Saved N place(s)` | Link ingestion worked |
| `[MediaIngest] ... -> scene` | Photo/video was understood |
