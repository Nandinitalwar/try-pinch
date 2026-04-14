"""Runs cases through a model, lints the replies, returns a report.

Phase 2 of the eval: the linter catches mechanical violations (banned
phrases, lists, length, name overuse, jargon). Behavioral expectations
from cases.py (flip-flop holding, "one dish not many", etc.) aren't
enforced automatically yet — they're recorded in the report so a human
reviewer can spot-check. A future iteration can add LLM-as-judge for
those semantic checks.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

from .cases import CASES, Case
from .linter import lint
from .model import ModelReply, call_gemini
from .prompt import PINCH_SYSTEM_PROMPT
from .rules import Violation


@dataclass
class CaseResult:
    case_id: str
    user_message: str
    reply: str
    violations: list[Violation]
    model: str
    latency_ms: int

    @property
    def passed_lint(self) -> bool:
        return not self.violations


def run_case(case: Case, model: str = "gemini-2.5-flash") -> CaseResult:
    r: ModelReply = call_gemini(
        system_prompt=PINCH_SYSTEM_PROMPT,
        user_message=case.user_message,
        model=model,
    )
    violations = lint(r.text, user_name=case.name)
    return CaseResult(
        case_id=case.id,
        user_message=case.user_message,
        reply=r.text,
        violations=violations,
        model=r.model,
        latency_ms=r.latency_ms,
    )


def run_all(model: str = "gemini-2.5-flash") -> list[CaseResult]:
    return [run_case(c, model=model) for c in CASES]


def format_report(results: list[CaseResult]) -> str:
    """Produce a markdown report suitable for committing to results/."""
    passed = sum(1 for r in results if r.passed_lint)
    total = len(results)
    pct = (100 * passed / total) if total else 0.0
    model = results[0].model if results else "—"

    lines: list[str] = [
        f"# Pinch behavioral eval — {model}",
        "",
        f"**Pass rate (lint layer only):** {passed} / {total} ({pct:.0f}%)",
        "",
        "| Case | Lint | Violations | Latency | Reply |",
        "|---|---|---|---|---|",
    ]
    for r in results:
        mark = "✅" if r.passed_lint else "❌"
        vtext = "—" if not r.violations else "; ".join(str(v) for v in r.violations)
        reply_clipped = r.reply.replace("\n", " ").strip()
        if len(reply_clipped) > 140:
            reply_clipped = reply_clipped[:137] + "…"
        lines.append(
            f"| `{r.case_id}` | {mark} | {vtext} | {r.latency_ms} ms | {reply_clipped} |"
        )
    return "\n".join(lines) + "\n"
