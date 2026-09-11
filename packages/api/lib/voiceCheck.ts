// Deterministic guard on Pinch's voice.
//
// The system prompt bans a long list of phrases, and the model ignores it
// often enough to matter - a small fast model at high temperature cannot be
// relied on to honor forty negative constraints buried in a long prompt.
// So we check the output instead of trusting it, and hand a concrete
// violation back for one rewrite. Cheaper and more reliable than a longer
// prompt, and it can't silently regress.

export interface VoiceViolation {
  kind: 'banned_phrase' | 'astro_jargon' | 'preamble' | 'too_long' | 'hedge' | 'ai_tell' | 'paragraphs' | 'slow_open' | 'repetition' | 'shallow_chart_intro' | 'time_mismatch' | 'onboarding_miss'
  detail: string
}

export type ActivationReplyStage =
  | 'none'
  | 'collect-name'
  | 'collect-birth'
  | 'collect-name-and-birth'

// Constructions that mark text as machine-written. The em-dash is the loudest
// of these by a wide margin: almost nobody reaches for one in a text message,
// and every model reaches for them constantly.
const AI_TELL_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /[—–]/, label: 'em-dash or en-dash (never use one)' },

  // "It's not about winning, it's about showing up."
  { re: /\b(it|this|that)('s| is| was)\s+not\s+[^.!?,]{2,40},\s*(it|this|that)('s| is| was)\b/i,
    label: '"it\'s not X, it\'s Y" construction' },
  { re: /\b(that|this|it)('s| is)\s+not\s+[^.!?]{2,40}\.\s*(That|This|It)('s| is)\b/,
    label: '"That\'s not X. That\'s Y." construction' },

  { re: /\bhere's the thing\b/i, label: '"here\'s the thing"' },
  { re: /\bthe truth is\b/i, label: '"the truth is"' },
  { re: /\bat the end of the day\b/i, label: '"at the end of the day"' },
  { re: /\blet's be (real|honest)\b/i, label: '"let\'s be real"' },
  { re: /\b(i'll|i will) be honest\b/i, label: '"I\'ll be honest"' },
  { re: /\bnot gonna lie\b/i, label: '"not gonna lie"' },
  { re: /\bthat said\b/i, label: '"that said"' },
  { re: /\bthe reality is\b/i, label: '"the reality is"' },
  { re: /\bwhich is (exactly )?(why|what)\b/i, label: '"which is exactly why" pivot' },
]

// Therapy-speak and horoscope filler.
const BANNED_PHRASES = [
  'celestial', 'cosmic energy', 'the universe has plans', 'the universe is telling',
  'the universe wants', 'divine timing', 'i sense', 'show up as your best self',
  'lean into', 'lean in to', 'hold space', 'holding space', 'honor your needs', 'be present',
  'take a beat', 'needs a beat', 'sit with your feelings', 'give yourself permission',
  'serves you', 'no longer serves you', 'inner compass', 'tune into', 'tune in to',
  'how can i help', 'let me know if you need anything else', 'no problem',
  'big changes are coming', 'a period of transformation', 'you may feel tension',
  'be mindful', 'plan your next moves', 'this is a signal to', "it's a reminder to",
  'pay attention to how', 'trust the process', 'trust your process',
  'check in with yourself', 'honor that', 'space to breathe',
]

// Hedges. These are how the model dodges committing to advice, and a reply
// built out of them reads as a horoscope rather than a recommendation.
const HEDGE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\byou'll probably\b/i, label: "\"you'll probably\"" },
  { re: /\byou might (find|feel|want)\b/i, label: '"you might find/feel/want"' },
  { re: /\bif you want to\b/i, label: '"if you want to"' },
  { re: /\bit's a good time to\b/i, label: '"it\'s a good time to"' },
  { re: /\bcould be a (nice|good|great)\b/i, label: '"could be a nice"' },
  { re: /\bjust focus on\b/i, label: '"just focus on"' },
  { re: /\btrust that\b/i, label: '"trust that"' },
  { re: /\bi don't have anything about\b/i, label: 'dodging what they just told you' },

  // Handing the decision back. This is the worst version of hedging because it
  // looks like advice: "if your gut says rest, listen to it" is the model
  // declining to make the call while sounding like it made one. They came here
  // precisely because they didn't want to consult their own gut.
  { re: /\bif your (gut|body|instinct)/i, label: 'deferring to their gut' },
  { re: /\b(listen to|trust) your (gut|body|instincts?|intuition)\b/i, label: 'telling them to trust their gut' },
  { re: /\bgo with your (gut|instincts?|intuition)\b/i, label: 'telling them to go with their gut' },
  { re: /\byou know yourself best\b/i, label: '"you know yourself best"' },
  { re: /\bit's (really )?up to you\b/i, label: '"it\'s up to you"' },
  { re: /\bonly you (can|know)\b/i, label: '"only you can decide"' },
  { re: /\bwhatever feels right\b/i, label: '"whatever feels right"' },
  { re: /\bif that('s| is) what you (want|need)\b/i, label: 'conditional non-answer' },
  { re: /\bsee how you feel\b/i, label: '"see how you feel"' },
]

const PLANETS = 'sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto'
const SIGNS = 'aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces'

// Chart mechanics. Astrology is the engine, not the content - so this matches
// the SHAPE of jargon rather than a list of literal phrases. A blocklist of
// exact strings loses to "went retrograde" vs "stationing retrograde"
// immediately; patterns don't.
const ASTRO_JARGON_PATTERNS: Array<{ re: RegExp; label: string }> = [
  // Any retrograde talk at all, in any tense.
  { re: /\bretrograde\b/i, label: 'retrograde talk' },
  { re: /\b(goes|going|went|gone|turns|turning)\s+direct\b/i, label: 'station/direct talk' },
  { re: /\bshadow period\b/i, label: 'shadow period' },

  // "Venus in Aries", "Saturn in Pisces" - placement recitation.
  { re: new RegExp(`\\b(${PLANETS})\\s+in\\s+(${SIGNS})\\b`, 'i'), label: 'planet-in-sign recitation' },
  // "Pisces Sun, Leo Moon, Capricorn rising" is still a chart dump even
  // without a possessive. The chart image can show it; the text should read.
  { re: new RegExp(`\\b(${SIGNS})\\s+(${PLANETS}|rising|ascendant)\\b`, 'i'), label: 'sign-placement recitation' },

  // "your Pisces Sun", "your Capricorn rising" - diagnosing instead of seeing.
  { re: new RegExp(`\\byour\\s+(${SIGNS})\\s+(${PLANETS}|rising|ascendant)\\b`, 'i'), label: 'naming their placement' },
  { re: new RegExp(`\\byour\\s+(${PLANETS}|rising|ascendant)\\s+(sign|placement)\\b`, 'i'), label: 'naming their placement' },
  // "that Leo Moon of yours", "with a Pisces Sun like yours" - same move, and
  // the model reaches for these the moment the possessive form is blocked.
  { re: new RegExp(`\\b(that|those|a|the)\\s+(${SIGNS})\\s+(${PLANETS}|rising|ascendant)\\b[^.!?]{0,25}\\byours?\\b`, 'i'), label: 'naming their placement' },
  { re: new RegExp(`\\b(${SIGNS})\\s+(${PLANETS}|rising|ascendant)\\s+(of yours|like yours)\\b`, 'i'), label: 'naming their placement' },
  // Bare possessive: "your Jupiter", "your Moon". Blocking only the
  // sign-qualified form just pushes the model to this one instead, and
  // "your Jupiter, which is all about growth" is chart anatomy either way.
  // Plain-language planet talk without the possessive ("Saturn's been sitting
  // on you since spring") stays allowed on purpose.
  { re: new RegExp(`\\byour\\s+(${PLANETS})\\b`, 'i'), label: 'possessive chart anatomy' },
  { re: /\bnatal\s+\w+/i, label: 'natal chart anatomy' },
  { re: /\byour ascendant\b/i, label: 'chart anatomy' },
  // "all that gemini in your chart", "that Sagittarius brain". Sign plus a
  // non-planet noun, which the sign-plus-planet patterns above all miss.
  { re: new RegExp(`\\b(all that|that|your|the)\\s+(${SIGNS})\\b(?!\\s+(${PLANETS}|rising|ascendant))`, 'i'), label: 'naming their sign' },
  { re: /\bin your chart\b/i, label: '"in your chart"' },

  // Aspect vocabulary.
  { re: /\b(transiting|conjunct|trining|trine to|sextile|squaring your|opposing your)\b/i, label: 'aspect vocabulary' },

  // Houses.
  { re: /\b(\d{1,2}(st|nd|rd|th)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+house\b/i, label: 'house talk' },

  // "Saturn sitting on your Sun", "Moon hitting your rising".
  { re: new RegExp(`\\b(${PLANETS})\\b[^.!?]{0,40}\\b(sitting on|hitting|moving into|shifting into|landing on)\\b[^.!?]{0,20}\\byour\\b`, 'i'), label: 'transit mechanics' },
  { re: /\bin your sign\b/i, label: 'transit mechanics' },
]

/** More than one planet named in a single reply is always too much. */
function countPlanetMentions(text: string): number {
  const matches = text.match(new RegExp(`\\b(${PLANETS})\\b`, 'gi')) || []
  return new Set(matches.map(m => m.toLowerCase())).size
}

// Openers that delay the answer. An optional leading interjection is allowed
// through the front of each pattern because "Ugh, I get it" is the same
// empathy filler as "I get it" and the model reaches for it the moment the
// bare form is blocked.
const INTERJECTION = String.raw`(?:(?:ugh|oh|hey|aw+|hmm+|lol|omg)[,!.\s]+)?`

const PREAMBLE_PATTERNS = [
  new RegExp(`^${INTERJECTION}(okay|ok|alright|sure|got it|great question|well)[,\\s]`, 'i'),
  new RegExp(`^${INTERJECTION}(yeah|yes|yep)[,\\s]`, 'i'),
  /^and honestly[,\s]/i,
  new RegExp(`^${INTERJECTION}i (totally |completely |really )?(get|hear|feel) (it|you|that)`, 'i'),
  new RegExp(`^${INTERJECTION}(so|now)[,\\s]`, 'i'),
]

// Lowered from 8. Eight let replies grow into essays: five sentences across two
// paragraphs, which is not how anyone texts. Co-Star, the reference point for
// this format, ships one line ("Do your laundry. Fold it immediately.").
// Four is the ceiling, not the target.
const MAX_SENTENCES = 4

// Long opening sentences bury the answer. A decisive reply starts short:
// "Stay in." then the reason.
const MAX_OPENING_WORDS = 14

function firstSentenceWords(text: string): number {
  const first = text.trim().split(/(?<=[.!?])\s/)[0] || ''
  return first.split(/\s+/).filter(Boolean).length
}

/**
 * Real texts are one block. Paragraph breaks are a document convention and
 * read as machine-written the moment they appear in a message thread.
 *
 * Carve-out: event recommendations are specified to put blank lines between
 * entries, and those always carry a URL, so a message containing a link is
 * allowed its structure.
 */
function hasParagraphBreaks(text: string): boolean {
  if (/https?:\/\//i.test(text)) return false
  return /\n\s*\n/.test(text)
}

function countSentences(text: string): number {
  return (text.match(/[.!?]+(\s|$)/g) || []).length
}

/**
 * A first chart is an onboarding reveal, not a file-download acknowledgement.
 * The first attachment has to carry a real reading, but it must answer the
 * question that triggered onboarding. A forced strength/blind-spot worksheet
 * made every reveal generic and caused photo questions to be ignored.
 */
export function checkFirstChartIntroduction(
  text: string,
  options: { answerRequested?: boolean; visualContext?: string; historicalYear?: number } = {},
): VoiceViolation[] {
  const violations: VoiceViolation[] = []
  const sentenceCount = countSentences(text)
  const wordCount = (text.match(/[a-z0-9']+/gi) || []).length
  const minimumSentences = 2
  const minimumWords = options.answerRequested ? 30 : 24

  // "here it is" is a natural attachment caption and unambiguously points at
  // the wheel in this guarded first-chart context. Do not force the model to
  // repeat "chart" when the image is already the next bubble.
  if (!/\bchart\b/i.test(text) && !/^\s*here (?:it is|you go)\b/i.test(text)) {
    violations.push({ kind: 'shallow_chart_intro', detail: 'does not introduce the chart that was just attached' })
  }
  if (sentenceCount < minimumSentences) {
    violations.push({
      kind: 'shallow_chart_intro',
      detail: 'first chart reveal needs at least two short sentences: a real reading and a natural attachment mention',
    })
  }
  if (wordCount < minimumWords) {
    violations.push({
      kind: 'shallow_chart_intro',
      detail: `the first reading is too thin at ${wordCount} words; use at least ${minimumWords}`,
    })
  }
  if (options.answerRequested && /^\s*(?:here(?:'s| is) (?:your|the) chart|(?:your|the) chart)\b/i.test(text)) {
    violations.push({
      kind: 'shallow_chart_intro',
      detail: 'opens with the attachment instead of answering the question that triggered onboarding',
    })
  }
  if (/\bwhen something matters\b[\s\S]{0,180}\b(?:your )?blind spot\b/i.test(text)) {
    violations.push({
      kind: 'shallow_chart_intro',
      detail: 'uses the canned strength/blind-spot activation template instead of the user\'s actual question',
    })
  }
  if (options.visualContext) {
    const ignoredVisualWords = new Set([
      'about', 'above', 'alongside', 'analysis', 'another', 'asking', 'attached', 'birth',
      'chart', 'conversation', 'displaying', 'image', 'indistinct', 'message', 'mobile',
      'partially', 'peaking', 'person', 'phone', 'photo', 'picture', 'question', 'reading',
      'screenshot', 'shows', 'small', 'text', 'user', "user's", 'video', 'view', 'visible',
      'with', 'featuring', 'horoscope',
    ])
    const visualWords = (options.visualContext.toLowerCase().match(/[a-z0-9']+/g) || [])
      .filter(word => /[a-z]/.test(word) && word.length >= 4 && !ignoredVisualWords.has(word))
    const replyWords = new Set(text.toLowerCase().match(/[a-z0-9']+/g) || [])
    if (visualWords.length > 0 && !visualWords.some(word => replyWords.has(word))) {
      violations.push({
        kind: 'shallow_chart_intro',
        detail: 'ignores the image that came with the request; react to one concrete visible detail from the supplied description',
      })
    }
  }
  if (options.historicalYear && !new RegExp(`\\b${options.historicalYear}\\b`).test(text)) {
    violations.push({
      kind: 'shallow_chart_intro',
      detail: `does not answer the requested ${options.historicalYear} period`,
    })
  }
  if (options.historicalYear && /\b(?:today|tonight|tomorrow|this week)\b/i.test(text)) {
    violations.push({
      kind: 'shallow_chart_intro',
      detail: `substitutes a current forecast for the requested ${options.historicalYear} reading`,
    })
  }
  if (
    options.historicalYear &&
    !/\b(?:Jupiter|Saturn|Uranus|Neptune|Pluto|Mars|Venus|Mercury|Sun|Moon)\b/i.test(text)
  ) {
    violations.push({
      kind: 'shallow_chart_intro',
      detail: 'historical horoscope has no professional astrological anchor; name one relevant planet in plain language',
    })
  }

  return violations
}

/**
 * Does this message read as deliberately lowercase? Requires actual letters
 * and no sentence-initial capital, so "hey" counts and "Hey" doesn't.
 */
export function isLowercaseStyle(text: string): boolean {
  const trimmed = text.trim()
  if (!/[a-z]/i.test(trimmed)) return false
  const firstLetter = trimmed.match(/[a-z]/i)
  return firstLetter ? firstLetter[0] === firstLetter[0].toLowerCase() : false
}

/**
 * Mirror the user's lowercase style deterministically.
 *
 * The prompt has asked for this all along and the model complied 9% of the
 * time, producing different casing for the identical message. That randomness
 * reads as machine-written more than any individual phrase does.
 *
 * Only sentence-initial letters and the pronoun "I" are lowered. Mid-sentence
 * capitals are left alone because those are proper nouns, and a venue called
 * "Oyster Club" should survive that a real person typing in lowercase would
 * probably still capitalise, and mangling it would look like a bug.
 */
export function matchCasing(reply: string, userMessage: string): string {
  if (!isLowercaseStyle(userMessage)) return reply

  return reply
    // Sentence starts: beginning of string, or after . ! ? and whitespace.
    // An ALL-CAPS word is left whole: "YES!" is emphasis a real person types,
    // and lowercasing just its first letter produced "yES!".
    .replace(/(^|[.!?]\s+|\n\s*)([A-Z])(\w*)/g, (_m, prefix, letter, rest) =>
      rest.length > 0 && rest === rest.toUpperCase() && /[A-Z]/.test(rest)
        ? prefix + letter + rest
        : prefix + letter.toLowerCase() + rest
    )
    // The standalone pronoun and its contractions.
    .replace(/\bI\b/g, 'i')
    .replace(/\bI'(m|ve|ll|d)\b/g, (_m, suffix) => `i'${suffix}`)
}

const COMMON_CAPITALISED = new Set([
  'i', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december', 'ok', 'okay', 'yes', 'no',
])

/**
 * Proper nouns a reply leans on: names of people, companies, places. Used to
 * catch the same fact being raised turn after turn.
 */
function properNouns(text: string): Set<string> {
  const matches = text.match(/\b[A-Z][a-z]{2,}\b/g) || []
  return new Set(
    matches.map(m => m.toLowerCase()).filter(m => !COMMON_CAPITALISED.has(m))
  )
}

function wordingTokens(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[a-z0-9']+/g) || [])
      .map(token => token.replace(/^'+|'+$/g, ''))
      .filter(Boolean)
  )
}

function substantiallyRepeats(currentText: string, previousText: string): boolean {
  const current = wordingTokens(currentText)
  const previous = wordingTokens(previousText)
  // Short acknowledgements naturally reuse tiny vocabularies ("here it is",
  // "still no"). Similarity becomes meaningful only on substantive replies.
  if (current.size < 7 || previous.size < 7) return false

  let shared = 0
  current.forEach(token => {
    if (previous.has(token)) shared += 1
  })
  const containment = shared / Math.min(current.size, previous.size)
  const union = new Set([...Array.from(current), ...Array.from(previous)]).size
  const jaccard = union === 0 ? 0 : shared / union
  return containment >= 0.8 || jaccard >= 0.68
}

/**
 * Flag a fact the assistant already raised. Knowing someone's manager is called
 * Greg is good; mentioning Greg in four consecutive replies because he came up
 * once is not memory, it is failure to listen. Recency is what makes a callback
 * feel observant rather than obsessive.
 *
 * Only the assistant's own recent turns count. If the user keeps raising
 * something, following them there is correct.
 */
export function checkRepetition(
  text: string,
  recentAssistantTurns: string[],
  currentUserMessage = '',
): VoiceViolation[] {
  if (recentAssistantTurns.length === 0) return []

  const current = properNouns(text)
  const userRaisedNow = properNouns(currentUserMessage)

  const alreadyUsed = new Set<string>()
  for (const turn of recentAssistantTurns.slice(-3)) {
    Array.from(properNouns(turn)).forEach(noun => alreadyUsed.add(noun))
  }

  const repeated = Array.from(current).filter(n => alreadyUsed.has(n) && !userRaisedNow.has(n))
  const violations = repeated.map(n => ({
    kind: 'repetition' as const,
    detail: `"${n}" was already raised in a recent reply; that fact is spent`,
  }))

  if (recentAssistantTurns.slice(-3).some(turn => substantiallyRepeats(text, turn))) {
    violations.push({
      kind: 'repetition' as const,
      detail: 'the wording substantially repeats a recent reply; acknowledge the repeat and say it differently',
    })
  }

  return violations
}

/**
 * Check a draft reply. Returns every violation found so the rewrite prompt can
 * name all of them at once rather than trading one problem for another.
 */
export function checkVoice(text: string): VoiceViolation[] {
  const violations: VoiceViolation[] = []
  if (!text?.trim()) return violations

  const lower = text.toLowerCase()

  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      violations.push({ kind: 'banned_phrase', detail: `"${phrase}"` })
    }
  }

  const seenJargon = new Set<string>()
  for (const { re, label } of ASTRO_JARGON_PATTERNS) {
    const match = text.match(re)
    if (match && !seenJargon.has(label)) {
      seenJargon.add(label)
      violations.push({ kind: 'astro_jargon', detail: `${label} ("${match[0]}")` })
    }
  }

  for (const { re, label } of HEDGE_PATTERNS) {
    if (re.test(text)) {
      violations.push({ kind: 'hedge', detail: label })
    }
  }

  for (const { re, label } of AI_TELL_PATTERNS) {
    if (re.test(text)) {
      violations.push({ kind: 'ai_tell', detail: label })
    }
  }

  const planets = countPlanetMentions(text)
  if (planets > 1) {
    violations.push({ kind: 'astro_jargon', detail: `${planets} different planets named; one idea per message` })
  }

  for (const pattern of PREAMBLE_PATTERNS) {
    const match = text.trim().match(pattern)
    if (match) {
      violations.push({ kind: 'preamble', detail: `opens with "${match[0].trim()}"` })
      break
    }
  }

  if (countSentences(text) > MAX_SENTENCES) {
    violations.push({
      kind: 'too_long',
      detail: `${countSentences(text)} sentences, ceiling is ${MAX_SENTENCES}`,
    })
  }

  if (hasParagraphBreaks(text)) {
    violations.push({ kind: 'paragraphs', detail: 'multiple paragraphs; a text message is one block' })
  }

  if (firstSentenceWords(text) > MAX_OPENING_WORDS) {
    violations.push({
      kind: 'slow_open',
      detail: `opening sentence is ${firstSentenceWords(text)} words; lead with the call in under ${MAX_OPENING_WORDS}`,
    })
  }

  return violations
}

/** Catch advice that is nonsensical for the user's current local hour. */
export function checkTimeCoherence(
  reply: string,
  userMessage: string,
  localHour: number,
): VoiceViolation[] {
  if (!Number.isFinite(localHour) || localHour < 6) return []
  const violations: VoiceViolation[] = []
  const sleepContext = /\b(?:sleep|tired|exhausted|nap|bed|insomnia|up all night)\b/i.test(userMessage)

  const sleepMatch = reply.match(/\b(?:go|get|head|back)\s+to\s+bed\b|\bcall it a night\b|\bgo to sleep\b/i)
  if (sleepMatch && localHour < 21 && !sleepContext) {
    violations.push({
        kind: 'time_mismatch',
        detail: `tells them to "${sleepMatch[0]}" at ${String(localHour).padStart(2, '0')}:00 even though they did not mention being tired`,
    })
  }

  const pastDaypart = localHour >= 12
    ? reply.match(/\b(?:breakfast|this morning|late morning|after sunrise|before noon)\b/i)
    : null
  const pastMeal = localHour >= 15 ? reply.match(/\b(?:lunch|at noon)\b/i) : null
  const pastAfternoon = localHour >= 18 ? reply.match(/\bthis afternoon\b/i) : null
  const mismatch = pastDaypart || pastMeal || pastAfternoon
  if (mismatch) {
    violations.push({
      kind: 'time_mismatch',
      detail: `suggests "${mismatch[0]}" at ${String(localHour).padStart(2, '0')}:00, after that part of the day has passed`,
    })
  }

  return violations
}

/** Make the activation question concrete instead of leaving it to prompt luck. */
export function checkActivationReply(
  reply: string,
  stage: ActivationReplyStage,
): VoiceViolation[] {
  if (stage === 'none') return []

  const asksName = /\b(?:what should i call you|what(?:'s| is) your name|your (?:first |preferred )?name)\b/i.test(reply)
  const asksDate = /\b(?:birth ?date|date of birth|birthday|when (?:were|are) you born)\b/i.test(reply)
  const asksTime = /\b(?:birth ?time|time (?:were|are) you born|what time)\b/i.test(reply)
  const asksCity = /\b(?:birth ?city|city (?:were|are) you born|where (?:were|are) you born|place of birth)\b/i.test(reply)
  const missing: string[] = []

  if ((stage === 'collect-name' || stage === 'collect-name-and-birth') && !asksName) missing.push('preferred name')
  if ((stage === 'collect-birth' || stage === 'collect-name-and-birth') && !asksDate) missing.push('birth date')
  if ((stage === 'collect-birth' || stage === 'collect-name-and-birth') && !asksTime) missing.push('exact birth time')
  if ((stage === 'collect-birth' || stage === 'collect-name-and-birth') && !asksCity) missing.push('birth city')

  const violations: VoiceViolation[] = missing.length
    ? [{ kind: 'onboarding_miss', detail: `activation question is missing: ${missing.join(', ')}` }]
    : []

  if (stage === 'collect-name') {
    const words = reply.match(/[a-z0-9']+/gi) || []
    if (words.length > 12 || /\b(?:birth|birthday|chart|horoscope|today|tonight|tomorrow)\b/i.test(reply)) {
      violations.push({
        kind: 'onboarding_miss',
        detail: 'only the preferred name is missing; ask what to call them and nothing else',
      })
    }
  }

  return violations
}

/**
 * Build the correction sent back to the model. Names the exact violations -
 * a vague "try again" tends to produce a different violation rather than a
 * clean rewrite.
 */
export function buildRewritePrompt(violations: VoiceViolation[]): string {
  const banned = violations.filter(v => v.kind === 'banned_phrase').map(v => v.detail)
  const jargon = violations.filter(v => v.kind === 'astro_jargon').map(v => v.detail)
  const hedges = violations.filter(v => v.kind === 'hedge').map(v => v.detail)
  const tells = violations.filter(v => v.kind === 'ai_tell').map(v => v.detail)
  const preamble = violations.find(v => v.kind === 'preamble')
  const tooLong = violations.find(v => v.kind === 'too_long')
  const paras = violations.find(v => v.kind === 'paragraphs')
  const slowOpen = violations.find(v => v.kind === 'slow_open')
  const repeats = violations.filter(v => v.kind === 'repetition').map(v => v.detail)
  const chartIntro = violations.filter(v => v.kind === 'shallow_chart_intro').map(v => v.detail)
  const timeMismatch = violations.filter(v => v.kind === 'time_mismatch').map(v => v.detail)
  const onboarding = violations.filter(v => v.kind === 'onboarding_miss').map(v => v.detail)

  const problems: string[] = []
  if (banned.length) problems.push(`- Banned filler: ${banned.join(', ')}. Say the blunt version instead.`)
  if (jargon.length) problems.push(`- Chart mechanics they didn't ask for: ${jargon.join(', ')}. Describe what it MEANS for them, never the machinery.`)
  if (hedges.length) problems.push(`- Hedging instead of advising: ${hedges.join(', ')}. Commit to ONE concrete recommendation they could act on tonight. Being wrong is allowed; being vague is not.`)
  if (tells.length) problems.push(`- Reads like AI: ${tells.join(', ')}. Rewrite it the way a person actually texts. Uneven sentence lengths, no em-dashes at all, no neat summarising line at the end.`)
  if (preamble) problems.push(`- ${preamble.detail}. Delete it and start on the answer.`)
  if (tooLong) problems.push(`- Too long: ${tooLong.detail}. Cut it to the one thing worth saying.`)
  if (paras) problems.push(`- ${paras.detail}. Collapse it into one short block.`)
  if (slowOpen) problems.push(`- ${slowOpen.detail}. Open with the verdict, then the reason.`)
  if (repeats.length) problems.push(`- Repeating yourself: ${repeats.join(', ')}. Drop it and read the chart instead.`)
  if (chartIntro.length) problems.push(`- First-chart reading failed: ${chartIntro.join(', ')}. Answer the exact request first using the computed timing and any image detail, then mention the attached chart once. Use two to four short sentences and at least 30 words. Do not force a strength/blind-spot template or list placements.`)
  if (timeMismatch.length) problems.push(`- Time-incoherent advice: ${timeMismatch.join(', ')}. Give one concrete action that fits the user's current local hour and the period they asked about.`)
  if (onboarding.length) problems.push(`- Activation flow failed: ${onboarding.join(', ')}. Ask the exact missing onboarding question in one short sentence. Do not give a reading or advice yet.`)

  return `That reply broke your own rules:
${problems.join('\n')}

Rewrite it. Same substance, same advice, none of those problems. Reply with only the new message - no explanation, no preface.`
}
