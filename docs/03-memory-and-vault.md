# Memory and the Vault

The goal: an assistant that genuinely knows someone, not one that can look things up.

## Three layers

**1. Raw event log.** Every inbound message, photo and link, stored verbatim before
anything interprets it. Append-only, never mutated. This exists so extraction can be
rerun against history as the extractors improve, you are never limited to what your
first version of the parser happened to notice.

**2. Entities.** Structured things derived from events: places, garments. Each carries
provenance, which events it came from. This is what makes "recommend a restaurant"
possible, because a place is a row with a city and a category, not a sentence in a blob.

**3. Semantic recall.** Pinch-owned durable facts in Convex, with OpenAI embeddings plus
Convex vector and full-text indexes. For fuzzy "what is this person like" retrieval.

## What's stored

| Table | Holds |
|---|---|
| `events` | Raw inbound: text, media URLs, detected links, timestamp, processed flag |
| `places` | The vault: name, city, category, the creator's note, source videos, mention count, visited flag |
| `garments` | Wardrobe: item, colour, pattern, vibe, times worn |
| `profiles` | Birth data and the computed natal chart |
| `chats` | Conversation history |
| `memories` | Durable user facts, stable semantic key, embedding, confidence, status and provenance |
| `followups` | Conservative future-event candidates; scheduled only, not yet sent proactively |

## How the vault fills up

Someone shares a TikTok to Pinch's number. The link is detected in the message text, the
public metadata is fetched, the caption and cover frame go to the vision model, and every
named venue comes back structured with a city and a note in the creator's own framing.

Photos work the same way but with the actual bytes rather than a cover frame, signage,
menus and receipts get read directly. Screenshots get transcribed, and any links found
inside them get ingested too.

**Repeat mentions merge and increment a count.** Three different videos naming the same
restaurant become one entry with a mention count of 3. That count is what powers
"everyone sends you to Haring's", it's signal, not noise.

## Retrieval

Two modes, and most products only build the second:

- **Always-on context.** The wardrobe goes directly into the prompt (small, and relevant
  to any "what should I wear"), along with a count of saved places. This is what makes
  Pinch sound like it already knows you.
- **On-demand lookup.** The saved-places list grows unbounded, so it sits behind the
  `search_vault` tool and is fetched only when a recommendation is actually needed.

Memory retrieval passes the user's actual message to two independent searches: a
512-dimensional `text-embedding-3-small` vector lookup and a Convex full-text lookup.
Reciprocal-rank fusion merges them so fuzzy meaning and exact names both work. The newest
eight records are also scored directly against the query embedding. This closes the brief
index-propagation gap immediately after a write without ever injecting unranked "recent"
facts.

The measured similarity threshold is 0.26. In a small calibration, coffee/drink scored
0.333, work/job 0.281, while unrelated coffee/horoscope and coffee/ex queries scored
0.116 and 0.063. The threshold is deliberately above the irrelevant pairs and below the
weakest relevant pair. Revisit it with a larger labelled corpus, not by feel.

## What becomes a memory

GPT-5.6 Luna reads only the latest **user** message and emits at most four structured
operations. The assistant reply is deliberately absent: a model claim can never become a
self-reinforcing fact. Greetings, questions, transient moods and guesses produce nothing.
Birth data, the chart, places and garments stay in their purpose-built tables.

Credentials, account/government identifiers, exact addresses, medical conditions,
sexuality/gender identity, religion and politics are excluded in the extraction prompt.
A deterministic post-filter also blocks common secret, payment, ID, street-address,
diagnosis and sensitive-identity patterns even if the model ignores that instruction.

Every fact gets a stable key such as `preference:coffee` or `plan:sister_wedding`.
Repeating the same content deduplicates. Correcting the key inserts a new active record and
marks the old one `superseded`; forgetting marks it `deleted`. Nothing is hard-deleted by
the conversational path, so the audit trail survives. New records point to the raw inbound
event. The one-time Mem0 import has no historical event, so it preserves the old provider
record ID instead.

On 2026-08-13 the production migration inspected 645 Mem0 memories across 87 user
entities. The new durability/privacy filter imported 51 records and rejected 594 as test
chatter, assistant-authored language, chart/birth data, expired context or otherwise
unsuitable. One imported correction superseded its older same-key row, leaving 50 active;
all 51 retained legacy provenance and a deterministic safety audit found zero forbidden
patterns.

## Memory should be felt, not displayed

**2026-07-30, Nandini's call and it reframed the feature.** Weaving a remembered fact into
a later reply reads as a system showing off its context window. Mention someone's manager
once and having it appear in four consecutive answers is not memory, it is failure to
listen.

The better use is proactive follow-up. Someone says they have a date Friday; Pinch asks
"how was the date" on Saturday morning. Being asked is what being known feels like.

`lib/followups.ts` detects future events with a real date and schedules the ask. Delay is
tuned per category: a date or party gets ~14 hours (next morning), an interview 20 (once
they have stopped replaying it), travel 24, medical 4.

Detection is deliberately conservative, because a false positive becomes an unprompted
text about something that never happened. Verified to correctly ignore "i hate my job"
(ongoing state), "i should really call my mum" (no date), and "gym tomorrow" (routine
nobody wants asked about).

Detection does **not** authorize sending. Proactive delivery remains off until Pinch has
an explicit opt-in, immediate STOP/UNSUBSCRIBE/OPTOUT/CANCEL/END/QUIT handling, timezone
awareness and a chat-health gate. The pilot rule is at most one unanswered follow-up after
an inbound conversation, no sooner than the next day, then silence. Linq's operational
target is roughly one inbound message for every two outbound messages; this is a health
signal, not permission to cold-text.

Two rules that came out of getting this wrong first:

- **The chart gives the read, memory makes it specific.** "get the dress, you'll want to
  feel good walking into Leila's wedding" is right. "greg's a nightmare, quit" is a friend
  agreeing with you, not an astrologer.
- **A fact is spent once used.** `checkRepetition` in `voiceCheck.ts` flags a proper noun
  the assistant already raised in the last three turns.

## Identity resolution

The hard problem in multi-source memory. Instagram says "sam", the calendar says
"Samantha Chen", a text says "sammy", unless those collapse into one person you have
three disconnected piles, not memory.

Current approach is deliberately conservative: exact match on a normalized name within a
user. **Wrongly-split is easy to fix later; wrongly-merged silently corrupts and you never
find out.** So "Oyster Club" and "The Oyster Club" stay separate for now.

## Deletion and provenance

Every entity links back to the events it came from. This is not decoration, it's what
makes it possible to explain why Pinch believes something, correct one fact without
nuking everything, and honour a deletion request. Ingesting someone's photos and location
is a different consent posture than a horoscope bot, and provenance is the thing that has
to exist before any of that is defensible.
