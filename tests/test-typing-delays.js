// Test the realistic typing delay calculation

function calculateTypingDelay(message) {
  const baseTypingSpeed = 3 // chars per second (average mobile typing)
  const messageLength = message.length
  
  // Base typing time
  let typingTime = messageLength / baseTypingSpeed * 1000 // convert to milliseconds
  
  // Add thinking time for complex messages
  const complexityFactors = {
    hasNumbers: /\d/.test(message) ? 1.2 : 1.0,
    hasEmphasis: /[*_]/.test(message) ? 1.1 : 1.0,
    hasQuestions: /\?/.test(message) ? 1.15 : 1.0,
    isLong: messageLength > 100 ? 1.3 : 1.0,
    hasEmojis: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(message) ? 1.1 : 1.0
  }
  
  // Apply complexity multipliers
  Object.values(complexityFactors).forEach(factor => {
    typingTime *= factor
  })
  
  // Add some random human variation (15% variance)
  const randomVariation = 0.85 + Math.random() * 0.3
  typingTime *= randomVariation
  
  // Add thinking pauses for natural conversation
  if (messageLength > 50) {
    typingTime += 500 + Math.random() * 1000 // pause to think
  }
  
  // Minimum delay (even short messages take some time)
  const minDelay = 800
  const maxDelay = 8000 // cap at 8 seconds for very long messages
  
  return Math.max(minDelay, Math.min(maxDelay, Math.round(typingTime)))
}

// Test messages of different lengths and complexity
const testMessages = [
  "okay",
  "lol no cap",
  "anyway, that's your whole vibe according to the stars",
  "**career:** with your venus in pisces in the 10th house, you're probably dreaming of a career that's all about empathy and making a difference",
  "but here's the tea: pluto, the planet of deep transformation, just moved into aquarius and is *literally* sitting on your sun, mercury (at 17 degrees aquarius), and uranus (at 17 degrees aquarius) in your 11th house. this isn't just a vibe, it's a full-blown existential career crisis that's also a major glow up"
]

console.log('⏱️  Testing Realistic Typing Delays\n')

testMessages.forEach((message, i) => {
  const delay = calculateTypingDelay(message)
  const seconds = (delay / 1000).toFixed(1)
  
  console.log(`📱 Message ${i + 1}:`)
  console.log(`📏 Length: ${message.length} chars`)
  console.log(`📝 Content: "${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"`)
  console.log(`⏱️  Typing delay: ${delay}ms (${seconds}s)`)
  console.log(`📊 Speed: ${(message.length / (delay / 1000)).toFixed(1)} chars/sec\n`)
})

console.log('🎯 Factors that increase delay:')
console.log('- Numbers (+20%)')
console.log('- Emphasis like *bold* (+10%)')
console.log('- Questions? (+15%)')
console.log('- Long messages >100 chars (+30%)')
console.log('- Emojis (+10%)')
console.log('- Thinking pauses for messages >50 chars (500-1500ms)')
console.log('- Random human variation (±15%)')
console.log('- Min delay: 800ms, Max delay: 8000ms')