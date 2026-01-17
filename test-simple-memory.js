// Test the simple memory system
console.log('🧠 Testing Simple Memory System\n')

// Test conversations that should build memories
const testConversations = [
  {
    id: 1,
    user: "i hate pineapple pizza it's absolutely disgusting",
    expectedMemory: "hates pineapple pizza"
  },
  {
    id: 2,
    user: "my dog bella keeps barking at everything, she's so annoying",
    expectedMemory: "has dog named bella who barks and is annoying"
  },
  {
    id: 3,
    user: "i work at google as a software engineer",
    expectedMemory: "works at google as software engineer"
  }
]

// Test webhook calls
async function testMemorySystem() {
  const testPhone = "+15551234567"
  
  console.log('📝 Testing Memory Extraction...\n')
  
  for (const conv of testConversations) {
    console.log(`💬 Test ${conv.id}: "${conv.user}"`)
    
    try {
      // Send to webhook
      const response = await fetch('http://localhost:3000/api/webhook/twilio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: testPhone,
          Body: conv.user,
        }).toString()
      })
      
      const result = await response.text()
      console.log(`🤖 Agent: ${result.match(/<Message>(.*?)<\/Message>/)?.[1] || 'No response'}`)
      console.log(`📝 Expected memory: "${conv.expectedMemory}"`)
      console.log('-'.repeat(60))
      
      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 2000))
      
    } catch (error) {
      console.error(`❌ Error in test ${conv.id}:`, error.message)
    }
  }
  
  console.log('\n🔍 Testing Memory Retrieval...')
  console.log('💬 "what do you remember about me?"')
  
  try {
    const response = await fetch('http://localhost:3000/api/webhook/twilio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: testPhone,
        Body: "what do you remember about me?",
      }).toString()
    })
    
    const result = await response.text()
    const agentResponse = result.match(/<Message>(.*?)<\/Message>/)?.[1] || 'No response'
    console.log(`🤖 Agent: ${agentResponse}`)
    
    console.log('\n✅ Memory Test Complete!')
    console.log('🎯 Agent should reference stored memories in response')
    
  } catch (error) {
    console.error('❌ Memory retrieval test failed:', error.message)
  }
}

// Run the test
console.log('🚀 Starting Simple Memory System Test...')
console.log('Make sure your dev server is running: npm run dev\n')

// Check if server is running first
fetch('http://localhost:3000/api/webhook/twilio')
  .then(() => {
    console.log('✅ Server is running, starting tests...\n')
    testMemorySystem()
  })
  .catch(() => {
    console.log('❌ Server not running. Please start with: npm run dev')
  })