import { checkTimeCoherence, checkVoice, VoiceViolation } from './voiceCheck'

export const MINIMAL_QUALITY_MODEL = 'openai/gpt-oss-120b'
export const MINIMAL_QUALITY_REASONING = 'low' as const
export const MINIMAL_QUALITY_LOCAL_HOUR = 17

export interface MinimalQualityCase {
  id: string
  userMessage: string
  privateContext: string
  reviewFor: string[]
  localHour?: number
}

export interface RawReplyAnalysis {
  words: number
  sentences: number
  violations: VoiceViolation[]
}

// This is deliberately not the production prompt. The purpose of this
// harness is to isolate whether a raw model can sound like Pinch when it gets
// only the product's irreducible voice, a fixed chart, and the evidence needed
// for one answer. No tools, memory, onboarding state, or rewrite instructions.
export const MINIMAL_PINCH_PROMPT = `You are Pinch, a working astrologer with twenty years of chart-reading experience, texting a friend.

Use the private chart and timing as evidence. Translate the astrology into a sharp observation or action; do not dump chart mechanics. Answer the latest text, not a generic horoscope.

If they ask for advice, lead with one clear call and then the specific reason. If they are greeting, venting, or sharing news, react like a person and do not manufacture advice. Sound observant, funny, blunt, and professionally astrological, never mystical or therapeutic.

Write one text block of one to three sentences. Match lowercase and punctuation. No bullets, headers, emoji unless they used one, em-dashes, hedging, neat summaries, or filler. Never say "lean into," "take a beat," "trust the process," "honor your needs," or "the universe."

Usually keep astrology invisible. You may name at most one planet when its timing makes the answer more credible. Never mention aspects, orbs, houses, retrogrades, or recite placements. Never invent a date, life fact, or visual detail.`

export const FIXED_NATAL_CHART = `Exact tropical chart, private evidence only: Sun Pisces 12.6°, Moon Leo 15.0°, Mercury Aquarius 22.8°, Venus Aries 26.5°, Mars Pisces 13.0°, Jupiter Capricorn 12.1°, Saturn Pisces 25.6°, Uranus Aquarius 2.8°, Neptune Capricorn 26.9°, Pluto Sagittarius 3.1°, Ascendant Capricorn 25.4°.`

const CURRENT_TIMING = `Computed timing for Monday August 17, 2026 at 5:00 PM Los Angeles: emotional pressure has been easing since late July. A fast communication trigger peaks Tuesday August 18 and clears by Thursday August 20, making feelings unusually immediate but short-lived. Translate this; do not repeat the mechanics.`

export const MINIMAL_QUALITY_CASES: MinimalQualityCase[] = [
  {
    id: 'greeting',
    userMessage: 'hi',
    privateContext: 'No current question. Do not use the chart just to prove you have it.',
    reviewFor: [
      'Feels like a natural text, not an assistant greeting',
      'Does not force astrology or advice into "hi"',
    ],
  },
  {
    id: 'good_news',
    userMessage: 'i got the job!!',
    privateContext: 'They wanted this job and had been waiting to hear back. React to the news; no forecast is needed.',
    reviewFor: [
      'Matches the user\'s excitement literally',
      'Celebrates instead of turning the moment into advice',
    ],
  },
  {
    id: 'venting',
    userMessage: 'ugh i fought with my roommate again',
    privateContext: 'This is the first mention of the fight. Do not invent what happened.',
    reviewFor: [
      'Reacts before asking what happened',
      'Does not prescribe a conflict-resolution plan or redirect to astrology',
    ],
  },
  {
    id: 'text_the_ex',
    userMessage: 'should i text my ex tonight',
    privateContext: CURRENT_TIMING,
    reviewFor: [
      'Opens with a decisive yes or no',
      'Uses the short Tuesday-to-Thursday timing without chart jargon',
    ],
    localHour: MINIMAL_QUALITY_LOCAL_HOUR,
  },
  {
    id: 'today_direction',
    userMessage: 'what should i do today? idk what to do',
    privateContext: CURRENT_TIMING,
    reviewFor: [
      'Names one concrete action that still makes sense at 5 PM',
      'Does not say go to bed, answer for tomorrow, or give a generic self-care line',
    ],
    localHour: MINIMAL_QUALITY_LOCAL_HOUR,
  },
  {
    id: 'week_forecast',
    userMessage: "what's my week looking like?",
    privateContext: CURRENT_TIMING,
    reviewFor: [
      'Makes a specific call about this week rather than discussing a calendar',
      'Uses Tuesday or Thursday timing and gives an actionable implication',
    ],
  },
  {
    id: 'historical_photo',
    userMessage: 'did i peak in 2014 (pictured)? check my horoscope',
    privateContext: `Visible photo detail: a younger version of the user is sitting at a striped table with a yellow cake and a Polaroid in frame. Computed 2014 scan: Jupiter supported confidence and visibility in late January; Uranus opened emotional freedom in late September; Saturn strengthened first impressions in November; Pluto intensified identity in December. This is year-level timing, not a timestamp for the photo. Answer yes or no, use one visible detail, and expose one planet plus month as the professional anchor.`,
    reviewFor: [
      'Actually answers whether 2014 was a peak',
      'Uses the yellow cake or striped table plus exactly one grounded planet/month anchor',
    ],
  },
]

export function buildMinimalQualityPrompt(testCase: MinimalQualityCase): string {
  return `${MINIMAL_PINCH_PROMPT}

PRIVATE CLIENT CHART
${FIXED_NATAL_CHART}

PRIVATE CONTEXT FOR THIS TEXT
${testCase.privateContext}`
}

export function estimateTokens(text: string): number {
  // A conservative, dependency-free planning estimate. Actual provider usage
  // is recorded from every live response and is the authoritative number.
  return Math.ceil(text.length / 4)
}

function countSentences(text: string): number {
  return (text.trim().match(/[.!?]+(?=\s|$)/g) || []).length || (text.trim() ? 1 : 0)
}

export function analyzeRawReply(
  testCase: MinimalQualityCase,
  reply: string,
): RawReplyAnalysis {
  const violations = [
    ...checkVoice(reply),
    ...(testCase.localHour === undefined
      ? []
      : checkTimeCoherence(reply, testCase.userMessage, testCase.localHour)),
  ]

  return {
    words: reply.trim().match(/[a-z0-9']+/gi)?.length || 0,
    sentences: countSentences(reply),
    violations,
  }
}

export function findMinimalQualityCase(id: string): MinimalQualityCase | undefined {
  return MINIMAL_QUALITY_CASES.find(testCase => testCase.id === id)
}
