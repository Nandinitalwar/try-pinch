// Small talk should feel instant and should never accidentally start chart
// onboarding. Keep this deliberately narrow: anything with a real question,
// media context, or personal content still goes through the reply agent.
const BARE_GREETING = /^(?:h+i+|he+y+|hello+|hiya+|yo+|sup+|what'?s up|whats up|wassup|morning|good morning)[!?.\s]*$/i

export function isBareGreeting(message: string): boolean {
  return BARE_GREETING.test(message.trim())
}

export function getConversationFastPath(message: string): string | null {
  const trimmed = message.trim()
  if (!isBareGreeting(trimmed)) return null

  const words = trimmed.toLowerCase().replace(/[!?.\s]+$/g, '')
  const isUppercase = /[A-Z]/.test(trimmed) && !/[a-z]/.test(trimmed)
  const bangCount = (trimmed.match(/!/g) || []).length

  let reply: string
  if (/^(?:morning|good morning)$/.test(words)) {
    reply = 'morning :)'
  } else if (/^(?:what'?s up|whats up|wassup)$/.test(words)) {
    reply = 'hey :)'
  } else if (/^yo+$/.test(words)) {
    reply = "yo, what's up"
  } else if (bangCount >= 2) {
    reply = "hey!! what's up"
  } else if (bangCount === 1) {
    reply = "hey! what's up"
  } else {
    reply = "hey, what's up"
  }

  return isUppercase ? reply.toUpperCase() : reply
}
