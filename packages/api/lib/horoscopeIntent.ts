/**
 * Keep the chart reveal trigger narrow. A personal horoscope request should
 * start chart onboarding; a general question about what horoscopes are should
 * not attach somebody's chart unexpectedly.
 */
export function isPersonalHoroscopeRequest(text: string): boolean {
  const personalDirection =
    /\b(?:what should i do|what do i do|should i\b|is (?:today|tonight|tomorrow|this week) (?:a )?(?:good|bad)|how(?:'s| is) (?:my )?(?:day|today|tonight|tomorrow|week)|what(?:'s| is) (?:my )?(?:day|today|tonight|tomorrow|week) (?:looking|look) like|read me|give me (?:a )?reading|what do the stars say)\b/i.test(text)
  if (personalDirection) return true
  if (!/\bhoroscopes?\b/i.test(text)) return false

  const educationalQuestion =
    /\b(?:what (?:is|are|does)|define|explain|how (?:do|does|are))\b[^?!.]{0,50}\bhoroscopes?\b/i.test(text)
  const personalCue =
    /\b(?:my|mine|me|i|today|tonight|tomorrow|daily|weekly|week|month|monthly|love|career)\b/i.test(text)

  return !educationalQuestion || personalCue
}
