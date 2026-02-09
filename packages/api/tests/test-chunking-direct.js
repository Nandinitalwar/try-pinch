// Test that directly mocks the webhook with a very long response to test chunking
const express = require('express');

// Mock chunking function from webhook
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

// Mock sendChunkedMessages function (without actual Twilio call)
async function mockSendChunkedMessages(to, from, chunks, delayMs = 2000, isWhatsApp = false) {
    console.log(`\n📱 Simulating Twilio message sending:`);
    console.log(`👤 To: ${to}`);
    console.log(`📞 From: ${from}`);
    console.log(`📋 WhatsApp: ${isWhatsApp}`);
    console.log(`📦 Total chunks: ${chunks.length}\n`);

    for (let i = 0; i < chunks.length; i++) {
        if (i > 0) {
            console.log(`⏱️  Waiting ${delayMs}ms between messages...`);
            await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 100))); // Speed up for testing
        }
        
        // Format numbers based on channel type
        const toNumber = isWhatsApp ? `whatsapp:+${to}` : `+${to}`;
        const fromFormatted = from.startsWith('+') ? from : `+${from}`;
        const fromNumber = isWhatsApp ? `whatsapp:${fromFormatted}` : fromFormatted;
        
        console.log(`📤 Chunk ${i + 1}/${chunks.length}:`);
        console.log(`   From: ${fromNumber}`);
        console.log(`   To: ${toNumber}`);
        console.log(`   Length: ${chunks[i].length} chars`);
        console.log(`   Content: "${chunks[i].substring(0, 100)}..."`);
        console.log(`   ✅ Message sent successfully\n`);
    }
    
    return true;
}

// Very long mock response that definitely needs chunking
const mockLongResponse = `listen babe, you want the full cosmic download? buckle up because your chart is WILD and i'm about to spill ALL the tea about your entire astrological existence and it's going to be a JOURNEY.

first off, that scorpio ascendant is giving main character energy but like, mysterious main character who probably has three different identities and keeps secrets in seventeen different languages. people look at you and immediately think "this person definitely knows where the bodies are buried" even if you're just thinking about what to have for lunch. it's giving dark academia meets spy thriller meets "i could murder you with my mind but i'm choosing not to because i'm evolved like that."

your sun is probably doing some chaotic shit in your chart because scorpio rising doesn't mess around. whatever sign your sun is in, it's been TRANSFORMED by that scorpio energy. we're talking phoenix rising from the ashes type transformation, except the ashes are probably your old self that you killed off last tuesday because you got bored. scorpio energy doesn't do half measures, honey.

and don't even get me started on whatever tf is happening with your moon placement because EMOTIONS? we don't just feel emotions, we BECOME the emotion. happy? the whole room lights up. sad? everyone within a five mile radius suddenly feels existential dread. angry? the plants start wilting. it's giving emotional nuclear reactor vibes and honestly? iconic.

career wise, you're probably either in something super intense like detective work or psychology OR you're in something completely random like accounting but you approach spreadsheets with the same intensity that most people reserve for life or death situations. either way, you're that person who finds patterns nobody else sees and probably knows everyone's secrets because people just... tell you things. it's the scorpio magic.

love life? MESSY. but like, beautifully messy. you don't do casual anything. you meet someone and within three conversations you either want to marry them or fake your own death to escape them. no middle ground. your type is probably either "mysterious stranger with complicated past" or "golden retriever human who balances out your dark energy."

anyway bestie, that's your whole entire existence according to the stars. you're basically a walking mystery novel with feelings and strong opinions about pineapple on pizza which is honestly iconic energy. stay chaotic but make it fashion and remember that mercury retrograde isn't an excuse for your poor life choices.`;

async function testChunkingFlow() {
    console.log('🚀 Testing complete chunking flow with long response\n');
    
    // Simulate webhook processing
    const fromNumberRaw = 'whatsapp:+16506651538';
    const fromNumber = '16506651538'; // normalized
    const twilioPhoneNumber = '15551234567'; // mock
    
    console.log(`📊 Original response: ${mockLongResponse.length} characters`);
    
    // Test chunking
    const chunks = chunkMessage(mockLongResponse);
    console.log(`✂️  Split into: ${chunks.length} chunks\n`);
    
    // Show chunk details
    chunks.forEach((chunk, i) => {
        console.log(`📝 Chunk ${i + 1}: ${chunk.length} chars`);
    });
    
    console.log('\n🔄 Simulating webhook send process...');
    
    // Detect if WhatsApp
    const isWhatsApp = fromNumberRaw?.startsWith('whatsapp:') || false;
    console.log(`🔍 Detected WhatsApp: ${isWhatsApp}`);
    
    // Simulate sending
    await mockSendChunkedMessages(fromNumber, twilioPhoneNumber, chunks, 1500, isWhatsApp);
    
    console.log('🎉 Chunking test completed successfully!');
    console.log(`📈 Summary: ${mockLongResponse.length} chars → ${chunks.length} messages`);
}

testChunkingFlow().catch(console.error);