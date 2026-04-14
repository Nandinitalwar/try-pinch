"""Codifies Pinch's behavioral rules from the system prompt at
packages/api/lib/agents/agents/generalTaskAgent.ts:264.

Each rule is a small, inspectable object — not a regex blob — so a reviewer
can see exactly what the eval is checking. When the system prompt changes,
update this file *and* check the live eval's pass rate didn't regress.
"""
from __future__ import annotations

from dataclasses import dataclass


# Copied verbatim from the system prompt's "## Banned Corporate Therapy Language"
# section. Matching is case-insensitive and substring-based (not whole-word),
# because the model might conjugate or embed these mid-sentence.
BANNED_PHRASES: list[str] = [
    "show up as your best self",
    "be present",
    "be fully present",
    "take a beat",
    "lean into",
    "hold space",
    "honor your needs",
    "being strategic",
    "what truly makes you feel good",
    "get your ducks in a row",
    "tune into what your heart",
    "listen to what your body",
    "listen to what your heart",
    "give yourself permission to",
    "sit with your feelings",
]

# The prompt bans bullet points and lists entirely:
#   "NEVER use bullet points or lists. Write in flowing sentences."
LIST_MARKERS: tuple[str, ...] = ("•", "- ", "* ", "1. ", "2. ", "3. ")

# Length ceiling:
#   "MAXIMUM 2-3 sentences for simple questions. If you're writing more than
#    4 sentences total, you're writing too much."
MAX_SENTENCES = 4

# Name-usage rule (CRITICAL section):
#   "Only use their name [...] maybe 1 in 20 messages."
# We enforce a hard ceiling: at most one mention per response.
MAX_NAME_MENTIONS = 1

# Planet-name jargon ban (the prompt says "No mentions of 'Venus in Pisces'").
PLANET_NAMES: tuple[str, ...] = (
    "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
    "uranus", "neptune", "pluto",
)
ZODIAC_SIGNS: tuple[str, ...] = (
    "aries", "taurus", "gemini", "cancer", "leo", "virgo",
    "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
)


@dataclass
class Violation:
    rule: str
    detail: str

    def __str__(self) -> str:
        return f"[{self.rule}] {self.detail}"
