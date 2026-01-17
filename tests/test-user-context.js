// Test script to verify user profile context integration
const { UserProfileService } = require('./lib/userProfile');

async function testUserProfileRetrieval() {
  console.log('Testing user profile retrieval...');
  
  // Test with a sample phone number
  const testPhone = '+1234567890';
  
  try {
    const profile = await UserProfileService.getUserProfile(testPhone);
    console.log('Profile result:', profile);
    
    const formatted = UserProfileService.formatProfileForAgent(profile);
    console.log('Formatted for agent:');
    console.log(formatted);
    
    console.log('\nTesting with sample birth data...');
    const sampleProfile = {
      phone_number: testPhone,
      preferred_name: 'Test User',
      birth_date: '1990-01-01',
      birth_time: '12:00:00',
      birth_time_known: true,
      birth_time_accuracy: 'exact',
      birth_city: 'Mumbai',
      birth_country: 'India',
      birth_timezone: 'Asia/Kolkata'
    };
    
    const sampleFormatted = UserProfileService.formatProfileForAgent(sampleProfile);
    console.log('Sample formatted context:');
    console.log(sampleFormatted);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testUserProfileRetrieval();