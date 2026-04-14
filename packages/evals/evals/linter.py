"""Static response linter. Takes a candidate response and the name of the
recipient, returns a list of Violations. A response with zero violations
passes the lint layer; live-model evals then chain model-quality checks
(tone, relevance) on top."""
from __future__ import annotations

import re

from .rules import (
    BANNED_PHRASES,
    LIST_MARKERS,
    MAX_NAME_MENTIONS,
    MAX_SENTENCES,
    PLANET_NAMES,
    ZODIAC_SIGNS,
    Violation,
)

# Sentence splitter — intentionally permissive. We count ., !, ? as terminators
# and ignore trailing whitespace. Good enough for short text-message style replies.
_SENTENCE_END = re.compile(r"[.!?]+(?=\s|$)")


def _count_sentences(text: str) -> int:
    stripped = text.strip()
    if not stripped:
        return 0
    return len(_SENTENCE_END.findall(stripped)) or 1


def _contains_word(text: str, word: str) -> bool:
    """Whole-word, case-insensitive match."""
    return re.search(rf"\b{re.escape(word)}\b", text, re.IGNORECASE) is not None


def lint(response: str, user_name: str | None = None) -> list[Violation]:
    """Return all behavioral rule violations in `response`.

    `user_name` enables the name-overuse check. Pass None to skip it.
    """
    violations: list[Violation] = []
    low = response.lower()

    # 1. Banned corporate-therapy phrases.
    for phrase in BANNED_PHRASES:
        if phrase in low:
            violations.append(Violation("banned_phrase", f"contains '{phrase}'"))

    # 2. No bullet points or lists.
    for marker in LIST_MARKERS:
        # Only flag markers at line starts — avoids false positives on dashes
        # inside prose ("— like this —").
        for line in response.splitlines():
            if line.lstrip().startswith(marker):
                violations.append(
                    Violation("list_format", f"line starts with list marker '{marker.strip()}'")
                )
                break

    # 3. Sentence-count ceiling.
    n = _count_sentences(response)
    if n > MAX_SENTENCES:
        violations.append(
            Violation("too_long", f"{n} sentences (max {MAX_SENTENCES})")
        )

    # 4. Name overuse.
    if user_name:
        count = len(re.findall(rf"\b{re.escape(user_name)}\b", response, re.IGNORECASE))
        if count > MAX_NAME_MENTIONS:
            violations.append(
                Violation("name_overuse", f"used '{user_name}' {count} times (max {MAX_NAME_MENTIONS})")
            )

    # 5. Explicit astrology jargon — planet names and zodiac signs in output.
    # The system prompt says "Personality-first, never planet-first".
    for planet in PLANET_NAMES:
        if _contains_word(response, planet):
            # "Sun" is a common English word, but in Pinch's context we treat
            # any capitalized/planetary mention as a jargon smell. Keep this
            # as a LOW-confidence violation tagged separately from the others.
            violations.append(
                Violation("astro_jargon", f"mentions planet '{planet}'")
            )
            break  # one jargon violation per response is enough signal
    else:
        for sign in ZODIAC_SIGNS:
            if _contains_word(response, sign):
                violations.append(
                    Violation("astro_jargon", f"mentions sign '{sign}'")
                )
                break

    return violations


def passes(response: str, user_name: str | None = None) -> bool:
    return not lint(response, user_name)
