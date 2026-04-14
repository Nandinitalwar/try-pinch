# pinch-evals

Behavioral evaluation suite for Pinch's system prompt. Catches regressions when the prompt is edited and compares behavior across model snapshots.

## Why

Pinch's system prompt (in [`packages/api/lib/agents/agents/generalTaskAgent.ts`](../api/lib/agents/agents/generalTaskAgent.ts)) is opinionated: banned phrases, length ceilings, "one recommendation not a menu," no planet-name jargon, hold-your-ground on indecisive follow-ups. Without evals, any prompt tweak is a blind deploy — and any new model snapshot silently re-shapes Pinch's voice.

This package codifies those rules so prompt changes and model upgrades become measurable.

## Two layers

**Layer 1 — static response linter.** Pure-Python rules (banned phrases, bullet/list detection, sentence count, name overuse, astro jargon). No API calls. Runs in CI as regular pytest.

```
pip install -r requirements.txt
pytest -v
```

**Layer 2 — live model harness.** Runs canned user messages through a model with Pinch's system prompt, feeds the reply into Layer 1's linter, writes a markdown report.

```
export GOOGLE_AI_API_KEY=...
pip install google-generativeai
python scripts/run_eval.py --model gemini-2.5-flash
python scripts/run_eval.py --model gemini-2.5-pro --out results/pro.md
```

Output lands in [`results/`](results/).

## What's checked

| Rule | Source in system prompt | Detected how |
|---|---|---|
| Banned corporate-therapy phrases | "Banned Corporate Therapy Language" section | substring match (case-insensitive) |
| No bullet/numbered lists | "NEVER use bullet points or lists" | line-start marker scan |
| ≤ 4 sentences total | "If you're writing more than 4 sentences total, you're writing too much" | sentence terminator count |
| Name used at most once | "Only use their name [...] maybe 1 in 20 messages" | whole-word occurrence count |
| No planet or sign names | "Personality-first, never planet-first" | whole-word scan |

## Adding a case

1. Append a `Case(...)` in [`evals/cases.py`](evals/cases.py) with a stable `id`, the user message, and any expected good/bad behaviors.
2. Run `python scripts/run_eval.py` to see the new case's result.
3. If the case is failing in a way that *isn't* caught by the linter, add a new rule in [`evals/rules.py`](evals/rules.py) and a matching test in [`tests/test_linter.py`](tests/test_linter.py) first, then re-run.

## Layout

```
evals/
  rules.py     banned phrases, list markers, length/name ceilings
  linter.py    takes response → list[Violation]
  cases.py     canned user messages with expected behaviors
  prompt.py    eval-frozen copy of Pinch's system prompt
  model.py     thin Gemini wrapper
  runner.py    runs a case, lints the reply, formats markdown report
tests/
  test_linter.py   verifies the linter's precision and recall
scripts/
  run_eval.py  CLI: run all cases → results/<model>.md
results/       committed per-model reports for regression tracking
```

## Next

- **LLM-as-judge** for the semantic `expected_good_behaviors` / `expected_bad_behaviors` in `cases.py` (currently recorded only, not enforced).
- **Claude + multi-model runs** via the Anthropic SDK so the report compares Gemini and Claude on the same prompt, matching the JD's "model-specific prompt guide" deliverable.
- **Prompt regression CI**: pre/post lint pass-rate check on every commit that touches the TS system prompt.
- **Adversarial cases**: prompt-injection payloads embedded in simulated Exa search results, asserting Pinch stays on-character. Ties to [`../sandbox`](../sandbox).
