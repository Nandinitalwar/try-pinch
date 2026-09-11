# Roadmap

## Market signal: Instinct (reviewed 2026-09-11)

[Instinct's public launch page](https://instinct.com/) describes a private-access personal
assistant that connects to email, messaging, screen, audio, and location; operates a phone
and computer; accepts text or calls; follows up on dropped threads; and completes real-world
jobs such as rides and home services. That is the relevant product bar—not a larger chat UI.

Pinch should converge on the same interaction principles while keeping an astrology-native
wedge and a narrower, auditable trust boundary:

| Instinct signal | Pinch response | Proof before launch |
|---|---|---|
| No new interface; text or call the assistant | Keep iMessage primary; make web an inspection and test surface | A task can be created, reviewed, and completed entirely over text |
| Connects across personal context | Add integrations incrementally, beginning with calendar and read-only email | Per-source consent, provenance, correction, export, and delete |
| Notices dropped threads and acts proactively | Ship follow-ups, reminders, and the morning brief | Opt-in, STOP, quiet hours, idempotency, and visible execution log |
| Uses phone/computer like a person | Add browser/device execution only for workflows without reliable APIs | Sandboxed workers, scoped credentials, preview/confirm for external effects |
| Handles real-world coordination | Start with calendar-aware plans, reservations, rides, and local recommendations | Price/attendee/destination confirmation plus receipts |
| Learns deeply personal nuance | Build the always-on portrait from explicit memory and corrections | Every inference shows its evidence and confidence; no covert sensing |

### Recommended sequence from that signal

1. **Delegation loop:** reminders and tasks with states, retry rules, proactive delivery,
   and an audit trail. This is the smallest credible version of “it follows through.”
2. **Calendar-aware action:** read availability, propose a plan, confirm, then write.
3. **Dropped-thread detector:** surface stale commitments from Pinch conversations first;
   email-derived follow-ups wait for read-only Gmail consent.
4. **Call/voice intake:** treat a voice note or call transcript as the same task protocol,
   with source retention and correction.
5. **Computer-use worker:** browser automation behind a sandbox and approval boundary,
   introduced only after API-based actions are reliable.
6. **Astrology-native differentiation:** rank timing suggestions using real transits and the
   user's stated goals, never using astrology to silently authorize an action.

Do not copy the breadth before the control plane exists. Pinch's advantage should be that a
user can see what it knows, why it acted, what it will do next, and how to stop it.

## Product direction: Poke parity, then astrology-native advantage

Pinch is becoming a messaging-native personal agent, not only an astrologer that answers
one turn at a time. “Poke parity” means email management, calendar, contacts, reminders,
persistent tasks, proactive triggers, web research, integrations/recipes, attachments and
documents, and an inbound API. Pinch should then exceed that baseline with chart-aware
timing and advice grounded in the person's own memory.

This is feature parity, not permission parity by default. Each data source and each action
is separately granted, visible, revocable, and deletable. Read access never silently turns
into send/edit access. Proactive messaging is always opt-in.

## Delivery phases

| Phase | Capability | Exit gate |
|---|---|---|
| 0. Trustworthy channel and input | Linq-only iMessage, text, photos, video, voice notes, chart images | **Mostly done.** Multimodal unit tests pass; real Linq voice/photo pass pending. Add stable identity, current timezone, consent records, STOP, deletion/export, and chat-health checks |
| 1. To-do system and execution | Natural-language reminders, recurring reminders, a list/complete/snooze/edit flow, persistent execution agents, proactive trigger scheduler | No send until timezone + opt-in + STOP exist. Every task needs state, provenance, next run, retry/idempotency, and a visible audit trail |
| 2. Gmail private beta | Search/read threads and attachments; important-email alerts; summarize/triage; draft/reply/forward/send; labels/archive | Test users only first. OAuth verification plan accepted, restricted-scope security design reviewed, Pub/Sub watch renewal and history-cursor recovery tested. Draft review precedes autonomous send |
| 3. Calendar, contacts, Outlook | Availability, event create/update/delete, RSVP, recurring events, attendee/relationship context; Microsoft mail/calendar/contacts | Incremental OAuth, timezone correctness, conflict checks, confirmation for destructive/external actions, provider disconnect cleanup |
| 4. Recipes and integrations | Reusable automations, MCP/third-party OAuth connectors, web search, Notion and personal-data integrations, inbound Pinch API | Per-recipe permission manifest, secret isolation, rate limits, execution log, kill switch, integration-level revoke |
| 5. Personal message-history research | User-owned archive import first; optional local Mac companion for iMessage history | Never imply Linq grants access to unrelated chats. Mac prototype requires explicit Full Disk Access, local-first filtering, documented private-schema risk, and a complete deletion path |
| 6. Remaining parity edges | PDF/file understanding, attachment sending, website generation, and human-task handoff where useful | Add only after the core task/email/calendar loop is reliable and observable |

## Permission plan

| Integration | Start permission | Later action permission | Non-negotiable guardrail |
|---|---|---|---|
| Linq | Inbound messages/attachments sent to Pinch | Proactive messages | Explicit opt-in, STOP immediately disables, current-chat health, rate caps |
| Gmail | Identity plus restricted read/search access | Draft first; reply/send/forward/labels only after a separate grant | Google verification/security assessment before public server-side restricted-data use; encrypt tokens/data; renew `watch` daily; full resync on expired history cursor |
| Google Calendar | Read calendars and free/busy | Create/update/delete/RSVP after a separate grant | Show timezone and attendees; confirm external invitations, cancellation, and destructive edits |
| Google Contacts | Read selected contacts | Contact writes only if a workflow proves it needs them | Minimize copied fields and surface the source of relationship inferences |
| Microsoft 365 | Mail/calendar/contact read scopes | Corresponding Graph write scopes incrementally | Same read/write separation and tenant-admin policy handling as Google |
| Mac message collector | User-selected import or local read with Full Disk Access | No message sending through this collector | Unsupported/private Apple schema; local-first; explicit folder/database scope; pause and erase controls |
| Third-party recipes | OAuth/API scopes declared per connector | Per-action grants | No blanket “all integrations” token; revoke one integration without breaking the account |

Gmail is the hardest permission milestone: body-reading scopes such as `gmail.readonly` are
restricted. If Pinch stores or transmits that data through its servers, a public launch can
require Google OAuth verification and a security assessment. Build a private test-user
beta first, with Pub/Sub `watch` + `history.list`, not inbox polling. See
[09-integrations.md](09-integrations.md).

Apple exposes no supported API for arbitrary personal iMessage history. Linq gives Pinch
the messages and attachments sent to its own line; it does not grant access to the user's
other conversations. Archive import is the safe default. A Full-Disk-Access Mac companion
is explicitly experimental.

## Immediate build order

| # | Step | Status |
|---|---|---|
| 1 | Make iMessage Linq-only | **Done 2026-08-14.** Alternate providers and runtime selection removed |
| 2 | Multimodal replies and memory | **Done in code 2026-08-14.** Images/video become agent context; voice becomes durable user text. Live Linq device pass remains |
| 3 | Memory test surface | **Available.** The web console shows extracted memories; add explicit source/importance explanations and correction/forget controls |
| 4 | Reminder/to-do state machine | **In progress 2026-09-11.** Durable create/list/complete/cancel/snooze states, idempotent creation, API, and web inspection exist. Natural-language extraction, edit/recurrence, and delivery remain |
| 5 | Consent, STOP, current city/timezone, chat health | Blocks all proactive sends and the morning brief |
| 6 | Persistent execution worker + hourly scheduler | Wakes due tasks, retries safely, records results, and reports through Linq |
| 7 | Gmail read-only private beta | Follows the permission and sync gates above; compose/send comes later |

## Morning brief

The first proactive recipe is a one-line daily brief personalized by real transits, current
city/timezone, saved places, and only strong behavioral evidence. `computeTransits()` and
the deterministic chart wheel are done. Current timezone, opt-in/STOP, chat health, hourly
cron, and the brief composer remain.

“How late were you up” only means how late they texted Pinch. Use it for a strong 2am
signal, never infer a night out from silence or casual late scrolling. The brief has its
own one-line voice contract in [04-voice.md](04-voice.md).

## Supporting backlog

| Feature | Why it matters |
|---|---|
| Always-on portrait | Compact, regenerated view of the person so being known is not reduced to on-demand vector lookup |
| Archive importer | Years of Instagram/Facebook/Google Takeout history at onboarding; better cold start than drip-feed APIs |
| Place resolution | Converts extracted names into real coordinates and travel-aware suggestions |
| Spotify / Strava / Oura-class signals | Taste, exercise, recovery, and routine context through explicit integrations |
| Expanded eval corpus | Multi-turn memory correction, reminders, multimodal live fixtures, email action safety, and recommendation factuality |
| Dead internal routing cleanup | Remove the unused `TaskDecomposer`/multi-agent synthesis path after confirming no scripts depend on it |
