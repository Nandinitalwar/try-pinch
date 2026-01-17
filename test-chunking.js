// Test script to simulate long Gemini response and verify Twilio chunking
const fetch = require('node-fetch');

// Mock a very long Gemini response that would definitely need chunking
const mockLongResponse = `listen babe, you want the full cosmic download? buckle up because your chart is WILD and i'm about to spill ALL the tea.

first off, that scorpio ascendant is giving main character energy but like, mysterious main character who probably has three different identities and keeps secrets in seventeen different languages. people look at you and immediately think "this person definitely knows where the bodies are buried" even if you're just thinking about what to have for lunch. it's giving dark academia meets spy thriller meets "i could murder you with my mind but i'm choosing not to because i'm evolved like that."

your sun is probably doing some chaotic shit in your chart because scorpio rising doesn't mess around. whatever sign your sun is in, it's been TRANSFORMED by that scorpio energy. we're talking phoenix rising from the ashes type transformation, except the ashes are probably your old self that you killed off last tuesday because you got bored. scorpio energy doesn't do half measures, honey.

and don't even get me started on whatever tf is happening with your moon placement because EMOTIONS? we don't just feel emotions, we BECOME the emotion. happy? the whole room lights up. sad? everyone within a five mile radius suddenly feels existential dread. angry? the plants start wilting. it's giving emotional nuclear reactor vibes and honestly? iconic.

career wise, you're probably either in something super intense like detective work or psychology OR you're in something completely random like accounting but you approach spreadsheets with the same intensity that most people reserve for life or death situations. either way, you're that person who finds patterns nobody else sees and probably knows everyone's secrets because people just... tell you things. it's the scorpio magic.

love life? MESSY. but like, beautifully messy. you don't do casual anything. you meet someone and within three conversations you either want to marry them or fake your own death to escape them. no middle ground. your type is probably either "mysterious stranger with complicated past" or "golden retriever human who balances out your dark energy." the golden retriever people are surprisingly good for you because they're like emotional sunlight and you're like an exotic plant that secretly needs more light than you admit.

health wise, you probably have the immune system of a tank but also stress yourself into weird symptoms because you think too hard about everything. you're the type to get sick from thinking too much about whether you're getting sick. also you probably have opinions about every wellness trend and have tried at least twelve different meditation apps before deciding you prefer chaos.

money? you're either really good with it in a "i have a spreadsheet for everything" way OR you're terrible with it in a "money is fake anyway" way. no middle ground. you probably either hoard resources like a dragon or spend money on weird specific things that make sense to literally nobody but you. either way, you have strong opinions about cryptocurrency.

your family probably thinks you're either the most successful one or the most mysterious one. maybe both. you're definitely the one they call when there's drama because you can see through everyone's bullshit immediately. thanksgiving is probably either really fun for you because you love chaos OR really exhausting because you can sense everyone's unspoken resentments from across the room.

friends wise, you have like three real friends and seventeen acquaintances who think you're their best friend. the three real ones have probably seen you cry exactly once and it was terrifying for everyone involved. you're the friend people call at 3am when their life is falling apart because somehow you always know what to say even when you're half asleep.

spiritually, you're probably either really into it in a "i have crystals and know everyone's birth time" way OR you're completely skeptical but secretly fascinated. either way, you definitely believe in energy and vibes and probably know way too much about the occult for someone who claims they don't believe in that stuff.

travel plans? you want to go everywhere but you want to go DEEP. no surface level tourism for you. you want to know the local legends and the haunted spots and probably learn the language well enough to eavesdrop on conversations. you're the type to come back from vacation with three new philosophical insights and a story that sounds made up but definitely happened.

anyway bestie, that's your whole entire existence according to the stars. you're basically a walking mystery novel with feelings and strong opinions about pineapple on pizza which is honestly iconic energy. stay chaotic but make it fashion.`;

async function testChunking() {
    console.log('🧪 Testing Twilio webhook with long simulated response...');
    console.log('📏 Mock response length:', mockLongResponse.length, 'characters');
    
    // Create a test request body that would normally trigger the long response
    const testBody = new URLSearchParams({
        'From': 'whatsapp:+16506651538',
        'Body': 'give me a super detailed horoscope'
    });
    
    try {
        console.log('📡 Sending test request to webhook...');
        const response = await fetch('http://localhost:3000/api/webhook/twilio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: testBody.toString()
        });
        
        const responseText = await response.text();
        console.log('✅ Response status:', response.status);
        console.log('📄 Response:', responseText);
        
        // Check if it's TwiML (which means chunked messaging was attempted)
        if (responseText.includes('<?xml') && responseText.includes('<Response>')) {
            console.log('🎯 Response is TwiML format - chunked messaging was attempted');
        } else {
            console.log('❌ Unexpected response format');
        }
        
    } catch (error) {
        console.error('💥 Test failed:', error.message);
    }
}

// Also test the chunking function directly
function testChunkingFunction() {
    console.log('\n🔧 Testing chunking function directly...');
    
    // Copy the chunking function from the webhook
    function chunkMessage(message, maxChunkLength = 1500) {
        if (message.length <= maxChunkLength) {
            return [message];
        }

        const chunks = [];
        let remaining = message;

        while (remaining.length > 0) {
            if (remaining.length <= maxChunkLength) {
                chunks.push(remaining);
                break;
            }

            let chunkEnd = maxChunkLength;
            const sentenceEnd = remaining.lastIndexOf('.', chunkEnd);
            const questionEnd = remaining.lastIndexOf('?', chunkEnd);
            const exclamationEnd = remaining.lastIndexOf('!', chunkEnd);
            
            const bestSentenceEnd = Math.max(sentenceEnd, questionEnd, exclamationEnd);
            
            if (bestSentenceEnd > maxChunkLength * 0.6) {
                chunkEnd = bestSentenceEnd + 1;
            } else {
                const wordEnd = remaining.lastIndexOf(' ', chunkEnd);
                if (wordEnd > maxChunkLength * 0.6) {
                    chunkEnd = wordEnd;
                }
            }

            chunks.push(remaining.substring(0, chunkEnd).trim());
            remaining = remaining.substring(chunkEnd).trim();
        }

        return chunks;
    }
    
    const chunks = chunkMessage(mockLongResponse);
    console.log(`📦 Original message: ${mockLongResponse.length} chars`);
    console.log(`✂️  Split into: ${chunks.length} chunks`);
    
    chunks.forEach((chunk, i) => {
        console.log(`\n📨 Chunk ${i + 1} (${chunk.length} chars):`);
        console.log(`"${chunk.substring(0, 100)}..."`);
    });
    
    console.log('\n✅ Chunking test completed!');
}

// Run the tests
async function runTests() {
    console.log('🚀 Starting Twilio chunking tests\n');
    
    // Test chunking function
    testChunkingFunction();
    
    // Test actual webhook (if server is running)
    await testChunking();
    
    console.log('\n🎉 All tests completed!');
}

runTests().catch(console.error);