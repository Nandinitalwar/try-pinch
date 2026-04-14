"""CLI entry point for the live eval.

Usage:
    GOOGLE_AI_API_KEY=... python scripts/run_eval.py
    GOOGLE_AI_API_KEY=... python scripts/run_eval.py --model gemini-2.5-pro
    GOOGLE_AI_API_KEY=... python scripts/run_eval.py --out results/pro.md

Writes a markdown report to --out (defaults to results/<model>.md) and
prints a one-line summary to stdout.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Let the script run from anywhere inside the package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from evals.runner import format_report, run_all  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--model", default="gemini-2.5-flash")
    p.add_argument("--out", default=None)
    args = p.parse_args()

    out_path = Path(args.out) if args.out else (
        Path(__file__).resolve().parent.parent / "results" / f"{args.model}.md"
    )

    results = run_all(model=args.model)
    report = format_report(results)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(report)

    passed = sum(1 for r in results if r.passed_lint)
    print(f"{passed}/{len(results)} passed lint → {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
