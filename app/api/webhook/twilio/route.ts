import { NextRequest, NextResponse } from 'next/server'
import { ChatStorage } from '@/lib/chatStorage'
import { InteractionAgent } from '@/lib/agents/interactionAgent'
import { UserProfileService } from '@/lib/userProfile'
import { SimpleMemorySystem } from '@/lib/simpleMemory'
import { GoogleGenerativeAI } from '@google/generative-ai'

const WHATSAPP_CHAR_LIMIT = 1000  // WhatsApp limit is 1024, leave buffer for escaping

// Normalize phone numbers (strip whatsapp: prefix and non-digits)
function normalizePhone(input: string | null): string | null {
  if (!input) return null
  const noPrefix = input.startsWith('whatsapp:') ? input.slice('whatsapp:'.length) : input
  const digitsOnly = noPrefix.replace(/[^\d]/g, '')
  return digitsOnly || null
}

// Condense response if it exceeds WhatsApp character limit
// NEVER truncates - always uses AI to intelligently summarize
async function condenseResponse(response: string, attempt: number = 1): Promise<string> {
  if (response.length <= WHATSAPP_CHAR_LIMIT) {
    return response
  }

  // Safety: max 3 condensation attempts to avoid infinite loops
  if (attempt > 3) {
    console.error(`[condenseResponse] Failed to condense after 3 attempts (${response.length} chars). Forcing aggressive condense.`)
    // Final attempt: ask for extremely short version
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

  console.log(`[condenseResponse] Response too long (${response.length} chars), condensing (attempt ${attempt})...`)

  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY?.trim().replace(/^['"]|['"]$/g, '') || ''
    if (!apiKey) {
      console.error('[condenseResponse] No API key available')
      return 'Sorry, I had trouble with that. Can you ask again?'
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // Calculate how aggressive we need to be based on attempt number
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
    console.log(`[condenseResponse] Condensed from ${response.length} to ${condensed.length} chars (attempt ${attempt})`)

    // If still too long, try again with more aggressive condensing
    if (condensed.length > WHATSAPP_CHAR_LIMIT) {
      return condenseResponse(condensed, attempt + 1)
    }

    return condensed
  } catch (error) {
    console.error('[condenseResponse] Error condensing:', error)
    // On error, try again if we have attempts left
    if (attempt < 3) {
      return condenseResponse(response, attempt + 1)
    }
    return 'Sorry, I had trouble with that. Can you ask again?'
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const params = new URLSearchParams(body)
    
    const fromNumberRaw = params.get('From')
    const fromNumber = normalizePhone(fromNumberRaw)
    const messageBody = params.get('Body')
    const messageStatus = params.get('MessageStatus')
    const smsStatus = params.get('SmsStatus')
    
    // Ignore status callbacks (no Body parameter)
    if (!messageBody && (messageStatus || smsStatus)) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { status: 200, headers: { 'Content-Type': 'text/xml' } }
      )
    }
    
    if (!fromNumber || !messageBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    // Get or create user
    const userId = await ChatStorage.getOrCreateUser(fromNumber)
    if (!userId) {
      return NextResponse.json({ error: 'Failed to identify user' }, { status: 500 })
    }
    
    // Load conversation history
    const history = ChatStorage.formatForOpenAI(
      await ChatStorage.getConversationHistory(fromNumber, 10)
    )
    console.log(`[${fromNumber}] History count: ${history.length}`, history.length > 0 ? history : '(new user)')
    
    // Save user message
    await ChatStorage.saveMessage(userId, 'user', messageBody, undefined, { identifierIsUserId: true })
    
    // Load user profile and memories for context
    const userProfile = await UserProfileService.getUserProfile(fromNumber)
    const memorySystem = new SimpleMemorySystem()
    const userMemories = await memorySystem.getMemories(fromNumber)
    
    // Use InteractionAgent (which uses GeneralTaskAgent with tool calling)
    let aiResponse: string
    try {
      const agent = new InteractionAgent({
        userId,
        phoneNumber: fromNumber,
        conversationHistory: history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        userProfile: userProfile ?? undefined,
        userMemories
      })
      
      aiResponse = await agent.processMessage(messageBody)
    } catch (error) {
      console.error('Agent error:', error)
      if (error instanceof Error) {
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
      }
      aiResponse = 'I am having trouble right now. Please try again in a moment.'
    }
    
    // Save AI response (non-blocking)
    try {
      await ChatStorage.saveMessage(userId, 'assistant', aiResponse, undefined, { identifierIsUserId: true })
    } catch (error) {
      console.error('Failed to save AI response:', error)
    }
    
    // Condense response if it exceeds WhatsApp's 1024 char limit
    const finalResponse = await condenseResponse(aiResponse)
    
    // Escape XML special characters to prevent TwiML parsing errors
    const escapeXml = (text: string): string => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
    }
    
    const escapedResponse = escapeXml(finalResponse)
    console.log(`[${fromNumber}] Sending TwiML response (${escapedResponse.length} chars)`)
    
    // Return TwiML response
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapedResponse}</Message></Response>`,
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    )
    
  } catch (error) {
    console.error('Webhook error:', error)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Something went wrong. Please try again in a moment.</Message></Response>`,
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Twilio webhook endpoint is active',
    status: 'ok'
  })
}
