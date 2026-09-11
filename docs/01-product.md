# Product

## What Pinch is

An AI astrologer you text. Not a horoscope app, a friend who happens to be a real
astrologer, who knows your chart cold and translates it into blunt, personal advice.

Reached over iMessage and WhatsApp. There is no app to open.

## The direction

The product started as a conversational astrologer. As of 2026-07-25 it's aiming at
something sharper, prompted by a tool called Hermes (seen via a Charlie Kerr post):

> You send it TikToks and Reels. It watches them, stores them in a vault, and later you
> text it and get back a synthesized list, "everyone sends you to Haring's; Port of Call
> for downstairs bites; Oyster Club is the dinner hero."

The complaint Hermes solves is real: people save hundreds of TikToks and can never
retrieve any of it. Saved videos are the densest "things I want to do" signal a person
produces, far better than inferring taste from passive message reading.

**Pinch's version of this is the same vault plus a ranking function nobody else has.**

| Layer | Hermes | Pinch |
|---|---|---|
| Vault of saved places | yes | yes |
| Retrieval by city or date | yes | yes |
| Knows who you are | generic | natal chart + conversation history |
| Ranking | popularity / recency | transits against their actual chart |

The target sentence:

> "You saved six places in Mystic. Go to Oyster Club Thursday, you'll want to be seen
> that night. Skip Port of Call, it's a low-key one."

That needs the vault *and* real transit computation. Neither works alone.

## Audience

English-speaking, astrology-literate-but-not-expert. They know their sun sign and probably
their rising. They do not want to be taught chart mechanics, see [04-voice.md](04-voice.md).

**English only.** Pinch must never code-switch into another language based on a user's
birth country or name. This is a product decision, not a bug.

## Onboarding and activation

Onboarding starts on the first request for personal direction, not on a greeting. “What
should I do today?”, “Should I go out tonight?”, and a direct horoscope request all count.
Pinch asks in one short text what to call the person and for their birth date, exact birth
time, and birth city. Answers can arrive together or across several messages; Pinch asks
only for fields still missing.

Pinch is activated when a named user receives their computed chart plus the first useful,
personal reading. Collecting fields is not activation, and sending a generic horoscope is
not activation. Before that moment Pinch must not improvise personal astrological advice.
The first reading is the proof of value: it answers the exact question that brought them
in using computed chart timing. If they sent a photo, the response reacts to something
actually visible and reads the relevant period; it never swaps in a generic personality
summary.

## What it is not

- Not a mystical guru. The banned-language list is long and enforced.
- Not a horoscope column. Generic sun-sign advice is a failure state.
- Not a general assistant that happens to do astrology, but it does help with everything
  (food, plans, jobs, relationships). It never refuses because something "isn't astrology".
