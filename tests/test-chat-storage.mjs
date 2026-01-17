// Quick integration test via HTTP
async function test() {
  const baseUrl = 'http://localhost:3003'
  const phone = '15553334444'
  
  console.log('1. Sending first message...')
  let res = await fetch(`${baseUrl}/api/webhook/twilio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `From=whatsapp:+${phone}&Body=hey%20there`
  })
  console.log('   Status:', res.status)
  let text = await res.text()
  console.log('   Response:', text.substring(0, 100) + '...')
  
  console.log('\n2. Sending second message (should have history)...')
  res = await fetch(`${baseUrl}/api/webhook/twilio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `From=whatsapp:+${phone}&Body=whats%20my%20horoscope`
  })
  console.log('   Status:', res.status)
  text = await res.text()
  console.log('   Response:', text.substring(0, 100) + '...')
  
  console.log('\n✅ Test complete - check server logs for conversation history')
}

test().catch(console.error)
