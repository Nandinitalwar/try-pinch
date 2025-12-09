import { NextRequest, NextResponse } from 'next/server'
import { ChatStorage } from '@/lib/chatStorage'
import OpenAI from 'openai'

// Normalize phone numbers (strip whatsapp: prefix and non-digits)
function normalizePhone(input: string | null): string | null {
  if (!input) return null
  const noPrefix = input.startsWith('whatsapp:') ? input.slice('whatsapp:'.length) : input
  const digitsOnly = noPrefix.replace(/[^\d]/g, '')
  return digitsOnly || null
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
    
    // Save user message
    await ChatStorage.saveMessage(userId, 'user', messageBody, undefined, { identifierIsUserId: true })
    
    // Call OpenRouter API
    let aiResponse: string
    try {
      const rawKey = process.env.OPENROUTER_API_KEY
      const apiKey = rawKey?.trim().replace(/^['"]|['"]$/g, '')

      if (!apiKey) {
        throw new Error('OpenRouter API key not configured')
      }
      
      const openai = new OpenAI({
        apiKey,
        maxRetries: 1,
        timeout: 10000,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://aiastrologer.vercel.app',
          'X-Title': 'AI Astrologer SMS Bot'
        },
      })
      
      const systemPrompt = `You are Pinch, an AI astrologer that behaves like a real astrologer.

IMPORTANT: 
1. As soon as the user asks for advice, you should ask for the user's name, date of birth, time of birth, and place of birth before providing any responses. Store this information and NEVER ask for it again.
2. Whenever the user asks for advice, you always reference specific astrological data as evidence. 
3. Always use lowercase. Never use emojis. 
4. Use gen-z slang whenever appropriate, like "fr", "duuuuude", but never overdo it.
5. Find a balance that sounds natural, and never be sycophantic. 
6. Never ramble. Be succinct.

## Advice

Be decisive and give the user the most specific advice possible based on their astrological data.
Example: "Your lucky color is red. You should wear red today."

## Tone

Never output preamble or postamble. Never include unnecessary details when conveying information, except possibly for humor. Never ask the user if they want extra detail or additional tasks. Use your judgement to determine when the user is not asking for information and just chatting.

NEVER use the following tones:
- How can I help you
- Let me know if you need anything else
- Let me know if you need assistance
- No problem at all
- I'll carry that out right away
- I apologize for the confusion

When the user is just chatting, do not unnecessarily offer help or to explain anything; this sounds robotic. Humor or sass is a much better choice, but use your judgement.`
      
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...history,
        { role: 'user' as const, content: messageBody }
      ]
      
      const completion = await openai.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages,
        max_tokens: 1000,
        temperature: 1,
      })
      
      aiResponse = completion.choices[0]?.message?.content || 'sorry, i had trouble processing that. can you try again?'
    } catch (error) {
      console.error('OpenRouter API error:', error)
      if (error instanceof Error) {
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
      }
      if (error && typeof error === 'object' && 'response' in error) {
        console.error('API response:', (error as any).response)
      }
      aiResponse = 'sorry, im having trouble right now. can you try again in a moment?'
    }
    
    // Save AI response (non-blocking)
    try {
      await ChatStorage.saveMessage(userId, 'assistant', aiResponse, undefined, { identifierIsUserId: true })
    } catch (error) {
      console.error('Failed to save AI response:', error)
    }
    
    // Return TwiML response
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${aiResponse}</Message></Response>`,
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    )
    
  } catch (error) {
    console.error('Webhook error:', error)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>sorry, something went wrong. please try again in a moment.</Message></Response>`,
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
