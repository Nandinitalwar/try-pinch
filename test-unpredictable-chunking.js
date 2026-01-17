// Test the new unpredictable chunking logic

// Copy the new chunking functions
function chunkMessage(message) {
  const chunks = []
  
  const paragraphs = message.split(/\n\s*\n/).filter(p => p.trim())
  
  for (const paragraph of paragraphs) {
    let text = paragraph.trim()
    
    if (text.includes('**')) {
      const topicChunks = text.split(/(\*\*[^*]+\*\*:?\s*)/).filter(chunk => chunk.trim())
      
      for (let i = 0; i < topicChunks.length; i += 2) {
        const header = topicChunks[i] || ''
        const content = topicChunks[i + 1] || ''
        
        if (header && content) {
          const keepTogether = Math.random() < 0.6
          
          if (keepTogether || content.length < 100) {
            const combined = (header + ' ' + content).trim()
            chunks.push(...splitUnpredictably(combined))
          } else {
            chunks.push(header.trim())
            chunks.push(...splitUnpredictably(content))
          }
        } else if (header) {
          chunks.push(header.trim())
        } else if (content) {
          chunks.push(...splitUnpredictably(content))
        }
      }
    } else {
      chunks.push(...splitUnpredictably(text))
    }
  }
  
  return chunks.filter(chunk => chunk.trim().length > 0)
}

function splitUnpredictably(text) {
  const chunks = []
  
  const minLength = 20
  const maxLength = 300
  const preferredLength = 80 + Math.random() * 120
  
  const sentences = text.split(/([.!?]+\s*)/).filter(s => s.trim())
  
  let currentChunk = ''
  
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i] || ''
    const punctuation = sentences[i + 1] || ''
    const fullSentence = (sentence + punctuation).trim()
    
    const potentialChunk = currentChunk ? currentChunk + ' ' + fullSentence : fullSentence
    
    const shouldBreak = decideShouldBreak(potentialChunk, fullSentence, currentChunk, preferredLength, maxLength)
    
    if (shouldBreak && currentChunk.length > minLength) {
      chunks.push(currentChunk.trim())
      currentChunk = fullSentence
    } else {
      currentChunk = potentialChunk
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks.flatMap(chunk => {
    if (chunk.length > maxLength && Math.random() < 0.7) {
      return randomlySplitLongChunk(chunk)
    }
    return [chunk]
  })
}

function decideShouldBreak(potentialChunk, lastSentence, currentChunk, preferredLength, maxLength) {
  if (potentialChunk.length > maxLength) return true
  
  if (Math.random() < 0.15 && currentChunk.length > 40) return true
  
  const emphasisPhrases = [
    'honestly', 'literally', 'basically', 'anyway', 'also', 'plus',
    'btw', 'omg', 'lol', 'fr', 'ngl', 'periodt', 'no cap'
  ]
  
  if (emphasisPhrases.some(phrase => lastSentence.toLowerCase().includes(phrase))) {
    if (Math.random() < 0.6) return true
  }
  
  if (potentialChunk.length > preferredLength) {
    if (lastSentence.match(/[.!?]$/) && Math.random() < 0.8) return true
  }
  
  if (potentialChunk.length > preferredLength * 1.5 && Math.random() < 0.9) return true
  
  return false
}

function randomlySplitLongChunk(text) {
  const words = text.split(' ')
  const splitPoint = Math.floor(words.length * (0.3 + Math.random() * 0.4))
  
  return [
    words.slice(0, splitPoint).join(' '),
    words.slice(splitPoint).join(' ')
  ].filter(chunk => chunk.trim().length > 0)
}

// Test with the same message multiple times to show unpredictability
const testMessage = `alright, another horoscope request. you really are into this stuff, aren't you? fine. here's the tea on your main character energy.

**career:** with your aquarius sun and mercury both chilling in aquarius, you're not meant for cubicles or corporate drone life. your brain is bussin' with unconventional ideas, so lean into roles where you can innovate or lead change. your mars in aries gives you the drive to actually do stuff, not just think about it. so stop overthinking those wild schemes and just go for it.

**love life:** your venus in capricorn means you're secretly looking for something serious, even if your gemini moon wants to flirt with every shiny object. you value stability, no cap. forget the casual hookups – you want someone who can build an empire with you. find someone who stimulates your mind, because your gemini moon gets bored real quick with surface-level vibes.

anyway bestie, that's your whole entire existence according to the stars. you're basically a walking mystery novel with feelings.`

console.log('🎲 Testing Unpredictable Chunking (Multiple Runs)\n')
console.log(`📏 Original: ${testMessage.length} characters\n`)

// Run the same message 3 times to show variation
for (let run = 1; run <= 3; run++) {
  console.log(`🔄 Run ${run}:`)
  
  const chunks = chunkMessage(testMessage)
  console.log(`✂️  Split into ${chunks.length} chunks:`)
  
  chunks.forEach((chunk, j) => {
    console.log(`\n📱 Chunk ${j + 1} (${chunk.length} chars):`)
    console.log(`"${chunk}"`)
  })
  
  console.log('\n' + '='.repeat(60) + '\n')
}