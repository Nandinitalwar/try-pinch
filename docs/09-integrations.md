# Integrations and Data Sources

What can actually be reached, and what can't. **Verify the ⚠️ and ❌ rows against current
docs before planning around them**, these are the ones that change.

## Messaging

| Channel | Provider | Status |
|---|---|---|
| iMessage | Linq | Blocked: sandbox expired 2026-08-17 and stored bearer token now returns 401; reactivate account and rotate token before the real phone test |
| WhatsApp | Twilio (sandbox) | Live. Text + media, both wired |
| SMS | Twilio | Same route as WhatsApp |

Linq v3 has two intentionally different outbound paths. Replies use
`POST /chats/{chatId}/messages`, keeping the response on the exact inbound thread. Proactive
sends use managed `POST /messages` with `to` and no fixed `from`; Linq reuses the healthy
chat when one exists and otherwise selects a line from the account pool. Do not replace the
managed endpoint with `POST /chats` unless Pinch deliberately needs to pin one sender line.

Chart replies add a PNG media part using a publicly reachable but short-lived signed URL.
The URL lasts 15 minutes and is rendered on demand from the stored deterministic chart;
the provider never receives an unsigned chart lookup endpoint.

The PNG is rasterized with resvg and a Noto Sans font encoded inside the API bundle, with
compact Latin labels instead of Unicode astrology glyphs. The renderer materializes that
font in the serverless temp directory; do not move it back to the monorepo-level
`node_modules`, which Vercel's function packager dropped despite Next tracing it. Do not
switch this path back to Sharp without configuring Fontconfig: embedded SVG fonts are not
supported there, and the Vercel result was a chart full of missing-glyph boxes.

The quickstart still foregrounds `POST /chats` because it is easy to demonstrate with one
provisioned number. The current Sending Messages guide and API reference are authoritative
for Pinch's managed-send use case.

The production subscription targets
`https://aiastrologer.vercel.app/api/webhook/linq?version=2026-02-03`. A live signed health
event passed on 2026-08-10, but the sandbox expired on 2026-08-17 and the stored API token
now returns 401. After Linq reactivates the account, rotate the token locally and in Vercel,
verify the existing subscription still targets this URL, and only then redirect it through
ngrok for the live-device pass. The sandbox remains inbound-first: the user must text the
Linq number before Pinch has a chat to reply on.

Incoming Linq images/videos are analyzed with Gemini. Voice notes are transcribed with
OpenAI `gpt-transcribe`; MP3/M4A/WAV/WebM go directly and other Linq-native voice formats
are normalized to WAV. OpenAI's completed-recording endpoint has a 25 MB limit. Linq's
native voice-memo send limit is 10 MB for a direct URL, but inbound processing still
enforces the lower relevant downstream limit for each media type.

**Twilio media URLs require HTTP Basic auth** on the account SID and auth token. Without
it they return 401 and images look like they arrive empty.

## Data sources for memory

| Source | Live API? | What you'd get | Effort |
|---|---|---|---|
| Texts + photos + voice notes sent to Pinch | ✅ | The richest source. Already flowing | built; live voice-device pass pending |
| Google Calendar | ✅ | Who they see, how often, weekend patterns | low, best ratio available |
| Gmail | ✅, restricted OAuth | Bookings, receipts, travel | medium for a private beta; high compliance burden for a public launch |
| Spotify / Strava | ✅ | Taste and habits, cheap per line of code | low |
| Instagram | ❌ | Basic Display API shut down end of 2024. Business-account API exposes only their own posts, not their feed | not worth it |
| Facebook | ❌ | Post/photo permissions exist but need Meta App Review; a personal assistant reading your feed does not get approved | not worth it |
| Location history | ❌ | Google moved Timeline on-device and killed the server API | use export |
| Photo library | ❌ | No Apple Photos API. Google Photos narrowed to picker-only access | only photos they hand over |
| Other iMessage / WhatsApp threads | ❌ | No supported Apple API exists. A local Mac collector could read `chat.db` with Full Disk Access | research lane, not normal onboarding |

### Gmail is technically reachable but not a lightweight public integration

Verified against Google's documentation on 2026-08-14. Continuous inbox access needs
`gmail.readonly` or another body-reading scope, which Google classifies as restricted.
If restricted-scope data is stored on or transmitted through Pinch's servers, a public
app must complete OAuth verification and a security assessment. A private test-user beta
can be built before that review, but "the API works" is not the same milestone as "the
integration can ship."

The live ingestion path is Gmail `watch` through Google Cloud Pub/Sub, followed by
incremental `history.list` synchronization. Each mailbox watch must be renewed at least
every seven days; Google recommends daily renewal. If a saved history cursor becomes too
old and Gmail returns 404, the account needs a full resync.

A Gmail add-on that reads only the message the user is actively viewing has a much easier
permission surface, but it is user-initiated context, not an agent continuously reading
the inbox. Start there if proving the advice experience matters more than proving ambient
awareness.

Official references: https://developers.google.com/workspace/gmail/api/auth/scopes,
https://developers.google.com/workspace/gmail/api/guides/push, and
https://developers.google.com/workspace/gmail/api/guides/sync.

### Personal iMessage history still has no supported ingestion API

Verified against Apple's Messages framework and an Apple Developer Technical Support
answer on 2026-08-14. An iMessage extension can work with its own interactive messages
and the currently selected conversation, but it cannot read arbitrary existing personal
threads. Apple DTS states that macOS has no API for reading the user's SMS messages and
that Messages AppleScript support is limited.

A Mac companion could read the private Messages database after the user grants Full Disk
Access, but that is an unsupported, Mac-only collector coupled to Apple's private schema.
Treat it as a research prototype with an explicit local permission flow, not as the main
consumer onboarding path.

Official references: https://developer.apple.com/documentation/messages and
https://developer.apple.com/forums/thread/804040.

## The way around the blocked sources

Both Meta platforms support user-initiated data export ("Download Your Information"), and
Google Takeout covers location history. The user requests their archive, gets a zip,
uploads it once.

**This is better than an API for this product, not a consolation prize.** A live API drips
in new data and leaves you knowing nothing on day one. An archive gives you years of
history in a single pass, every tagged place, the social graph, where they've actually
been. Cold start to genuinely knowing someone in one onboarding step.

It's also a cleaner consent story: they fetch their own data and hand it over, rather than
an app quietly reading their feed forever.

**Best combination:** archive upload at onboarding for depth, live APIs for freshness.

## A note on Poke

Interaction Company hasn't published what models Poke runs on; reports of Claude-based
routing are secondhand and shouldn't be treated as fact.

What *is* verifiable: OpenPoke, the open-source clone (cloned at `~/OpenPoke`), defaults
every agent role, interaction, execution, search, summarizer, email classifier, to
`anthropic/claude-sonnet-4` via OpenRouter.

Worth keeping the pipes separate: Poke can read and act on a connected Gmail/Outlook inbox
through OAuth, but that does not give it ambient access to the user's unrelated personal
iMessage history. Pinch's Poke-parity roadmap therefore treats email as a supported OAuth
integration and arbitrary message history as a separate Mac-companion research project.
