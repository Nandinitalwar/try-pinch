// Test the new natural chunking logic

// Copy the new chunking functions
function chunkMessage(message) {
  const chunks = []
  
  // First split by double line breaks (natural paragraph/topic boundaries)
  const paragraphs = message.split(/\n\s*\n/).filter(p => p.trim())
  
  for (const paragraph of paragraphs) {
    let text = paragraph.trim()
    
    // Split on topic headers first (like **career:** )
    if (text.includes('**')) {
      const topicChunks = text.split(/(\*\*[^*]+\*\*:?\s*)/).filter(chunk => chunk.trim())
      
      for (let i = 0; i < topicChunks.length; i += 2) {
        const header = topicChunks[i] || ''
        const content = topicChunks[i + 1] || ''
        const combined = (header + content).trim()
        
        if (combined) {
          chunks.push(...splitLongText(combined))
        }
      }
    } else {
      chunks.push(...splitLongText(text))
    }
  }
  
  return chunks.filter(chunk => chunk.trim().length > 0)
}

function splitLongText(text) {
  const chunks = []
  const maxLength = 200
  
  // Split into sentences first
  const sentences = text.split(/([.!?]+\s*)/).filter(s => s.trim())
  
  let currentChunk = ''
  
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i] || ''
    const punctuation = sentences[i + 1] || ''
    const fullSentence = (sentence + punctuation).trim()
    
    // If adding this sentence would make chunk too long, start new chunk
    if (currentChunk && (currentChunk + ' ' + fullSentence).length > maxLength) {
      chunks.push(currentChunk.trim())
      currentChunk = fullSentence
    } else {
      currentChunk = currentChunk ? currentChunk + ' ' + fullSentence : fullSentence
    }
    
    // Natural conversation break points
    const isGoodBreakPoint = 
      fullSentence.match(/[.!?]$/) && // Ends with punctuation
      currentChunk.length > 50 && // Has some substance
      currentChunk.length < maxLength // But not too long
    
    if (isGoodBreakPoint) {
      chunks.push(currentChunk.trim())
      currentChunk = ''
    }
  }
  
  // Add remaining text
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  // If we only got one chunk and it's very long, force split it
  if (chunks.length === 1 && chunks[0].length > maxLength * 2) {
    return forceBreakLongChunk(chunks[0])
  }
  
  return chunks
}

function forceBreakLongChunk(text) {
  const chunks = []
  const maxLength = 200
  const words = text.split(' ')
  
  let currentChunk = ''
  
  for (const word of words) {
    if (currentChunk && (currentChunk + ' ' + word).length > maxLength) {
      chunks.push(currentChunk.trim())
      currentChunk = word
    } else {
      currentChunk = currentChunk ? currentChunk + ' ' + word : word
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks
}

// Test cases
const testCases = [
  // Short message (should still chunk)
  "okay, let's cut to the chase, my aquarian. no cap, your chart's a whole vibe.",
  
  // Medium message with topics
  `**career:** with your venus in pisces in the 10th house, you're probably dreaming of a career that's all about empathy and making a difference. you want your job to *feel* good, not just pay the bills.

**love life:** your gemini rising means you approach relationships with intellectual curiosity. it's giving "i'm interested, but don't get too close."`,

  // Long horoscope response
  `listen babe, you want the full cosmic download? buckle up because your chart is WILD and i'm about to spill ALL the tea.

**career:** with your venus in pisces in the 10th house, you're probably dreaming of a career that's all about empathy and making a difference, or at least looking like you are. you want your job to *feel* good, not just pay the bills. the advice? stop romanticizing the grind and actually put in the work.

**love life:** your gemini rising and moon in the 1st house mean you approach relationships with a blend of intellectual curiosity and emotional detachment. it's giving "i'm interested, but don't get too close." you crave mental stimulation more than physical touch sometimes, which can confuse people.

anyway bestie, that's your whole entire existence according to the stars. you're basically a walking mystery novel with feelings.`
]

console.log('🧪 Testing New Natural Chunking Logic\n')

testCases.forEach((testCase, i) => {
  console.log(`📝 Test Case ${i + 1}:`)
  console.log(`📏 Original: ${testCase.length} chars`)
  console.log(`📄 Content: "${testCase.substring(0, 100)}..."\n`)
  
  const chunks = chunkMessage(testCase)
  console.log(`✂️  Split into ${chunks.length} chunks:`)
  
  chunks.forEach((chunk, j) => {
    console.log(`\n📱 Chunk ${j + 1} (${chunk.length} chars):`)
    console.log(`"${chunk}"`)
  })
  
  console.log('\n' + '='.repeat(50) + '\n')
})

console.log('✅ Chunking tests completed!')