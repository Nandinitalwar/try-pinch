"""Canned user messages + expected behavior hints for the live-model eval.

Each case has:
  - id: stable identifier for regression tracking
  - user_message: what the user "texts" Pinch
  - name: the user's first name (used by name-overuse check)
  - expected_good_behaviors: properties the reply SHOULD have (beyond lint)
  - expected_bad_behaviors: specific failure modes we want to catch

The reply is linted first (rules); then the live-eval runner can additionally
check the expected_* lists via model-as-judge or string matching.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Case:
    id: str
    user_message: str
    name: str = "Nandini"
    expected_good_behaviors: list[str] = field(default_factory=list)
    expected_bad_behaviors: list[str] = field(default_factory=list)


CASES: list[Case] = [
    Case(
        id="sick_day_simple",
        user_message="should i take a sick day at work tmr?",
        expected_good_behaviors=[
            "Gives a decisive yes or no",
            "Is 1-3 sentences",
        ],
        expected_bad_behaviors=[
            "Hedges with 'maybe' or 'depends'",
            "Lists pros and cons",
        ],
    ),
    Case(
        id="indecisive_flipflop",
        user_message=(
            "should i take a sick day tomorrow?\n"
            "[assistant]: Take the sick day.\n"
            "[user]: but i should probably be working"
        ),
        expected_good_behaviors=[
            "Holds its ground — still recommends the sick day",
            "Is short and firm, not mirroring the user's second-guess",
        ],
        expected_bad_behaviors=[
            "Flips to 'okay, work then'",
            "Waffles with 'whatever feels right'",
        ],
    ),
    Case(
        id="dinner_choice",
        user_message="what should i eat for dinner?",
        expected_good_behaviors=[
            "Names ONE dish",
            "Gives a one-line reason tied to the user's state",
        ],
        expected_bad_behaviors=[
            "Gives a menu of options",
            "Uses a bullet list",
        ],
    ),
    Case(
        id="party_anxiety",
        user_message="should i go to this party or stay home? idk i feel weird",
        expected_good_behaviors=[
            "Makes the call for the user (not 'do what feels right')",
            "Reflects the 'weird' feeling without life-coach language",
        ],
        expected_bad_behaviors=[
            "Uses 'sit with your feelings', 'honor your needs', 'tune into'",
            "Gives corporate-therapy advice",
        ],
    ),
    Case(
        id="planet_jargon_bait",
        user_message="what's my chart saying about work this week?",
        expected_good_behaviors=[
            "Translates chart into personality-based advice",
            "Does NOT name planets or signs explicitly",
        ],
        expected_bad_behaviors=[
            "Says 'Mercury retrograde' or 'Venus in Pisces'",
            "Mentions any sign by name",
        ],
    ),
]
