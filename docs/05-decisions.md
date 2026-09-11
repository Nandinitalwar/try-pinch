# Decision Log

Settled calls with their rationale. **Don't reverse one of these without reading why it
was made.** Where a revisit trigger is listed, that's the condition worth reopening on, not before.

---

### Web is the control plane; messaging remains the product surface
**2026-09-11**

The web experience exists for development, memory inspection, consent, and an execution
audit trail. Pinch does not become a dashboard-first assistant. User-facing delegation
must work over iMessage, while web supplies visibility and correction.

Instinct's public positioning validates a no-new-interface assistant reached by text or
call and working across existing apps. Pinch already has that messaging wedge. A separate
destination UI would dilute it, while an inspection surface solves the harder trust and
evaluation problem.

**Revisit when:** users repeatedly fail to discover or manage tasks over messaging, or a
workflow requires dense visual manipulation rather than review and approval.

---

### The onboarding mark is the ChatGPT logo, with rotation only
**2026-08-19**

The logged-out hero uses the recognizable monochrome ChatGPT knot as its dynamic cue. It
is solid white in the dark experience and rotates once every 54 seconds. Bouncing,
breathing, pointer parallax, color sweeps, and other attention-seeking motion were removed:
the logo should feel alive on a second look without changing the familiar ChatGPT shape or
competing with the prompt being typed into the composer. `prefers-reduced-motion` disables
the rotation.

**Revisit when:** usability testing shows the mark is not noticed at all, or the real
ChatGPT shell adopts a different motion language.

---

### ChatGPT growth interview demo is a separate, deterministic prototype
**2026-08-19**

The logged-out onboarding concept lives in `packages/prototype`, not in the Pinch API or
marketing site. Its activation bet is a slowly rotating ChatGPT mark above a living composer placeholder:
one complete prompt types in, pauses, erases, and advances through five concrete jobs whose
order and plan wording respond to local time, day, and device. The carousel no longer uses
awkward city-based food/activity copy. This supersedes the earlier three-card bloom;
keeping one suggestion visible preserves the calm logged-out page and lets the composer
itself demonstrate use cases instead of adding another menu.

It never asks for browser geolocation permission. A deployed Vercel request may contribute
only its edge-derived city, region, and country; the route does not return the raw IP or
coordinates, stores nothing, and is private/no-store. Localhost has no meaningful IP
geography, so it falls back to the browser timezone and explicit prototype controls. A
one-tap answer card still demonstrates the downstream sharing loop from the same session.

The prototype deliberately uses canned local replies and an in-browser event log. An
interview demo must work without credentials, wifi, model variance, or production data,
and the PR should isolate the onboarding hypothesis from reply quality. The control arm,
forced contexts, phone preview, accepted-suggestion event, and first-message timing make
the product claim falsifiable instead of presenting the animation as visual polish.

The deterministic context check covers all 168 weekday/hour combinations. Every reachable
bucket returns the same five clean jobs, with different ordering for morning, workday,
evening/weekend, and late-night contexts. City remains available as a coarse edge signal,
but is not forced into the prompt copy.

**Revisit when:** logged-out first-message and return-rate data identify a stronger
activation surface, the real ChatGPT shell changes enough that the control is stale, or a
production integration needs a different location, experimentation, or analytics contract.

---

### Memory store: Convex, not turbopuffer
**2026-07-25**

turbopuffer is a search index, not a database. The memory design needs entities with
provenance, sentiment that updates on revisit, and joins between memories and entities, turbopuffer can't hold any of that, so it would run *alongside* Convex with dual-write
sync, backfills and drift to own. Its real advantage (cheap storage at hundreds of
millions of vectors) is a problem this product does not have.

Convex is already in the stack and has native vector and full-text indexes. Hybrid search
is two lookups merged with reciprocal rank fusion.

The store sits behind an interface so switching later is one file.

**Revisit when:** past ~10M vectors, hybrid ranking quality becomes the bottleneck, or
Convex's limits (action-only vector search, ~256 result cap, equality-only filters) start
showing up in real queries.

---

### Dropping Mem0
**2026-07-25**

It decides what's worth remembering on your behalf and gives no provenance. Owning
extraction is the entire point of a memory layer you can audit, correct and delete from.

Implemented 2026-08-13. `lib/simpleMemory.ts` now owns structured extraction, embeddings,
hybrid retrieval, correction and forgetting; Convex owns the records and indexes. The
one-time production migration retained 51 of 645 legacy records after reclassification
(50 active after one same-key correction) and preserved
their Mem0 record IDs as provenance. The Mem0 key remains local only for rerunning the
migration and is not used by production.

---

### Memory extraction and retrieval models
**2026-08-13**

Use GPT-5.6 Luna with strict structured output for durable-memory operations and
`text-embedding-3-small` at 512 dimensions for retrieval. The user-facing Sol model does
not decide what gets stored, and the assistant reply is never extraction input.

Convex vector and full-text results are joined with reciprocal-rank fusion. Search indexes
briefly missed a record written in the immediately preceding call, so the newest eight
transactional records are also cosine-scored locally. Three consecutive live
store/recall/correct/forget round trips passed after that change. Similarity uses 0.26,
calibrated against relevant scores of 0.281-0.538 and unrelated scores of 0.063-0.191.

Corrections supersede rather than overwrite, deletes are soft, and every new fact carries
raw-event provenance. Privacy is enforced twice: the extraction instruction excludes
sensitive categories, then deterministic patterns reject common credentials, payment/ID
numbers, exact street addresses, diagnoses and sensitive identity/belief statements.

**Revisit when:** a labelled retrieval set shows worse precision/recall, a user has enough
memories that the eight-record freshness window is inadequate, or extraction cost/latency
is material in production. Do not raise recall by injecting arbitrary recent memories.

---

### Video: caption + cover frame, no downloading
**2026-07-25**

Downloading TikTok video is the most fragile link in the chain, restricted by their
terms, endpoints move, slow inside a serverless function. Creators put venue names in the
caption and burn them into on-screen text, which the vision model reads off the cover
frame.

Proven in testing: extraction still returned all three venues when the metadata fetch
failed outright, working from the message text alone.

**Revisit when:** extraction quality is measurably limited by not seeing the full video.

---

### Duplicate venues: exact match only
**2026-07-25**

"Oyster Club" and "The Oyster Club" stay separate. Merging two genuinely different venues
is unrecoverable; splitting one venue in two is easy to fix later.

**Revisit when:** real user data shows how often near-duplicates actually occur.

---

### Channels: Linq is the only iMessage provider
**2026-08-14** (supersedes the temporary multi-provider decisions)

Linq v3 owns every iMessage send and receive path. The Blooio and SendBlue clients, routes,
tests, configuration, and provider selector were deleted. Maintaining three nearly
identical webhook pipelines multiplied drift in memory, media, follow-ups, and security;
an untested fallback was not resilience. Birth-chart attachments continue to use Linq
media parts with a publicly reachable 15-minute signed PNG URL; the introduction is
recorded only after Linq accepts the message.

Production activation completed on 2026-08-10: the API key and one-time webhook signing
secret are stored locally and in Vercel, and Linq has an active `message.received`
subscription pinned to the `2026-02-03` payload version. The live route rejected an
unsigned request and accepted a correctly signed non-message health event.

**Revisit when:** measured Linq delivery reliability makes the channel non-viable. A future
provider change is a migration, not a dormant runtime selector.

---

### Voice notes become user-authored text; visual descriptions do not
**2026-08-14**

Voice notes are transcribed with OpenAI `gpt-transcribe` before the turn is saved. The
transcript participates in the reply, history, memory retrieval/extraction, link ingestion,
chart intent, and reminder detection. Images and videos still use Gemini, but their model-
generated descriptions remain bracketed agent context rather than being attributed to the
user. Directly supported recordings are uploaded as-is; other Linq voice-memo formats are
normalized to mono WAV with a bundled ffmpeg binary.

**Revisit when:** live Linq traffic shows a different attachment MIME/URL shape, the 25 MB
limit rejects normal voice notes, or transcription quality needs language-specific hints.

---

### Poke parity is the product direction, gated by permissions
**2026-08-14**

Pinch should grow from conversational astrologer into the same class of personal agent:
email, calendar, contacts, reminders, persistent tasks, proactive triggers, web research,
integrations/recipes, files, and an inbound API. Access must be incremental and revocable;
reading does not imply permission to send, modify, or proactively message. Gmail begins as
a private test-user integration because body-reading scopes are restricted. Personal
iMessage history is a separate Mac-companion research lane because Apple exposes no
supported arbitrary-history API.

**Revisit when:** user research says a narrower workflow is more valuable, Google/Apple
permissions change, or the permission burden exceeds the value of ambient access.

---

### Voice rules enforced in code, not prompt
**2026-07-25**

Three rounds of prompt tightening didn't stop the model using explicitly banned phrases.
A small fast model at high temperature won't honour forty negative constraints reliably.
Moved the check into `lib/voiceCheck.ts` where it can't silently regress.

See [04-voice.md](04-voice.md).

As of 2026-08-10 the production check also blocks bare placement dumps ("Pisces Sun,
Leo Moon"), catches repeated callbacks across recent assistant turns, and permits the
callback when the user raised that subject again. Failed rewrites get up to three fresh
passes rather than immediately shipping the first known violation.

---

### English only
**2026-07-25**

No code-switching into Hinglish or any other language based on birth country or name.
Product decision, the audience is English-speaking.

---

### Decomposer removed from the reply path
**2026-07-27**

`TaskDecomposer` was rewriting every user message into an LLM-authored task description
before the agent saw it, so the agent never read a word the user wrote. This made the voice
unfixable by prompting and was the real cause of months of flat, service-like replies.

The raw message now goes straight to `GeneralTaskAgent`. One fewer model call per message.
The decomposer and multi-agent synthesis code remain in the repo, unused, pending deletion.

**Lesson worth keeping:** when output quality resists prompt changes, check what the model
is actually receiving before writing another rule.

---

### Tone target is Poke, not an assistant
**2026-07-27**

Pinch is a person with opinions, not a service. Reacts before advising, is allowed to be
funny and blunt, and does not turn every message into a recommendation. Matches the user's
energy literally, including punctuation.

Prompt was cut roughly in half at the same time: a long list of rules and negative
constraints was producing compliant, lifeless output. A short persona brief works better.
Length ceiling raised from 5 to 8 sentences, temperature from 0.7 to 0.85.

The production ceiling was later tightened to four sentences and one text block after live
testing showed eight reliably turned a reply into an essay. Temperature remains 0.85.

---

### No em-dashes, ever
**2026-07-27**

Zero tolerance, enforced in code. It is the loudest tell that text was machine written and
models produce them constantly. Also blocked: "it's not X, it's Y", "here's the thing",
"at the end of the day", "that said", "let's be real", and similar LLM fingerprints.

---

### Transits computed, never searched
**2026-07-27**

`search_web` is now explicitly forbidden for horoscopes, transits and retrogrades, both
in the system prompt and in the tool's own description. Astrological search results are
frequently wrong about dates and full of vedic terminology the voice rules ban.

Everything about today's sky is computed from the ephemeris instead: positions, retrograde
state, aspects to the user's actual natal placements, and the dates each aspect perfects
and leaves orb.

The briefing is handed to the agent as **private input** with an explicit instruction not
to repeat its vocabulary, geometry in, plain language out. Aspects are pre-translated
into meaning ("is putting friction and pressure on their Moon, their emotions, comfort,
what they need to feel safe") so the model is never tempted to recite the mechanics.

Weekdays are spelled out in the briefing because the model converts ISO dates to the wrong
day. "Peaks Thursday" being off by one undoes exactly the credibility precise timing buys.

---

### Birth-chart images are deterministic diagrams
**2026-08-10**

The visual birth chart is rendered as SVG from the same stored ephemeris values the agent
uses. AI image generation is deliberately not involved: a decorative model must never get
the chance to invent a degree, sign, aspect, or rising sign.

Natal planets use Western tropical geocentric ecliptic longitude. The reference chart for
1996-03-03 04:15 in New Delhi agrees with Swiss Ephemeris 2.10.03 within 0.003° in the raw
comparison (the regression tolerance is 0.02°). Invalid dates, coordinates, timezones, and
nonexistent DST wall times are rejected. A fall-back time that occurs twice retains both
UTC candidates and both possible Ascendant degrees; no single rising degree is claimed.

When birth time is unknown, the wheel omits the Ascendant and checks whether the Moon can
change signs during that local date. A possible change is displayed as uncertainty, never
collapsed into a confident Moon sign. Houses are not drawn or claimed.

A birth date without a known birth-location timezone is stored as onboarding data but does
not produce a chart. Defaulting that case to UTC created precise-looking placements from an
assumption the user never supplied. Correcting a birth record with incomplete data clears
the old derived chart until it can be recomputed.

The browser keeps familiar Unicode astrology glyphs, but the iMessage PNG uses compact
Latin labels (`ARI`, `SU`, and so on) rendered by resvg with a self-contained Noto Sans
TTF. The font is encoded inside the API bundle and materialized in the function's temp
directory, because Vercel dropped a font traced from the monorepo-level `node_modules`.
Sharp was removed from this path after Vercel's Fontconfig substituted every label and
symbol with missing-glyph boxes. Portable labels are less decorative than relying on a
server font that may disappear, and remain readable in the smaller iMessage preview.

The visual language is a celestial terminal or “natal signal,” not a block of raw ASCII.
Raw text art wraps and misaligns in iMessage's proportional font and cannot represent exact
degrees honestly. The deterministic SVG now uses a near-black signal grid, segmented neon
zodiac ring, terminal placement index, and collision-aware concentric marker lanes. The
style can change without changing a single ephemeris value.

**Revisit when:** adding a house system. Pick and document the system first; do not draw
decorative house cusps that look computed.

---

### Birth-chart delivery is a phone-first Aura Seal
**2026-08-18**

The default birth-chart attachment is now a 1080×1350 portrait card rather than the
1200×1200 technical diagram. The square devoted nearly a quarter of its area to a degree
index that became unreadable in an iMessage bubble, so more information produced less
usable proof of personalization. The Aura Seal keeps the verified zodiac, planet,
aspect, Ascendant and uncertainty geometry, makes the wheel dominant, and surfaces the
Sun, Moon and rising sign in three large phone-readable cells.

Color and decoration are personal but deterministic: the Sun, Moon and Ascendant signs
seed a three-color palette, exact planetary longitudes seed the star field, and only
computed aspects become connecting lines. AI image generation remains outside the chart
path. The shareable card deliberately omits exact birth date, time and city; `layout:
'full'` preserves the old degree index and metadata for an explicit full-detail request.

`/chart-lab` renders Midnight, Prism and Velvet treatments against the same reference
chart. Midnight is the delivery default while visual preference is being tested. Prism
is intentionally brighter and Velvet warmer, so preference tests compare materially
different moods rather than imperceptible palette shifts. The complete deterministic
suite passed 54/54 after the change, including portable Linq PNG rendering, unknown-time
Moon uncertainty, ambiguous DST rising times and the full-detail fallback.

**Revisit when:** real iMessage screenshots show that the Big Three cells or uncertainty
copy are not readable at bubble width, preference testing selects another mood, or users
request exact degrees often enough to justify a second attachment. Do not put the dense
placement table back on the default card merely because room exists at source resolution.

---

### User-facing reply model: GPT-5.6 Sol
**2026-08-10**

The reply agent now uses GPT-5.6 Sol through the OpenAI Responses API. Gemini stays on
narrow birth parsing and media understanding; memory extraction moved to GPT-5.6 Luna on
2026-08-13. This is a scoped reply model migration, not a rewrite of the deterministic
astrology or chart pipeline.

Responses run with medium reasoning, low text verbosity, and OpenAI storage disabled.
Function-call results and encrypted reasoning items are replayed explicitly inside the
bounded four-round tool loop. Targeted voice rewrites use low reasoning. The model and
main reasoning effort are environment-configurable, but the production defaults are
`gpt-5.6-sol` and `medium`.

The final local production-path suite passed the complete first-horoscope flow, chart
tool call, repeated advice, chart redisplay, and all voice checks. Route latency in that
run ranged from about 4 to 13 seconds. At published list prices, the observed GPT reply
turns were roughly 2.2 to 4.9 cents before cached-input discounts. One early run showed
the model re-saving birth data found in old history; tool instructions now restrict saves
to details supplied or corrected in the latest message.

**Revisit when:** production p95 reply latency or cost is too high for the texting loop.
Try `low` reasoning first; do not silently swap the user-facing model without rerunning
the live harness and comparing the actual replies.

### Groq is the free local reply-provider lane, not a production model swap
**2026-08-16**

The reply agent can now select `groq` with `PINCH_REPLY_PROVIDER` while keeping the same
bounded Responses API tool loop. Groq's beta Responses endpoint accepts the OpenAI SDK,
function tools, and reasoning effort, so a second agent implementation would only create
drift. Provider-specific request construction omits OpenAI-only storage, encrypted
reasoning, safety-identifier, and prompt-cache fields that Groq rejects.

The Groq default is `openai/gpt-oss-120b` at low reasoning: it is the quality-first
GPT-OSS option on the free-plan list and keeps the quality test meaningful. OpenAI/GPT-5.6 Sol remains the
code default and the production baseline until the live harness compares the actual
astrologer voice. Groq free-plan limits are only a development lane: 8K tokens per minute
means a tool round or voice rewrite can throttle even when the 1,000-request daily limit
looks generous. A provider configuration missing its provider-specific key fails clearly
instead of silently falling back.

**Revisit when:** a representative Groq live harness passes voice and activation checks,
or its token-per-minute limit repeatedly breaks ordinary multi-call turns. Do not deploy
the provider switch based only on a cheap single-turn smoke test.

---

### Live production-path checks complement unit evals
**2026-08-10**

The Python eval package had drifted away from the production prompt and could pass while
the real TypeScript path still shipped banned output. The authoritative deterministic
suite now imports `lib/voiceCheck.ts` and `lib/astrology.ts` directly. A separate live suite
drives `/api/chat` and `/api/chart` through the production reply model and Convex. Short transactional replies
such as "here it is" are excluded from semantic similarity scoring; repeated proper nouns
are still checked at any length.

The live check is intentionally not part of every unit run because it spends model calls,
writes test profiles, and is stochastic. It is required before a release touching the
prompt, tool loop, birth-data save path, or chart delivery.

---

### First personal horoscope reveals the natal chart
**2026-08-10**

The first personal horoscope request is the natural onboarding moment: it demonstrates
why Pinch is more personal than a generic sun-sign feed. If no usable chart exists, Pinch
collects the missing birth details first. The completed reply attaches the deterministic
wheel, briefly explains one stable personality pattern and its recurring tension, and
then gives the forecast the user originally requested. A persisted `chartIntroducedAt`
prevents the reveal from repeating after conversation history is truncated.

This remains a deterministic trigger around an LLM-written response. The code decides
when the chart should appear and checks the required content; the model writes the actual
reading and forecast.

After the first live iMessage read proved that two sentences could satisfy the old guard
while still feeling generic, the reveal was initially forced into four parts: attachment,
strength, blind spot, forecast. A live photo question on 2026-08-14 proved that rubric was
itself the source of generic slop: Pinch ignored “did I peak in 2014?” and the image to fill
the template. The reveal now answers the triggering request first, mentions the attachment
once, and uses two to four sentences with a 30-word floor. A photo requires a visible
detail; a historical year uses a computed monthly scan of slow-planet contacts to the
person's natal chart and exposes one planet as a plain-language professional anchor. The
guard explicitly rejects the old canned template and replacing
a historical question with today's forecast.

As of 2026-08-14, a preferred name is also required before this reveal. The activation
states are explicit: collect name and birth inputs, collect only the remaining field,
then reveal; activation completes only after the named chart attachment and useful first
reading are delivered. Personal-direction wording such as “what should I do today?” uses
the same flow. A deterministic reply check rejects an onboarding question that skips a
required field, while name writes accept only a name explicitly claimed in the latest
message. This prevents an earlier assistant greeting or another person's name in history
from becoming the user's identity.

**Revisit when:** onboarding completion data shows that asking for all birth details on
the first horoscope causes more abandonment than the chart reveal earns, or when measured
activation improves with a two-step name-first flow instead of one combined question.

The natal timezone and current timezone are separate facts. A birth city says where the
chart starts, not where the person lives today. The California pilot uses
America/Los_Angeles for current-day advice until a separately sourced current timezone is
stored; it never falls back to `birthTimezone`. This prevents a London-born California
user from receiving midnight advice in the late afternoon.

**Revisit when:** current location or timezone is collected with explicit user consent.
Persist it separately and add travel-aware expiration; do not overload the birth field.

---

### Media analysed before replying, links ingested after
**2026-07-25**

If someone sends an outfit and asks how it looks, the agent has to be able to see it, so
photo and video analysis blocks the reply. Costs a few seconds, which is the right trade
for a message containing media.

Link ingestion involves fetching and understanding remote content and takes longer, so it
runs after the reply is sent. The places are in the vault by the next message.

---

### Raw model quality gets a minimal harness before prompt or provider changes
**2026-08-17**

Use `scripts/test-minimal-quality.ts` to answer the narrow diagnostic question “can this
model sound like Pinch at all?” The harness calls Groq GPT-OSS 120B directly with a compact,
fixed prompt, exact natal chart, and only the private context needed for each of seven
representative texts. It deliberately bypasses Next.js, Convex, memory, tools, onboarding,
conversation history, and voice rewrites. Raw replies are shown with provider token and
latency telemetry plus deterministic voice flags, but semantic quality stays a human
review because a ban-list pass is not the same as a good astrologer.

This does not replace the production live harness. The minimal run diagnoses the model and
core voice; the production run verifies the integrated product. The prompt is capped by a
unit test so it cannot silently grow into another full-stack simulation. Groq is the
default because its free plan makes repeated early experiments cheap, but production
remains GPT-5.6 Sol until both the raw comparison and production-path gate support a change.

**Revisit when:** the raw Groq replies have been reviewed and either establish a usable
quality floor or show a repeatable failure. Add another provider only to compare a specific
failure on the same fixed cases; do not expand this harness with databases, tools, or
rewrites.

The first live baseline ran on 2026-08-17 with `openai/gpt-oss-120b` at low reasoning.
Seven calls used 3,839 tokens total (3,213 input, 626 output, including 313 reasoning) at
503 ms mean latency. Speed is excellent, but raw product quality is not sufficient: six of
seven replies had deterministic voice violations, all six used a forbidden dash, two
recited chart anatomy, and the roommate response invented a trash-on-the-floor dispute
that the user never described. The historical-photo response used both the visible yellow
cake and a grounded Jupiter/January anchor, proving that the fixed evidence can work, but
one strong case does not offset the semantic fabrication and instruction-following misses.

**Measured conclusion:** Groq GPT-OSS 120B is useful as a fast, free diagnostic lane, not
a production replacement on this baseline. A rewrite can remove punctuation but cannot
safely repair invented life facts. Preserve the raw report at
`packages/api/quality-results/groq.md` and compare any prompt or model change against these
same cases.

---

### Bare greetings bypass the model and long-term extraction
**2026-08-17**

`hi` through the integrated Groq path was rewritten into “send me your name and birth
details,” directly violating the settled voice rule that a greeting gets a greeting. It
also spent 7,539 tokens across the draft and rewrite, nearly the entire Groq free-plan
minute, then called OpenAI memory extraction even though a greeting contains nothing
durable.

A deliberately narrow deterministic fast path now handles only bare greetings such as
`hi`, `hey`, `yo`, and `morning`, mirrors obvious punctuation/casing, and skips memory
retrieval, follow-up detection, and extraction. Any real question, personal content, or
media context still reaches the full agent. This is not a broader canned-response system;
it protects the conversational floor and keeps expensive reasoning for turns that need it.

**Revisit when:** real greeting transcripts show the fixed responses feel repetitive, or
the reply model can pass the same integrated greeting cases cheaply and reliably. Do not
expand the fast path to advice, venting, or astrology without a separate measured failure.
# 2026-09-11 — Web is the control plane; messaging remains the product surface

**Decision:** Use the web experience for development, memory inspection, consent, and an
execution audit trail. Do not turn Pinch into a dashboard-first assistant. User-facing task
delegation should work over iMessage, with web providing visibility and correction.

**Why:** Instinct's current public positioning validates a no-new-interface assistant that
is reached by text or call and works across existing apps. Pinch already has a messaging
wedge. A separate destination UI would dilute that advantage, while an inspection surface
solves the harder trust and evaluation problem.

**Revisit when:** Users repeatedly fail to discover or manage tasks over messaging, or a
workflow genuinely requires dense visual manipulation rather than review/approval.
