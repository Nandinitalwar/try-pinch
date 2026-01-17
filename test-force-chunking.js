// Test that forces chunking by temporarily modifying the chunking threshold

const fetch = require('node-fetch');

async function testForceChunking() {
    console.log('🧪 Testing webhook with forced chunking (lowered threshold)...');
    
    // We'll send a medium message that would normally be 1 chunk
    // but we can modify the threshold in the code to force chunking
    const testMessage = "Give me a detailed horoscope about my career and love life and family relationships and please make it comprehensive";
    
    const testBody = new URLSearchParams({
        'From': 'whatsapp:+16506651538',
        'Body': testMessage
    });
    
    try {
        console.log('📡 Sending request...');
        const response = await fetch('http://localhost:3000/api/webhook/twilio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: testBody.toString()
        });
        
        const responseText = await response.text();
        console.log('✅ Response status:', response.status);
        console.log('📄 Response type:', response.headers.get('content-type'));
        
        // Check if it's TwiML (single message) or empty (chunked)
        if (responseText.includes('<?xml') && responseText.includes('<Message>')) {
            console.log('📱 Single TwiML message returned (chunking may have failed)');
            console.log('📝 Message content length:', responseText.match(/<Message>(.*?)<\/Message>/s)?.[1]?.length || 0, 'chars');
        } else if (responseText.includes('<?xml') && responseText.includes('<Response></Response>')) {
            console.log('✅ Empty TwiML response (indicates chunked messages were sent)');
        } else {
            console.log('❓ Unexpected response format');
        }
        
    } catch (error) {
        console.error('💥 Test failed:', error.message);
    }
}

testForceChunking();