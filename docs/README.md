# Pinch Wiki

Working memory for the Pinch project. Read this before starting work; update it when
decisions change.

**Any agent picking up this repo: read `05-decisions.md` and `06-open-issues.md` first.**
Most wasted effort here comes from re-litigating a settled decision or re-discovering a
known bug.

## Pages

| File | What's in it |
|---|---|
| [01-product.md](01-product.md) | What Pinch is, who it's for, the product direction |
| [02-architecture.md](02-architecture.md) | How the system fits together, file by file |
| [03-memory-and-vault.md](03-memory-and-vault.md) | The memory layer: events, vault, wardrobe, retrieval |
| [04-voice.md](04-voice.md) | Voice rules and why they're enforced in code, not prompt |
| [05-decisions.md](05-decisions.md) | Decision log with rationale and revisit triggers |
| [06-open-issues.md](06-open-issues.md) | Known problems, including one needing a call |
| [07-roadmap.md](07-roadmap.md) | What's next, in order |
| [08-testing.md](08-testing.md) | How to test locally |
| [09-integrations.md](09-integrations.md) | Channels and data sources, incl. what isn't reachable |
| [10-fine-tuning.md](10-fine-tuning.md) | Dataset capture, quality, GPU compute, what tuning is actually for |
| [11-delineations.md](11-delineations.md) | Pinch's own transit interpretation table, and why scraping failed |

## Keeping this current

**Update the wiki as part of the work, not when asked.** After anything that changes how
the project behaves, write it down before moving on:

- A decision with a rationale → [05-decisions.md](05-decisions.md), with a revisit trigger
- A bug found or fixed → [06-open-issues.md](06-open-issues.md)
- Something learned the hard way → the relevant page, stated as the lesson

The test: if the next session would waste an hour rediscovering it, it belongs here.

## Conventions

- **Prose and tables, not code.** Nandini reads these; she does not read code snippets.
  Describe what something does and why, not how it's written.
- **Absolute dates**, never "last week".
- **Record the why.** A decision without its rationale gets reversed by the next person.
- When a decision is reversed, edit it in place and note what changed, don't leave two
  contradictory entries.

Last updated: 2026-08-09
