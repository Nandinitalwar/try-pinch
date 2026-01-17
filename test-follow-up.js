// Test follow-up message to see if stored profile is used
const testMessage = "what should i wear today?"
const testPhoneNumber = "+919876543210" // Same number as before

console.log('Testing follow-up with stored profile...')
console.log('Test message:', testMessage)
console.log('Test phone number:', testPhoneNumber)

fetch('http://localhost:3000/api/webhook/twilio', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    From: testPhoneNumber,
    Body: testMessage,
  }).toString()
})
.then(response => response.text())
.then(data => {
  console.log('Response:', data)
})
.catch(error => {
  console.error('Error:', error)
})