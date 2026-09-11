# First Prompt

A prototype for the logged-out ChatGPT landing page. Two experiments in one
runnable app, with an A/B switch so you can flip between them mid-demo.

```bash
npm run dev -w pinch-prototype   # http://localhost:3006
npm run check -w pinch-prototype # context-engine smoke check
```

No API key, model call, external lookup, or account. The answers are canned so
the demo is byte-identical for every reviewer and works on a plane. On Vercel,
the request may contribute a coarse edge-derived city; localhost falls back to
the browser timezone and the dev controls.

---

## The problem

The logged-out page ends in a blank box. "Ask anything" is the widest possible
invitation, and a wide invitation is a hard question: the visitor has to invent
a use case, phrase it well enough to get a good answer, and risk the answer
being mediocre — all before they've seen the product do anything.

The current mitigation is a row of category chips under the composer. A chip
like **Create image** narrows the space, but it still hands you a category and
asks you to write the sentence. The work didn't move.

## The bet

**Replace the blank box with a first prompt that already knows something about
right now.**

The ChatGPT mark becomes the onboarding rather than decoration. It rotates slowly above the
composer while a complete suggestion types into the placeholder, pauses,
erases, and advances to the next one. The same five concrete jobs rotate in a
context-aware order based on the visitor's local time, day, and device:

| Context | What types into the composer |
| --- | --- |
| Morning | *Rewrite this email so it sounds confident* |
| Midday | *Summarize this article into five bullets* |
| Evening/weekend | *Plan my weekend around a $100 budget* |
| Any time | *Explain this like I'm smart but new to it* |
| Any time | *Help me decide between these two options* |

Only one suggestion is visible at a time. This preserves the calm shape of the
logged-out page while making concrete uses repeatedly demonstrate themselves.
The user can still type immediately, or click *Use this suggestion* to send the
currently active prompt.

### Why this and not more chips

A chip is a category. A prompt is a sentence you'd actually send. The gap
between those two is the entire funnel step we're losing.

## What's in the box

- **`/` — Kinetic prompt (arm B).** Slowly rotating ChatGPT mark, context-aware headline, and a
  living composer placeholder that types, pauses, erases, and advances. The
  current suggestion is one click from a first message.
- **`/?v=control` — Control (arm A).** Today's shape: wordmark, composer, static
  category chips. Clicking a chip prefills a category and leaves you to write
  the rest — an honest baseline, not a strawman.
- **Share cards (experiment B).** Every answer gets *Share this answer*, which
  renders the question plus three distilled beats as a card with a link back.
  A screenshot shares a UI; a card shares an idea.
- **Dev panel** (gear, bottom right). Flip arm, theme, and device; scrub the
  clock and timezone to reach any of the fourteen contexts without waiting until
  Friday night; watch the analytics events fire live.

## How the context is derived

Context comes from `Date`, the browser's IANA timezone, the viewport, and an
optional coarse city derived by the hosting edge from the incoming request.

- **No geolocation prompt.** A permission dialog on the logged-out landing page
  would cost more sessions than the personalization wins.
- **No raw IP or coordinates in the client.** `/api/context` exposes only the
  coarse city/region/country fields already derived at the Vercel edge. The
  response is private and uncached, and the prototype stores none of it.
- **Localhost fallback.** A loopback address has no useful geography, so the
  browser timezone supplies the demo city. The dev panel can force another
  timezone to review every location variant.
- **Fourteen buckets** — weekday/weekend × seven time-of-day bands. Friday
  evening routes to the weekend set, because it is one.
- `lib/context.ts` is pure with an injected clock, which is what lets the dev
  panel and `npm run check` reach every branch.

## Measuring it

Events fire from `lib/track.ts` and are visible in the dev panel:

| Event | Why |
| --- | --- |
| `onboarding_viewed` | denominator, split by arm + context bucket |
| `carousel_started` | did the kinetic treatment start before they left |
| `prompt_clicked` | which rotating suggestion was accepted |
| `composer_focused` | they ignored the prompts and typed anyway — still a win |
| **`first_message_sent`** | **primary metric**, carries `ms_to_first_message` |
| `answer_completed` | did they stay for the answer or bounce mid-stream |
| `share_opened` / `share_copied` | experiment B's loop |
| `signup_clicked` | the money event |

**Primary:** logged-out sessions that send a first message. **Secondary:**
time-to-first-message, answer completion, signup rate.

**Guardrails worth watching before this ships anywhere:**

- *Prompt gravity.* If everyone clicks the same prompt, we've narrowed the
  product rather than opened it. Watch the spread across the five jobs,
  and the share of sessions that type something original anyway.
- *Context overreach.* The page changes order and plan wording from time/device
  context, but does not force a city-based suggestion where it would feel awkward.
- *Second-message rate.* A great first answer that ends the session is a worse
  outcome than a mediocre one that starts a conversation.

## What's fake

Worth being blunt, since it changes what this can prove:

- Answers are canned (`lib/responses.ts`). Swap `getAnswer` for a streaming
  endpoint and no component changes — they consume a string and a done flag.
- The prompt catalog is hand-written (`lib/prompts.ts`). A real version would
  generate and rank these, which is where most of the remaining upside is.
- Share links go nowhere; sign-up is a toast.
- The ChatGPT shell is rebuilt from the outside for demo fidelity, with a
  placeholder mark rather than the real logo. It is a prototype, not a fork.
