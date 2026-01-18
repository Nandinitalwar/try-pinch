#!/usr/bin/env npx tsx
/**
 * Test script for the WhatsApp message condenser
 * Run with: npm run test:condenser
 */

import 'dotenv/config'
import { GoogleGenerativeAI } from '@google/generative-ai'

const WHATSAPP_CHAR_LIMIT = 1000

// Copy of the condenseResponse function for testing
async function condenseResponse(response: string, attempt: number = 1): Promise<string> {
  if (response.length <= WHATSAPP_CHAR_LIMIT) {
    console.log(`✓ Response is ${response.length} chars (under limit)`)
    return response
  }

  if (attempt > 3) {
    console.error(`✗ Failed to condense after 3 attempts (${response.length} chars). Forcing aggressive condense.`)
    try {
      const apiKey = process.env.GOOGLE_AI_API_KEY?.trim().replace(/^['"]|['"]$/g, '') || ''
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: `Rewrite this in EXACTLY 2-3 short sentences (under 500 characters total). Keep the core message only:\n\n${response}` }]
        }],
        generationConfig: {
          maxOutputTokens: 200,
          temperature: 0.2,
        }
      })
      return result.response.text() || 'Sorry, I had trouble with that. Can you ask again?'
    } catch {
      return 'Sorry, I had trouble with that. Can you ask again?'
    }
  }

  console.log(`→ Attempt ${attempt}: Response is ${response.length} chars, condensing...`)

  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY?.trim().replace(/^['"]|['"]$/g, '') || ''
    if (!apiKey) {
      throw new Error('No GOOGLE_AI_API_KEY configured')
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const targetChars = attempt === 1 ? 900 : attempt === 2 ? 700 : 500

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: `Condense this message to under ${targetChars} characters while keeping the same tone and key info. Preserve any URLs. Return ONLY the condensed message, no preamble:\n\n${response}` }]
      }],
      generationConfig: {
        maxOutputTokens: 400,
        temperature: 0.3,
      }
    })

    const condensed = result.response.text()
    console.log(`  Condensed: ${response.length} → ${condensed.length} chars`)

    if (condensed.length > WHATSAPP_CHAR_LIMIT) {
      return condenseResponse(condensed, attempt + 1)
    }

    return condensed
  } catch (error) {
    console.error('Error:', error)
    if (attempt < 3) {
      return condenseResponse(response, attempt + 1)
    }
    return 'Sorry, I had trouble with that. Can you ask again?'
  }
}

// Test cases
const testCases = [
  {
    name: 'Short response (under limit)',
    input: 'Go to Sausalito. Your Gemini Sun thrives on new inputs and environments.'
  },
  {
    name: 'Original problematic response (1243 chars)',
    input: `Okay, I get it – you're ready to grind, but your Gemini Sun needs a bit of a creative kickstart to truly get into it. Instead of just pushing through at home, let's make Sausalito work for you.

Here's a plan:
1.  **Morning Focus (Sausalito):** Head over early. Find a cafe with good vibes and a view. Get your most mentally demanding tasks done first. Your Gemini energy is sharpest with fresh input, and the change of scenery will prevent you from feeling trapped. Think 1-2 hours of deep work, like drafting emails or planning.
2.  **Lunch Break & Explore:** Give yourself a solid break. Grab some food, walk by the water, or pop into a few shops. This isn't just downtime; it's essential for your adtablGemini mind to process and refresh.
3.  **Afternoon Wrap-up (Home or Cafe):** Either head back home or find another spot in Sausalito if you're really in the flow. Use the afternoon for more routine tasks, follow-ups, or less intense work. You'll carry that refreshed energy from the morning into the rest of your day, making the "grind" feel less like a chore and more like a focused sprint.

It's about working smarter, not just harder, especially with your chart. That mental agility needs fuel, and a change of pace provides it.`
  },
  {
    name: 'Very long response (2000+ chars)',
    input: `Hey! For a super detailed look at all the planetary shifts coming your way in the next three months, we'd need a deeper dive than this chat allows. Those transit readings are intricate.

But speaking generally with your Gemini Sun, you're always ready for a change of scenery or a new intellectual pursuit. The next three months look like a period of significant mental stimulation and potential opportunities for communication or learning.

Here's a breakdown by month:

**January 2026:**
Mars is moving through your chart in a way that energizes your communication sector. This is prime time for important conversations, negotiations, or launching projects that require you to speak up. Your natural Gemini curiosity will be amplified.

**February 2026:**
Venus enters a harmonious aspect with your Sun, bringing potential for pleasant social interactions, creative inspiration, or even romantic opportunities. Your charm is heightened, and people are drawn to your wit and intellect.

**March 2026:**
Mercury, your ruling planet, goes through a significant transit that could bring clarity to long-standing questions or decisions. This is an excellent time for planning, studying, or making important choices about your path forward. Your mental acuity is sharp.

Overall, the next quarter favors intellectual growth, social connections, and taking action on ideas you've been nurturing. Don't be afraid to put yourself out there – your Gemini energy is well-supported by these transits.

Remember to stay flexible though. Your mutable nature is your strength, so let yourself adapt as new information comes in. The stars support movement and change for you right now.`
  }
]

async function runTests() {
  console.log('='.repeat(60))
  console.log('WhatsApp Condenser Test')
  console.log('='.repeat(60))
  console.log(`Character limit: ${WHATSAPP_CHAR_LIMIT}\n`)

  for (const test of testCases) {
    console.log('-'.repeat(60))
    console.log(`TEST: ${test.name}`)
    console.log(`Input length: ${test.input.length} chars`)
    console.log('-'.repeat(60))

    const start = Date.now()
    const result = await condenseResponse(test.input)
    const elapsed = Date.now() - start

    console.log(`\nRESULT (${result.length} chars, ${elapsed}ms):`)
    console.log(result)
    console.log()

    // Verify no truncation (no mid-word cutoffs)
    const endsCleanly = result.endsWith('.') || result.endsWith('!') || result.endsWith('?') || result.endsWith('"') || result.endsWith("'")
    if (!endsCleanly && !result.includes('Sorry')) {
      console.log('⚠️  WARNING: Response may not end cleanly')
    }

    if (result.length <= WHATSAPP_CHAR_LIMIT) {
      console.log('✓ PASS: Under character limit')
    } else {
      console.log('✗ FAIL: Still over character limit!')
    }
    console.log()
  }
}

runTests().catch(console.error)
