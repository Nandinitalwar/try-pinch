// Final outbound text sanitizer for user-facing replies.
// Deterministically removes em/en dashes and common Unicode lookalikes.
// Policy:
// - Replace numeric ranges like "2014–2016" with "2014 to 2016"
// - For all other dash-like punctuation, prefer a comma + space ", "
// - Collapse surrounding whitespace and normalize punctuation spaces
//
// Characters handled:
//   \u2014 — EM DASH
//   \u2013 – EN DASH
//   \u2015 ― HORIZONTAL BAR
//   \u2012 ‒ FIGURE DASH
//   \u2212 − MINUS SIGN
//
// NOTE: We intentionally do not touch ASCII hyphen-minus "-" (U+002D).
// The voice check still flags em/en dashes earlier in the pipeline; this is the
// last-mile safety net to ensure nothing ships to users.
export function sanitizeDashCharacters(input: string): string {
  if (!input) return input
  let text = input

  // 1) Numeric ranges: "2014–2016" -> "2014 to 2016"
  //    Also catches spaced variants like "2014 — 2016"
  const DASHLIKE = /[\u2012\u2013\u2014\u2015\u2212]/ // common unicode dashes
  text = text.replace(new RegExp(`(\\d)\\s*${DASHLIKE.source}\\s*(\\d)`, 'g'), (_m, a: string, b: string) => {
    return `${a} to ${b}`
  })

  // 2) Default punctuation join: any remaining dash-like punctuation becomes ", "
  //    Absorb surrounding whitespace to avoid duplicates like " ,  ".
  text = text.replace(new RegExp(`\\s*${DASHLIKE.source}\\s*`, 'g'), ', ')

  // 3) Cleanup spacing around punctuation:
  //    - collapse multiple spaces
  //    - fix spaces before commas/periods
  text = text.replace(/\s{2,}/g, ' ')
  text = text.replace(/\s+([,.;!?])/g, '$1') // remove space before punctuation
  text = text.replace(/([,;])([^\s])/g, '$1 $2') // ensure a space after comma/semicolon when followed by non-space

  // 4) Trim edges
  text = text.trim()
  return text
}

// Convenience helper that can be extended later for more rules.
export function sanitizeFinalReply(input: string): string {
  return sanitizeDashCharacters(input)
}

