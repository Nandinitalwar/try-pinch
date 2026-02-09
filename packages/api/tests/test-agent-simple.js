// Simple test to demonstrate agent responses with user profile context
console.log('🧪 Testing Pinch Agent with User Profile Context\n')

// Simulate the agent response process
function simulateAgentResponse(userMessage, userProfile) {
  console.log(`💬 User Message: "${userMessage}"`)
  console.log('\n📊 User Profile Context:')
  
  if (userProfile) {
    console.log(`   Name: ${userProfile.preferred_name || 'Not provided'}`)
    console.log(`   Birth Date: ${userProfile.birth_date || 'Not provided'}`)
    console.log(`   Birth Time: ${userProfile.birth_time || 'Not provided'}`)
    console.log(`   Birth Location: ${userProfile.birth_city}, ${userProfile.birth_country}`)
    console.log(`   Timezone: ${userProfile.birth_timezone || 'Not provided'}`)
  } else {
    console.log('   No profile data available')
  }
  
  console.log('\n🤖 Agent System Prompt includes:')
  console.log('   - Astrological personality from birth chart')
  console.log('   - Personalized advice based on birth data')
  console.log('   - Reference to specific astrological placements')
  
  // Show example responses based on profile data
  if (userProfile && userProfile.birth_date) {
    const birthDate = new Date(userProfile.birth_date)
    const month = birthDate.getMonth() + 1
    const day = birthDate.getDate()
    
    // Simple sun sign calculation
    let sunSign = 'unknown'
    if ((month == 3 && day >= 21) || (month == 4 && day <= 19)) sunSign = 'aries'
    else if ((month == 4 && day >= 20) || (month == 5 && day <= 20)) sunSign = 'taurus'
    else if ((month == 5 && day >= 21) || (month == 6 && day <= 20)) sunSign = 'gemini'
    else if ((month == 6 && day >= 21) || (month == 7 && day <= 22)) sunSign = 'cancer'
    else if ((month == 7 && day >= 23) || (month == 8 && day <= 22)) sunSign = 'leo'
    else if ((month == 8 && day >= 23) || (month == 9 && day <= 22)) sunSign = 'virgo'
    else if ((month == 9 && day >= 23) || (month == 10 && day <= 22)) sunSign = 'libra'
    else if ((month == 10 && day >= 23) || (month == 11 && day <= 21)) sunSign = 'scorpio'
    else if ((month == 11 && day >= 22) || (month == 12 && day <= 21)) sunSign = 'sagittarius'
    else if ((month == 12 && day >= 22) || (month == 1 && day <= 19)) sunSign = 'capricorn'
    else if ((month == 1 && day >= 20) || (month == 2 <= 18)) sunSign = 'aquarius'
    else if ((month == 2 && day >= 19) || (month == 3 && day <= 20)) sunSign = 'pisces'
    
    console.log(`\n✨ Personalized Response (${sunSign} sun):`)
    
    if (userMessage.toLowerCase().includes('wear')) {
      console.log(`"your ${sunSign} energy wants something that reflects your vibe today. `)
      if (sunSign === 'leo') console.log(`go bold, hun - gold accessories and statement pieces. you're meant to shine."`)
      else if (sunSign === 'virgo') console.log(`clean lines, earth tones. your perfectionist side demands quality over quantity."`)
      else if (sunSign === 'scorpio') console.log(`dark colors, mystery vibes. black never fails you, babe."`)
      else console.log(`trust your instincts - you know what makes you feel powerful."`)
    } else if (userMessage.toLowerCase().includes('personality')) {
      console.log(`"oh honey, your ${sunSign} sun is just the beginning. `)
      if (sunSign === 'gemini') console.log(`you're giving chaotic intellectual energy - embrace the contradiction."`)
      else if (sunSign === 'cancer') console.log(`emotional depth meets protective shell. you feel everything, don't you?"`)
      else if (sunSign === 'sagittarius') console.log(`adventure seeker with commitment issues. classic sag behavior."`)
      else console.log(`classic ${sunSign} traits with your own twist on them."`)
    } else {
      console.log(`"based on your ${sunSign} placement and birth time, here's the tea..."`)
    }
  } else {
    console.log('\n🤷‍♀️ Generic Response (no profile):')
    console.log(`"need your birth info to give you the real astrological tea, hun. when and where were you born?"`)
  }
}

console.log('=' * 60)
console.log('EXAMPLE 1: User with stored profile data')
console.log('=' * 60)

const exampleProfile = {
  preferred_name: 'Alex',
  birth_date: '1995-05-15',
  birth_time: '14:30:00',
  birth_time_known: true,
  birth_city: 'New York',
  birth_country: 'USA',
  birth_timezone: 'America/New_York'
}

simulateAgentResponse("what should I wear today?", exampleProfile)

console.log('\n\n' + '=' * 60)
console.log('EXAMPLE 2: New user without profile')
console.log('=' * 60)

simulateAgentResponse("tell me about my personality", null)

console.log('\n\n' + '=' * 60)
console.log('EXAMPLE 3: Different user with profile')
console.log('=' * 60)

const anotherProfile = {
  preferred_name: 'Nandini',
  birth_date: '2012-12-03',
  birth_time: '12:00:00',
  birth_time_known: true,
  birth_city: 'Mumbai',
  birth_country: 'India',
  birth_timezone: 'Asia/Kolkata'
}

simulateAgentResponse("what's my personality like?", anotherProfile)