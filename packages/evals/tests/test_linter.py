"""Verifies the linter catches the failure modes it's meant to catch
and clears responses that follow the style guide. Each test includes a
hand-crafted bad example and a matched good example so the linter's
precision and recall are both exercised."""
from __future__ import annotations

from evals.linter import lint, passes


# --- Banned corporate-therapy phrases ---------------------------------------
def test_flags_banned_phrase_lean_into():
    v = lint("Just lean into the restlessness tonight.")
    assert any(x.rule == "banned_phrase" for x in v)


def test_flags_banned_phrase_best_self():
    v = lint("Take the day so you can show up as your best self tomorrow.")
    assert any(x.rule == "banned_phrase" for x in v)


def test_clears_paraphrased_good_response():
    assert passes("Take the day. You'll be sharper tomorrow.")


# --- List / bullet formatting ------------------------------------------------
def test_flags_bullet_list():
    v = lint("Options:\n- rest\n- work\n- nap")
    assert any(x.rule == "list_format" for x in v)


def test_flags_numbered_list():
    v = lint("Try this:\n1. sleep\n2. eat\n3. repeat")
    assert any(x.rule == "list_format" for x in v)


def test_allows_em_dash_in_prose():
    # "— like this —" is prose, not a list. Must not trip list_format.
    v = lint("Take the day — you'll be sharper tomorrow.")
    assert not any(x.rule == "list_format" for x in v)


# --- Length ------------------------------------------------------------------
def test_flags_over_four_sentences():
    r = "A. B. C. D. E. F."
    v = lint(r)
    assert any(x.rule == "too_long" for x in v)


def test_allows_three_sentences():
    assert passes("Take the day. You're scattered. Rest.")


# --- Name overuse ------------------------------------------------------------
def test_flags_name_used_twice():
    v = lint("Nandini, take the day. Nandini, you need it.", user_name="Nandini")
    assert any(x.rule == "name_overuse" for x in v)


def test_allows_single_name_use():
    v = lint("Nandini, take the day. You need it.", user_name="Nandini")
    assert not any(x.rule == "name_overuse" for x in v)


# --- Astro jargon ------------------------------------------------------------
def test_flags_planet_name():
    v = lint("Mercury retrograde is messing with you this week.")
    assert any(x.rule == "astro_jargon" for x in v)


def test_flags_sign_name():
    v = lint("Typical Scorpio behavior — just rest.")
    assert any(x.rule == "astro_jargon" for x in v)


def test_allows_personality_translation():
    # Same meaning, no jargon — this is what the prompt WANTS.
    assert passes("Your head's gonna be all over the place this week. Just rest.")


# --- Multiple violations stack ----------------------------------------------
def test_collects_all_violations():
    bad = (
        "Nandini, lean into what your heart asks for.\n"
        "- rest\n- reflect\n- be present."
    )
    v = lint(bad, user_name="Nandini")
    rules = {x.rule for x in v}
    # At minimum: banned_phrase (lean into / be present), list_format.
    assert "banned_phrase" in rules
    assert "list_format" in rules
