// Direct agent testing without Twilio - using ES modules for imports
import { GeneralTaskAgent } from './lib/agents/agents/generalTaskAgent.js'
import { BirthDataParser } from './lib/birthDataParser.js'
import { UserProfileService } from './lib/userProfile.js'

async function testAgentDirectly() {
  console.log('🧪 Testing agent directly without Twilio...\n')
  
  const testPhoneNumber = '+15551234567'
  
  // Test 1: Save birth data first
  console.log('📝 Step 1: Saving birth data...')
  const birthMessage = "hi I'm Alex, born on 5/15/1995 at 2:30 PM in New York"
  const birthData = BirthDataParser.extractBirthData(birthMessage)
  
  if (birthData) {
    console.log('Extracted birth data:', birthData)
    const saved = await BirthDataParser.saveBirthData(testPhoneNumber, birthData)
    console.log('Saved to Supabase:', saved ? '✅ Success' : '❌ Failed')
  } else {
    console.log('❌ No birth data extracted')
  }
  
  console.log('\n' + '='.repeat(60) + '\n')
  
  // Test 2: Retrieve profile and test agent response
  console.log('📊 Step 2: Testing agent with stored profile...')
  
  const userProfile = await UserProfileService.getUserProfile(testPhoneNumber)
  console.log('Retrieved profile:', userProfile)
  
  const context = {
    userId: 'test-user-123',
    phoneNumber: testPhoneNumber,
    conversationHistory: [
      { role: 'user', content: birthMessage },
      { role: 'assistant', content: 'cool alex. taurus sun, scorpio vibes. noted.' }
    ],
    userProfile: userProfile
  }
  
  const testQuestions = [
    "what should I wear today?",
    "tell me about my personality",
    "what's my lucky color?"
  ]
  
  for (const question of testQuestions) {
    console.log(`\n💬 User: "${question}"`)
    console.log('🤖 Agent response:')
    
    try {
      const agent = new GeneralTaskAgent(question, context)
      const result = await agent.execute()
      
      if (result.status === 'success') {
        console.log(`✅ ${result.output}`)
      } else {
        console.log(`❌ Error: ${result.output}`)
      }
    } catch (error) {
      console.log(`❌ Exception: ${error.message}`)
    }
    
    console.log('-'.repeat(50))
  }
}

// Run the test
testAgentDirectly().catch(console.error)