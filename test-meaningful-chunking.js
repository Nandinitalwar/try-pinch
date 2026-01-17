// Test meaningful chunking function

// Copy the chunking functions from the webhook
function chunkMessage(message, maxLength = 1400) {
  if (message.length <= maxLength) {
    return [message]
  }
  
  const chunks = []
  
  // Split by double line breaks first (natural topic/section boundaries)
  const sections = message.split('\n\n').filter(s => s.trim())
  
  let currentChunk = ''
  
  for (const section of sections) {
    const potentialChunk = currentChunk ? currentChunk + '\n\n' + section : section
    
    // If adding this section would exceed limit, save current chunk
    if (potentialChunk.length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim())
      currentChunk = section
    } else {
      currentChunk = potentialChunk
    }
    
    // If single section is too long, split by sentences at natural points
    if (currentChunk.length > maxLength) {
      const sentenceChunks = splitBySentences(currentChunk, maxLength)
      
      // Add all but the last chunk
      for (let i = 0; i < sentenceChunks.length - 1; i++) {
        chunks.push(sentenceChunks[i].trim())
      }
      
      // Keep the last chunk as current
      currentChunk = sentenceChunks[sentenceChunks.length - 1] || ''
    }
  }
  
  // Add remaining content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks.filter(chunk => chunk.length > 0)
}

function splitBySentences(text, maxLength) {
  const chunks = []
  
  // Split by sentence endings but keep the punctuation
  const sentences = text.split(/(?<=[.!?])\s+/)
  
  let currentChunk = ''
  
  for (const sentence of sentences) {
    const potentialChunk = currentChunk ? currentChunk + ' ' + sentence : sentence
    
    if (potentialChunk.length <= maxLength) {
      currentChunk = potentialChunk
    } else {
      if (currentChunk) {
        chunks.push(currentChunk)
      }
      currentChunk = sentence
      
      // If single sentence is still too long, split it forcefully at word boundaries
      if (currentChunk.length > maxLength) {
        const words = currentChunk.split(' ')
        let wordChunk = ''
        
        for (const word of words) {
          if ((wordChunk + ' ' + word).length <= maxLength) {
            wordChunk = wordChunk ? wordChunk + ' ' + word : word
          } else {
            if (wordChunk) {
              chunks.push(wordChunk)
            }
            wordChunk = word
          }
        }
        
        currentChunk = wordChunk
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk)
  }
  
  return chunks
}

// Test with a long astrology response
const testResponse = `Hello there! Thank you for reaching out for your 2026 prediction.

Based on your birth date of **December 21, 1998**, your Sun sign is **Capricorn**. You carry the ambitious, disciplined, and practical energy of the Goat, with a strong drive for achievement and a grounded approach to life.

**Major Planetary Influences for 2026:**

The year 2026 will be significantly shaped by several major planetary transits. Jupiter, the planet of expansion and growth, will spend the first half of the year in Cancer, emphasizing home, family, and emotional security. This is an excellent time for real estate investments, family planning, or deepening your roots.

**Career and Finance:**

Saturn's continued presence in Pisces will challenge you to bring structure to your dreams and spiritual aspirations. For Capricorns, this means finding practical ways to monetize your creativity or spiritual insights. Your natural business acumen will be enhanced by Neptune's dreamy influence.

The second half of 2026 brings Jupiter into Leo, illuminating your 8th house of shared resources, investments, and transformation. This is a powerful time for financial partnerships, getting loans approved, or receiving inheritances. Your Capricorn pragmatism will help you make wise investment decisions.

**Relationships and Love:**

Venus will make several significant aspects throughout 2026, particularly affecting your relationship sector. The spring months (March-May) look especially promising for love, with Venus-Jupiter harmonious aspects bringing joy and expansion to partnerships.

If you're in a relationship, this could be a year of taking things to the next level - engagement, marriage, or starting a family. Single Capricorns should pay special attention to the late summer months when Mars energizes your romance sector.

**Health and Wellness:**

Your ruling planet Saturn's position suggests the need for better work-life balance. Capricorns tend to overwork, but 2026 calls for more attention to your physical and mental wellbeing. Consider incorporating more water-based activities into your routine, as Saturn in Pisces favors swimming, meditation, or spa treatments.

**Key Dates to Remember:**

- March 15-30: Excellent period for new relationships or renewing existing ones
- June 21: Your solar return brings a fresh start and new opportunities  
- August 10-25: Career breakthrough or promotion likely
- October 15: Major financial decision or investment opportunity
- November 30: Family-related celebration or milestone

Remember, as a Capricorn, your greatest strength lies in your ability to plan for the long term and build lasting foundations. 2026 supports these natural talents while encouraging you to trust your intuition more than usual.`

console.log('=== Testing Meaningful Chunking ===')
console.log(`Original message length: ${testResponse.length} characters`)
console.log('')

const chunks = chunkMessage(testResponse, 1400)

console.log(`Split into ${chunks.length} chunks:`)
console.log('')

chunks.forEach((chunk, i) => {
  console.log(`--- Chunk ${i + 1} (${chunk.length} chars) ---`)
  console.log(chunk)
  console.log('')
})

// Verify no content is lost
const reconstructed = chunks.join('\n\n')
console.log('=== Verification ===')
console.log(`Original length: ${testResponse.length}`)
console.log(`Reconstructed length: ${reconstructed.length}`) 
console.log(`Content preserved: ${testResponse.replace(/\n\n/g, '\n\n') === reconstructed.replace(/\n\n/g, '\n\n')}`)