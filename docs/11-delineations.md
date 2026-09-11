# Delineations

A delineation is what a transit **means** for a person. Not the geometry, which the
ephemeris already computes, but the lived read.

## The gap this fills

`computeTransits()` returns accurate aspects with exact dates. What it can't tell you is
what Saturn square Venus actually does to someone's week. That currently comes from the
model improvising per message, which is why the same aspect produces different advice on
different runs, and why replies drift toward generic self-help.

Fixing it is the same move as computing transits instead of searching for them: replace
improvisation with a reference the system consults.

## Why scraping doesn't work

Investigated 2026-07-30 and settled empirically rather than by argument. Downloaded a
public domain astrology text from Project Gutenberg and measured it:

| Check | Result |
|---|---|
| Per-combination delineations ("Saturn square Venus means…") | **0 matches** |
| "afflict" | 54 |
| "evil" | 50 |
| "malefic" | 43 |
| "death" | 22 |

Two independent problems:

**No delineations exist in the public domain.** These are method books. They teach how to
cast a chart and what an aspect is. The 720-combination interpretation table doesn't exist
in freely usable form, which is exactly why Robert Hand's *Planets in Transit* is still the
standard and still sells. That book is copyrighted and not trainable or copyable.

**The register is Victorian fatalism.** A representative passage predicts "prolonged
ill-health, and most frequently some permanent hurt to the body." Pinch's rules say
challenges always get an end date and never doom. Scraping teaches the opposite.

More broadly: **published astrology writing is written in the voice Pinch is defined
against.** "Celestial", "cosmic energy", "the universe has plans" are exactly what
horoscope columns are made of. Scraping produces more of what the voice rules ban.

## So the table is written, not scraped

`scripts/generate-delineations.ts` generates one entry per (transiting planet, aspect,
natal point), ranked by the same weights the transit ranker uses so the combinations that
actually surface get written first.

Each entry is three short fields, **deliberately not prose**:

- `feels` — what the person catches themselves doing
- `do` — a specific action they could take this week
- `avoid` — the trap, described as a behaviour they'd recognise

Prose would get recited to the user. Fields get used and rewritten in Pinch's voice.

## The generator needed the same treatment as the agent

First pass produced "no longer serves you" twice (banned) and made all five Pluto/Sun
aspects say the same thing. The model's pull toward astro-self-help is as strong here as
anywhere.

Fixed by running every candidate through `checkVoice` and regenerating on violations, up
to three attempts. Same machinery as the live reply path, and there was no reason to trust
the generator when we don't trust the agent.

Also added to the generator prompt: a worked bad/good example pair, and an explicit
instruction that the square and trine of the same pair must read as genuinely different
situations. Abstractions about identity and growth make every transit sound identical.

## Current state, 2026-07-30

60 generated, covering Pluto / Neptune / Uranus / Saturn against Sun / Moon / Ascendant.
Stored in `packages/api/delineations.json`.

| Measure | Result |
|---|---|
| Vague action fields | 0 of 60 |
| Near-duplicates within a planet pair | 1 |
| Banned phrases | none |

Known flaw: "You find yourself" opens 19 of 60. Repetitive, but these are internal notes
the agent rewrites, so it costs far less here than in output.

**Not yet covered:** Jupiter and Mars as transiting planets, and Venus, Mars, Mercury as
natal points. That's the remaining 120 of the 180-combination space. Stopped at 60
deliberately, so that if the read is wrong we've lost an hour rather than a project.

## Not yet wired in

The table is generated and under review. It is **not** yet consulted by the agent. Wiring
it means having `formatTransitsForAgent` look up the matching entry and hand the agent the
three fields instead of the generic per-point meaning it uses today.

Awaiting a keep/cut pass in the review tool:
https://claude.ai/code/artifact/49f2faf8-e1f4-42ec-927c-08217e5ef428

## Why this is worth the effort

It's the most defensible thing in the product. A delineation table written in Pinch's voice
is something no competitor has, can't be scraped, and makes the astrology consulted rather
than generated. Same argument as the vault: what you own beats what you look up.
