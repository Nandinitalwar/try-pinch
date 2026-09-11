import type { Context } from './context';

export interface Answer {
  /** Light markdown: ### heading, **bold**, "- " bullets, blank-line paragraphs. */
  body: string;
  /** Headline for the share card — the one line worth screenshotting. */
  shareTitle: string;
  /** Three distilled beats for the card. */
  sharePoints: string[];
}

/**
 * Canned answers. This prototype deliberately ships no model call: it runs on a
 * laptop with no key, in an interview room with no wifi, and every reviewer sees
 * byte-identical output. Swap `getAnswer` for a streaming endpoint and the rest
 * of the UI is unchanged — the components only consume a string and a done flag.
 */
const ANSWERS: Record<string, (ctx: Context) => Answer> = {
  'wd-e-dinner': () => ({
    body: `Three options, ranked by how much you feel like standing up.

### If you have 20 minutes
**Crispy gnocchi with butter beans.** Pan-fry shelf-stable gnocchi dry in olive oil until they blister — no boiling. Add a tin of butter beans, a handful of spinach, lemon zest, too much parmesan.

### If you have 35 minutes
**Chicken thighs with lemon and olives.** Skin-side down in a cold pan, medium heat, 12 minutes without touching them. Flip, add olives and half a lemon sliced thin, finish in the oven.

### If you have a fork
**Beans on toast, but seriously.** Good bread, olive oil, a tin of white beans warmed with garlic and chili, a fried egg. Nine minutes, one pan.

Want me to write it as a grocery list instead?`,
    shareTitle: 'Dinner, ranked by how much you feel like standing up',
    sharePoints: [
      '20 min — crispy gnocchi, no boiling water',
      '35 min — chicken thighs, cold pan, do not touch',
      '9 min — beans on toast, but seriously',
    ],
  }),

  'we-a-fun': (ctx) => ({
    body: `Three hours is enough for one real thing plus a snack. Here's the shape of a good afternoon in ${ctx.city}:

- **Go where the light is.** Pick the water, a hill, or a park — whatever's closest. Twenty minutes of walking resets the day more reliably than anything you'd pay for.
- **One indoor anchor.** A small museum, a record shop, a bookstore with chairs. Something with a door, in case the weather turns.
- **End at a table.** Coffee or a drink somewhere you have to wait a little. The waiting is the point.

If you tell me your neighborhood I'll turn this into an actual route with names and walking times.`,
    shareTitle: 'How to spend three good hours',
    sharePoints: [
      'Go where the light is — 20 minutes of walking',
      'One indoor anchor, in case the weather turns',
      'End at a table where you have to wait a little',
    ],
  }),

  'wd-ln-awake': () => ({
    body: `In 1518, in Strasbourg, a woman stepped into the street and started dancing. She didn't stop. Within a month somewhere between fifty and four hundred people were dancing with her, and some of them danced until they died.

The authorities' response is the part that stays with me. They diagnosed it as **hot blood**, and concluded the cure was to dance it out. So they cleared two guildhalls, built a stage, and hired musicians to keep the afflicted moving.

Nobody knows what it was. Ergot poisoning from mouldy rye, stress-induced mass psychogenic illness, a religious trance cult — every explanation has a hole in it. It happened at least seven other times in the same region over 200 years, and then it stopped happening, and it has never happened since.

Still awake? I have more where that came from.`,
    shareTitle: 'The dancing plague of 1518',
    sharePoints: [
      'A woman danced in the street and would not stop',
      'Up to 400 joined her; some danced until they died',
      'The official cure: hire musicians, keep them moving',
    ],
  }),

  'wd-md-lunch': (ctx) => ({
    body: `The desk salad problem is a decision problem, not a food problem. Fix it with a rule instead of a search.

- **The 8-minute rule.** Anywhere you can walk to in 8 minutes counts. Anything further is a whole outing and you won't do it twice.
- **Order the thing they make most.** In ${ctx.city} that's usually the one item on the sign outside. Volume means fresh.
- **Sit down for ten minutes.** Eating at your desk saves eleven minutes and costs you the afternoon.

Give me a cross street and I'll name three specific places.`,
    shareTitle: 'The 8-minute rule for lunch',
    sharePoints: [
      'Anything past an 8-minute walk becomes an outing',
      'Order the thing on the sign — volume means fresh',
      'Ten minutes sitting down buys you the afternoon',
    ],
  }),

  'wd-e-watch': () => ({
    body: `I need one thing from you: do you want to **feel something**, or do you want to **stop feeling things**?

**Stop feeling things** — *The Grand Budapest Hotel*. Symmetrical, pink, funny, and nothing that happens can hurt you.

**Feel something, gently** — *Perfect Days*. A man cleans public toilets in Tokyo and listens to cassettes. Almost nothing happens. It is about noticing, and you will leave it kinder.

**Feel something, badly** — *Past Lives*. Two hours, one ache, no villain. Do not watch it with someone you're unsure about.

Say a word and I'll narrow it to one.`,
    shareTitle: 'Feel something, or stop feeling things?',
    sharePoints: [
      'Stop feeling things → The Grand Budapest Hotel',
      'Feel something gently → Perfect Days',
      'Feel something badly → Past Lives',
    ],
  }),

  'wd-n-plan': () => ({
    body: `Five lines, and the order matters:

1. **The one thing.** Name the single task that makes tomorrow a success. Only one.
2. **When it happens.** Give it a clock time, not a position in a list.
3. **The two-minute start.** Write the first physical action — "open the doc, title it." That's what beats the wall in the morning.
4. **What you're dropping.** Pick something to not do, out loud. Otherwise it follows you around all day.
5. **The stop time.** When tomorrow ends, whatever happened.

Want me to hold the format and you fill in the blanks?`,
    shareTitle: 'Tomorrow in five lines',
    sharePoints: [
      'One thing. Only one.',
      'A clock time, not a list position',
      'Name what you are dropping, out loud',
    ],
  }),
};

function generic(text: string, ctx: Context): Answer {
  return {
    body: `i can read the pattern, but i need one more piece from you.

- **Your question:** "${text.replace(/\.$/, '')}"
- **The timing:** ${ctx.label.toLowerCase()} — the moment matters here.
- **Next:** send your birth date, exact time if you have it, and birthplace for a chart-grounded read.

tell me what happened, and i'll connect it to your chart instead of giving you a generic horoscope.`,
    shareTitle: text.length > 68 ? `${text.slice(0, 65)}…` : text,
    sharePoints: [
      'Your chart is personal, not generic',
      'Timing is part of the read',
      'Bring me the real question',
    ],
  };
}

function chartAnswer(text: string, ctx: Context): Answer {
  const knownLondonExample = /june\s+14[, ]+2000/i.test(text) && /london/i.test(text) && /5\s*pm/i.test(text)
  if (!knownLondonExample) return generic(text, ctx)
  return {
    body: `you’re a **gemini sun**, **scorpio moon**, and **scorpio rising** — which is a much more interesting mix than “bubbly gemini” lets on.

**the headline:** your mind moves quickly, but your feelings do not come out quickly. people probably meet the composed, observant version of you first; meanwhile you’re clocking everything.

**mercury in cancer** makes your thinking memory-led and intuitive. **venus and mars in gemini** give you a restless, verbal kind of attraction — you need someone who can keep up, not just someone who looks good on paper.

the tension to watch: staying unreadable when you actually want to be understood. say the real thing a beat earlier than feels safe.`,
    shareTitle: 'Gemini sun, Scorpio moon, Scorpio rising',
    sharePoints: [
      'quick mind, private emotional life',
      'people meet the composed version first',
      'say the real thing a beat earlier',
    ],
  }
}

export function getAnswer(promptId: string | null, text: string, ctx: Context): Answer {
  if (/read my chart|birth|born\s+\w+/i.test(text)) return chartAnswer(text, ctx)
  const canned = promptId ? ANSWERS[promptId] : undefined;
  return canned ? canned(ctx) : generic(text, ctx);
}
