// Test script to simulate Twilio webhook with birth data message
const testMessage = "hi i'm nandini my birthdate is 03/12/2012 place of birth is mumbai tim eof birth is 12pm"
const testPhoneNumber = "+919876543210"

console.log('Testing birth data extraction and storage...')
console.log('Test message:', testMessage)
console.log('Test phone number:', testPhoneNumber)

// Simulate POST request to webhook
fetch('http://localhost:3000/api/webhook/twilio', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    From: testPhoneNumber,
    Body: testMessage,
    MessageStatus: undefined,
    SmsStatus: undefined
  }).toString()
})
.then(response => response.text())
.then(data => {
  console.log('Response:', data)
})
.catch(error => {
  console.error('Error:', error)
})