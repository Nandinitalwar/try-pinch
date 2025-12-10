import { NextRequest, NextResponse } from 'next/server'
import { ChatStorage } from '@/lib/chatStorage'
import { InteractionAgent } from '@/lib/agents/interactionAgent'
import { AgentContext } from '@/lib/agents/types'

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
    const conversationHistory = ChatStorage.formatForOpenAI(
      await ChatStorage.getConversationHistory(fromNumber, 10)
    )
    
    // Save user message
    await ChatStorage.saveMessage(userId, 'user', messageBody, undefined, { identifierIsUserId: true })
    
    // Create agent context
    const context: AgentContext = {
      userId,
      phoneNumber: fromNumber,
      conversationHistory
    }
    
    // Use Interaction Agent to process message (multi-agent orchestration)
    const interactionAgent = new InteractionAgent(context)
    let aiResponse: string
    
    try {
      aiResponse = await interactionAgent.processMessage(messageBody)
    } catch (error) {
      console.error('Interaction Agent error:', error)
      if (error instanceof Error) {
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
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
