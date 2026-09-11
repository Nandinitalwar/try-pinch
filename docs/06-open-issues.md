# Open Issues

As of 2026-08-19.

---

## Needs a decision from Nandini

### Evidence-backed prompt catalog and signup value exchange

The prototype's contextual prompts are currently a hand-written hypothesis set. They are
useful for demonstrating the carousel, but we should not call any specific prompt
“evidence-based” until production or interview research supports it. The next test should
compare concrete jobs-to-be-done (rewrite, summarize, explain, plan, and practical local
help) against playful/contextual copy, measuring first-message rate, time to first message,
answer completion, follow-up rate, and signup conversion by prompt family.

The conversion moment should exchange clear value for signup rather than use a discount or
artificial urgency: after the first answer, offer to save this answer and continue with a
follow-up. Keep the answer visible before the request, and treat signup click as a guardrail
until saved-chat and second-message events exist.

**Revisit when:** a labelled prompt-family experiment has enough sessions to identify a
winner, or user interviews reveal a higher-intent first job.

### Inferring taste from birth city

Asked "what should i eat", Pinch suggested dal makhani and garlic naan to a user born in
New Delhi who had never mentioned liking Indian food. The English-only rule held, so this
is not the Hinglish problem, but it is the same underlying move: guessing preferences from
birth data rather than from anything the person said or saved.

Options: block preference inference from birth location entirely and rely only on the vault
and stated preferences, or allow it as reasonable prior. Currently allowed by default
because nothing blocks it, which is not the same as having been decided.

### Split identity across channels

iMessage stores a user as `+15558675309` (E.164). WhatsApp stores the same person as
`15558675309` (digits only). They are two separate users as far as every table is
concerned, **saves made over iMessage do not appear over WhatsApp.**

Directly undermines the cross-channel memory goal.

Fixing it means changing the identity key for existing SMS and WhatsApp users, which
orphans their current history and profiles. That's a data migration decision, not a code
one, which is why it hasn't been done unilaterally.

Linq's normalizer keeps the `+`; Twilio's strips everything non-digit. Whichever wins,
existing rows under the losing format need migrating or accepting as lost.

---

## Bugs

### ~~Prototype dev server returned 500 after a concurrent production build~~, FIXED 2026-08-19

Running `npm run build:prototype` while the Next dev server was using the same
`packages/prototype/.next` directory left the dev webpack runtime pointing at a missing
chunk (`Cannot find module './522.js'`). The source and production build were healthy. Stop
the dev server before running a production build, remove the generated `.next` cache, and
restart `WATCHPACK_POLLING=true npm run dev:prototype` if this appears again.

### ~~Edge city resolution double-counted onboarding impressions~~, FIXED 2026-08-19

The first IP-aware prototype pass rendered from the browser timezone, emitted an
`onboarding_viewed` event, then emitted the same denominator event again when the coarse
edge city arrived. The kinetic prompt and impression now wait for the private context
request to settle, including the no-city localhost response, so every reset produces one
impression with one resolved location source.

### ~~Prototype phone sidebar could never open~~, FIXED 2026-08-19

The phone shell forced the sidebar's collapsed state on every render, so its hamburger
looked interactive but could not open the drawer. Device changes now choose the correct
initial drawer state without overriding later clicks. The production build passes after
the fix.

### ~~GPT-5.6 re-saved birth data from conversation history~~, FIXED 2026-08-10

The first migration run correctly saved birth details, then called `save_birth_data` again
on an unrelated advice turn because the details were still visible in recent history.
That wasted a tool round and recomputed the same chart. The tool description and inline
chart rule now permit the save only when the latest message supplies or corrects birth
details. The final live harness made no duplicate save.

### ~~iMessage birth chart rendered as missing-glyph boxes~~, FIXED 2026-08-10

The SVG used macOS and Segoe font families, but Sharp rasterized it on Vercel through
Fontconfig, where those fonts did not exist. The browser SVG was fine and the Linq PNG
lost every title, label, placement, and symbol. The PNG path now uses resvg, a font stored
inside the API bundle, and portable Latin sign/planet abbreviations. A signed fetch from
the deployed production function returned a 294,580-byte PNG; visual QA confirmed the
1200px output is readable. A fresh phone send is the only delivery check still pending.

### Follow-up timing ignores the user's timezone

Delays are computed in absolute hours from the event, so a "next morning" follow-up
scheduled at 9am UTC arrives at 2am for someone in California. Blocked on the same missing
piece as the daily brief: current city and timezone are not stored, only birth timezone.

### ~~Mem0 works; using what it returns was the problem~~, REPLACED 2026-08-13

Diagnosed 2026-07-30. Storage and retrieval both verified correct. The failure was that the
transit briefing was framed as the thing to reason from, so retrieved memories sat in the
prompt unused. Asked "should i buy a new dress" with the sister's September wedding in
context, Pinch talked about Saturn. Fixed by reordering priority. Worth remembering as a
diagnostic pattern: check whether context is being *used* before assuming it is missing.
Pinch now owns extraction and retrieval in Convex; the prompt-priority lesson still applies.

### ~~A just-written memory could miss immediate semantic recall~~, FIXED 2026-08-13

The first live round trip intermittently returned nothing immediately after storing a
coffee preference. Convex's vector/full-text indexes had not surfaced the new row yet.
Retrieval now cosine-scores the newest eight transactionally-read records alongside the
indexes. The threshold was calibrated from relevant/unrelated pairs and three consecutive
live round trips passed.

### ~~Transits are guessed, not computed~~, FIXED 2026-07-27

Pinch repeatedly asserted "Saturn in Pisces" on dates where Saturn was in Aries, because
transits came from the model's priors and from web search rather than from maths.

Now computed. `computeTransits()` in `lib/astrology.ts` derives current positions,
retrograde state, aspects to the user's real natal placements, and exact/end dates. The
agent receives it as a private briefing; `search_web` is now explicitly forbidden for
anything astrological.

Verified: asked directly whether Saturn is in Pisces, Pinch now answers "No, it's in
Aries."

### ~~The task decomposer is dead weight~~, REMOVED 2026-07-27

It was worse than dead weight. It replaced the user's actual words with an LLM summary
before the agent ever saw them, which silently broke every voice rule that depends on
what they wrote. See [04-voice.md](04-voice.md) for the full explanation.

Now off the reply path: the raw message goes straight to `GeneralTaskAgent`. Saves a model
call per message as a bonus. `TaskDecomposer` and the multi-agent synthesis code still
exist but are unused, and can be deleted.

### Birth data occasionally missing on the turn right after saving

Seen once: birth details saved successfully on message 1, but message 2 behaved as if no
profile existed and re-asked. Not reproducible with a two-second gap between messages, so
it looks like a race between the Convex write and the next read. Worth confirming under
real texting speeds before shipping the daily brief, which reads profiles in bulk.

### Conversation history caps at ten messages

Every route truncates to ten. Anything older has to come through memory, which makes
memory quality load-bearing for mid-term context.

### ~~Local `/test` returned 404 after Watchpack exhausted native watchers~~, FIXED 2026-08-17

Starting Next.js from the normal macOS shell produced repeated `EMFILE: too many open
files, watch` warnings and compiled `/test` as the not-found route even though
`app/test/page.tsx` existed. Raising the process file-descriptor limit alone did not help;
the Next process only held about 59 descriptors. Starting development with
`WATCHPACK_POLLING=true npm run dev` removed the warnings, restored `/test` to HTTP 200,
and preserved hot reload through polling. If routes mysteriously disappear locally,
check the first startup logs before debugging the router.

### Local macOS DNS outage makes every reply provider look broken

Observed 2026-08-17 during a `/test` smoke turn. The page rendered and `/api/chat` returned
HTTP 200, but the reply was the generic failure text because normal hostname resolution
failed simultaneously for Groq, Convex, OpenAI, and Gemini. `scutil --dns` reported "No
DNS configuration available" even though `en0` was active, the default route existed,
`ping 1.1.1.1` worked, and explicit `dig @1.1.1.1 api.groq.com` succeeded. Flushing the DNS
cache did not restore the resolver. This is a Mac network-state failure, not evidence about
Groq response quality. Toggle Wi-Fi or restore the network service's DNS configuration,
then require a real `hi` response before running qualitative cases. The dev console should
eventually surface provider/connection errors instead of rendering the generic fallback as
if it were an assistant response.

### ~~Bare `hi` started birth-chart onboarding~~, FIXED 2026-08-17

The first integrated Groq smoke turn answered `hi` with “send me your name and birth
details in one line.” The system prompt said not to bolt onboarding onto a greeting, but a
voice rewrite preserved the wrong substance while shortening the opening. A narrow,
deterministic greeting path now returns ordinary small talk, skips the model and long-term
extraction, and is shared by web, Twilio, and Linq. Questions and media do not match it.

### ~~Running `next build` beside `next dev` broke the local test route~~, FIXED 2026-08-17

A production build and the polling dev server wrote to `packages/api/.next` concurrently,
leaving the dev runtime with a missing chunk (`Cannot find module './193.js'`) and making
`/test` return HTTP 500. The API route happened to recompile and still worked, which could
hide the broken browser console. Stop dev before running `next build`, or give the build a
separate output directory; never run both against the same `.next`. Moving the generated
cache aside and restarting dev rebuilt it cleanly.

---

## Incomplete

### Groq reply path still needs the integrated live harness

The provider-aware Responses path and deterministic configuration tests were added on
2026-08-16. A Groq key is now configured locally, and the seven-case raw-quality harness
completed on 2026-08-17 without rate limiting. It was fast (503 ms mean) but only one reply
was mechanically clean; semantic failures included inventing a detail about the roommate
fight. That rules out a production model switch on the current baseline.

The full provider path must still prove first-chart activation, one function-tool round,
and a voice rewrite if Groq remains under consideration for integrated local testing.
Groq's free plan gives GPT-OSS 120B only 8K tokens per minute, so the larger production
prompt may still 429 even though the compact 3,839-token run succeeded. Production remains
on OpenAI.

### Production prompt contains contradictory instructions

The current reply prompt says both that `search_web` must never be used for astrology and
that transit discussion may use search results for today's sky. It also says to react
before advising and to lead with the call without scoping those rules as clearly as the
new minimal prompt does. These contradictions are plausible contributors to inconsistent
raw replies, but changing them before the minimal baseline would muddy the diagnosis.

Run and review the minimal Groq harness first. Then remove one contradictory or repeated
instruction group at a time and compare the same cases; do not replace the production
prompt wholesale based on one attractive sample.

### Web test console is not authenticated

`/api/chat` accepts arbitrary public requests, so a deployed test console can spend model
credits and create Convex data. Chart SVG reads are restricted to random web-test session
IDs in production, but that is not a substitute for authenticating or disabling the whole
console outside internal testing.

`/api/memory` no longer accepts real-user identifiers in production without the optional
admin bearer secret, but that is an operator gate, not user ownership authentication. Do
not expose a user-facing "what do you know" screen through this route until real identity
and ownership exist.

### Proactive follow-ups have no consent or opt-out gate

Future-event detection writes `followups` rows, but nothing should deliver them yet. The
system does not store opt-in state, parse STOP-class keywords, check the health of the
existing chat, or know the user's current timezone. Until all four exist, morning briefs
and unanswered-user nudges remain disabled. Safe pilot behavior is one next-day follow-up
after an inbound conversation, then silence if unanswered; never cold outreach.

### ~~Linq production credentials are not configured~~, FIXED 2026-08-10

The API key and one-time signing secret are configured in `packages/api/.env.local` and
the linked Vercel project. Linq lists an active `message.received` subscription targeting
the stable production alias with `?version=2026-02-03`. The live endpoint returns 401 for
an unsigned request and 200 for a correctly signed non-message health event.

Still unverified until Nandini texts the sandbox line: real inbound delivery, the AI reply,
Linq's signed chart download, and blue-bubble delivery. Also implement Linq's opt-out and
chat-health rules before enabling proactive morning briefs; the inbound conversational
pilot is ready, but proactive sending is not.

### Linq sandbox expired and revoked API access

Observed 2026-08-17 while attempting the first real iMessage pass. The Linq dashboard
reports "Your sandbox has expired," and the bearer token stored in the linked Vercel
project now returns HTTP 401 from `GET /api/partner/v3/webhook-subscriptions`. This blocks
listing or redirecting the existing subscription, receiving a local tunneled webhook,
and sending a reply through Linq. This is an account-state blocker, not a Groq, ngrok, or
webhook-code failure. Upgrade/reactivate the Linq account, generate a fresh API token,
update `LINQ_API_KEY` locally and in Vercel, then run the live-device pass. Revisit when
Linq confirms the account is active; preserve the existing webhook signing secret if the
subscription still exists.

### ~~Non-Linq iMessage adapters remained in the tree~~, FIXED 2026-08-14

Blooio and SendBlue routes, clients, tests, credentials, docs, Vercel function entries,
and runtime provider selection were removed. Linq is now the only iMessage path.

### Linq photo and voice-note handling needs a live-device pass

Unit coverage verifies M4A direct transcription, CAF-to-WAV normalization, and propagation
of transcripts into durable user text. Still test a real Linq native voice memo, photo,
captioned attachment, and failed/oversized attachment on the provisioned line. Confirm the
live attachment URL remains downloadable for the full background-processing window.

### `/api/chat` doesn't log media URLs

The web test path logs events but passes an empty media list, since uploads arrive as
inline data rather than URLs. Media is still analysed and stored, only the raw-event
record is thinner than on the messaging paths.

### OpenAI credit exhaustion is hidden behind a generic reply

Observed locally on 2026-08-15. Gemini successfully analyzed an uploaded screenshot, then
OpenAI returned `429 credit_balance_exhausted` for memory embedding, the GPT-5.6 reply, and
memory extraction. `/api/chat` still returned HTTP 200 with “sorry, im having trouble
right now,” which made a billing failure look like a multimodal or prompt bug. Restore
credits or use a funded OpenAI project to resume testing. The local test UI should surface
the provider/status code in development while keeping the generic message in production.

### ~~Repetition across turns~~, FIXED 2026-08-10

Asked the same question twice in a row, Pinch gave near-identical answers with no
awareness it had just said that. The production rewrite gate now compares both proper
nouns and wording overlap against the last three assistant replies. Repeated callbacks
are spent, and near-duplicate generic replies are rewritten. If the user explicitly raises
the noun again it is allowed; following the user is not repetition.

### ~~Placement nicknames bypass the voice guard~~, FIXED 2026-08-10

Bare forms such as "Leo Moon" and multi-placement chart dumps are now blocked alongside
possessive forms. The chart image shows placements; conversational text gives the read.

### "What's my week looking like" is inconsistent

Sometimes answered from transits, sometimes deflected with "I can't access your personal
schedule". The model reads "week" as calendar rather than sky. Harmless but inconsistent, worth a prompt line once the calendar integration lands and the answer becomes genuinely
ambiguous.

### ~~Personal direction produced random, time-incoherent advice before onboarding~~, FIXED 2026-08-14

At 4:49 PM, “what should i do today? idk what to do” produced “go to bed” followed by a
plan for tomorrow. Two bugs combined: personal-direction wording bypassed chart onboarding,
and the current-time prompt incorrectly used the birth-city timezone. A London birth made
California afternoon look like after midnight. Personal direction now starts activation,
birth and current timezones are separated, and a deterministic guard rejects premature
sleep or already-past meal/daypart advice.

### ~~A historical greeting became the user's saved name~~, FIXED 2026-08-14

When a user supplied London as the final missing birth field, the reply model saved “Bean”
from an older “hi bean” exchange as their preferred name. Name writes now require the
latest user message to explicitly claim the proposed name. An unnamed chart can be computed
and held, but it is not attached or interpreted until the user says what Pinch should call
them.

### ~~First-chart activation ignored the photo and actual question~~, FIXED 2026-08-14

Asked “did i peak in 2014 (pictured?) check my horoscope” with a photo, Pinch replied with
the stock four-part activation script: chart attached, strength, blind spot, generic advice
for today. The deterministic guard was causing the slop by requiring that exact structure.
The reveal now answers the original request first, visual descriptions survive any
intervening name/birth turn, and image-based readings must cite a visible detail. Historical
years receive a computed monthly transit scan and cannot be replaced with a current-day
forecast.

The end-to-end local regression on 2026-08-14 used the original screenshot, collected the
name and London birth data, retained the image through that extra turn, and answered with
the computed Jupiter appearance timing around May 2014. The chart attached only after the
name was saved. Visual validation now requires overlap with a scene detail rather than UI
words such as “photo” or “chart.” The final guarded reply explicitly used both “Jupiter in
May” and the visible Polaroid instead of passing on generic image vocabulary.
