// Test memory system functionality
console.log('🧠 Testing Pinch Memory System\n')

// Simulate a series of conversations that should build up memories
const testConversations = [
  {
    user: "i hate pineapple on pizza, it's absolutely disgusting",
    agent: "noted. pineapple pizza is trash, we agree on that one hun",
    expectedMemory: {
      type: "preference", 
      key: "food_pineapple_pizza", 
      value: "hates pineapple on pizza, thinks it's absolutely disgusting"
    }
  },
  {
    user: "my dog Luna is being so annoying today, she keeps barking",
    agent: "classic luna behavior. dogs always know when mercury's in retrograde",
    expectedMemory: {
      type: "relationship",
      key: "pet_dog_luna", 
      value: "has a dog named Luna who can be annoying and barks"
    }
  },
  {
    user: "ugh i have to work late again, my boss is the worst",
    agent: "your capricorn work energy is showing. time to set some boundaries babe",
    expectedMemory: {
      type: "lifestyle",
      key: "work_situation",
      value: "works late often, has a difficult boss"
    }
  },
  {
    user: "i'm trying to eat healthier but i keep craving chocolate",
    agent: "taurus moon wants what it wants. maybe try dark chocolate - still indulgent but less guilt",
    expectedMemory: {
      type: "goal",
      key: "health_eating",
      value: "trying to eat healthier but struggles with chocolate cravings"
    }
  }
]

// Simulate memory extraction results
function simulateMemoryExtraction(userMessage, agentResponse) {
  console.log(`💬 User: "${userMessage}"`)
  console.log(`🤖 Agent: "${agentResponse}"`)
  
  // Find expected memory for this conversation
  const conversation = testConversations.find(conv => conv.user === userMessage)
  
  if (conversation) {
    console.log('🧠 Memory Extracted:')
    console.log(`   Type: ${conversation.expectedMemory.type}`)
    console.log(`   Key: ${conversation.expectedMemory.key}`)
    console.log(`   Value: ${conversation.expectedMemory.value}`)
    console.log(`   Importance: 7/10`)
    console.log(`   Confidence: 0.9`)
  } else {
    console.log('🤷‍♀️ No significant memories extracted')
  }
  
  console.log('-'.repeat(60))
}

// Demonstrate memory building over time
console.log('📝 CONVERSATION 1 (First interaction)')
simulateMemoryExtraction(testConversations[0].user, testConversations[0].agent)

console.log('\n📝 CONVERSATION 2 (Building relationship info)')
simulateMemoryExtraction(testConversations[1].user, testConversations[1].agent)

console.log('\n📝 CONVERSATION 3 (Lifestyle patterns)')
simulateMemoryExtraction(testConversations[2].user, testConversations[2].agent)

console.log('\n📝 CONVERSATION 4 (Personal goals)')
simulateMemoryExtraction(testConversations[3].user, testConversations[3].agent)

console.log('\n🎯 LATER CONVERSATION (Using stored memories)')
console.log('💬 User: "should i order pizza tonight?"')
console.log('🤖 Agent response with memories:')
console.log('   "absolutely not if there\'s pineapple involved. you made your stance clear, hun.')
console.log('   maybe get luna a plain crust though - she\'s probably hungry from all that barking.')
console.log('   and don\'t work while eating. you need boundaries with that boss of yours."')

console.log('\n🔍 MEMORY CONTEXT USED:')
console.log('   ✓ Remembers: hates pineapple pizza')
console.log('   ✓ Remembers: has dog named Luna who barks')
console.log('   ✓ Remembers: works late with difficult boss')

console.log('\n📊 MEMORY SYSTEM BENEFITS:')
console.log('   • Personalized responses based on past conversations')
console.log('   • Natural callback references ("you made your stance clear")')
console.log('   • Contextual advice using stored preferences')
console.log('   • Maintains conversational continuity across sessions')
console.log('   • No need to re-establish preferences each time')

console.log('\n🔧 IMPLEMENTATION FEATURES:')
console.log('   • AI-powered memory extraction from conversations')
console.log('   • Importance scoring (1-10) for memory prioritization') 
console.log('   • Confidence scoring (0-1) for accuracy tracking')
console.log('   • Memory categorization (preferences, relationships, etc.)')
console.log('   • Automatic mention count and recency tracking')
console.log('   • Seamless integration with existing agent context')

// Test real webhook URL for memory functionality
console.log('\n🌐 TEST WITH REAL WEBHOOK:')
console.log('   1. Send: "i hate spicy food, it burns my mouth"')
console.log('   2. Wait for response...')
console.log('   3. Send: "what should i eat for dinner?"')
console.log('   4. Agent should remember spicy food preference!')

console.log('\n✅ Memory system ready for testing!')