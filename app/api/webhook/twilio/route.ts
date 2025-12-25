import { NextRequest, NextResponse } from 'next/server'
import { ChatStorage } from '@/lib/chatStorage'
import { InteractionAgent } from '@/lib/agents/interactionAgent'
import { AgentContext } from '@/lib/agents/types'
import { UserProfileService } from '@/lib/userProfile'
import { SimpleMemorySystem } from '@/lib/simpleMemory'

// Initialize Twilio client (lazy initialization)
let twilioClient: any = null
async function getTwilioClient() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      const twilio = (await import('twilio')).default
      twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    } catch (error) {
      console.error('Failed to initialize Twilio client:', error)
      return null
    }
  }
  return twilioClient
}

// Normalize phone numbers (strip whatsapp: prefix and non-digits)
function normalizePhone(input: string | null): string | null {
  if (!input) return null
  const noPrefix = input.startsWith('whatsapp:') ? input.slice('whatsapp:'.length) : input
  const digitsOnly = noPrefix.replace(/[^\d]/g, '')
  return digitsOnly || null
}

// Split message into conversational chunks
function chunkMessage(message: string, maxChunkLength: number = 1500): string[] {
  if (message.length <= maxChunkLength) {
    return [message]
  }

  const chunks: string[] = []
  let remaining = message

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkLength) {
      chunks.push(remaining)
      break
    }

    // Find good break points (sentence endings, then word boundaries)
    let chunkEnd = maxChunkLength
    const sentenceEnd = remaining.lastIndexOf('.', chunkEnd)
    const questionEnd = remaining.lastIndexOf('?', chunkEnd)
    const exclamationEnd = remaining.lastIndexOf('!', chunkEnd)
    
    const bestSentenceEnd = Math.max(sentenceEnd, questionEnd, exclamationEnd)
    
    if (bestSentenceEnd > maxChunkLength * 0.6) {
      chunkEnd = bestSentenceEnd + 1
    } else {
      // Fall back to word boundary
      const wordEnd = remaining.lastIndexOf(' ', chunkEnd)
      if (wordEnd > maxChunkLength * 0.6) {
        chunkEnd = wordEnd
      }
    }

    chunks.push(remaining.substring(0, chunkEnd).trim())
    remaining = remaining.substring(chunkEnd).trim()
  }

  return chunks
}

// Send messages with delay between chunks
async function sendChunkedMessages(
  to: string, 
  from: string, 
  chunks: string[], 
  delayMs: number = 2000,
  isWhatsApp: boolean = false
): Promise<void> {
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
    
    const client = await getTwilioClient()
    if (!client) {
      throw new Error('Twilio client not initialized')
    }
    
    // Format numbers based on channel type
    const toNumber = isWhatsApp ? `whatsapp:+${to}` : `+${to}`
    const fromNumber = isWhatsApp ? `whatsapp:${from}` : from
    
    await client.messages.create({
      body: chunks[i],
      from: fromNumber,
      to: toNumber
    })
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
    const conversationHistory = ChatStorage.formatForOpenAI(
      await ChatStorage.getConversationHistory(fromNumber, 10)
    )
    
    // Fetch user profile from Supabase
    const userProfile = await UserProfileService.getUserProfile(fromNumber)
    
    // Fetch simple user memories for context
    const simpleMemorySystem = new SimpleMemorySystem()
    const userMemories = await simpleMemorySystem.getMemories(fromNumber)
    
    // Save user message
    await ChatStorage.saveMessage(userId, 'user', messageBody, undefined, { identifierIsUserId: true })
    
    // Create agent context with simple memories
    const context: AgentContext = {
      userId,
      phoneNumber: fromNumber,
      conversationHistory,
      userProfile: userProfile || undefined,
      userMemories: userMemories || []
    }
    
    // Log user input for debugging
    console.log(`[Webhook] User input from ${fromNumber}:`, messageBody)
    console.log(`[Webhook] Conversation history length: ${conversationHistory.length} messages`)
    
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
    
    // Log the AI response for debugging
    console.log(`[Webhook] AI Response (${aiResponse.length} chars):`, aiResponse)
    
    // Save AI response (non-blocking)
    try {
      await ChatStorage.saveMessage(userId, 'assistant', aiResponse, undefined, { identifierIsUserId: true })
    } catch (error) {
      console.error('Failed to save AI response:', error)
    }
    
    // Extract and store simple memories from this conversation exchange (non-blocking)
    try {
      const memories = await simpleMemorySystem.extractMemories(messageBody, aiResponse)
      
      if (memories.length > 0) {
        await simpleMemorySystem.storeMemories(fromNumber, memories)
        console.log(`[Webhook] Extracted ${memories.length} simple memories for ${fromNumber}`)
      }
      
    } catch (error) {
      console.error('Failed to extract/store simple memories:', error)
    }
    
    // Send chunked response messages (if Twilio is configured)
    const twilioClientInstance = await getTwilioClient()
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER
    
    if (twilioClientInstance && twilioPhoneNumber) {
      try {
        const chunks = chunkMessage(aiResponse)
        console.log(`[Webhook] Chunked response into ${chunks.length} parts:`)
        chunks.forEach((chunk, i) => console.log(`  Chunk ${i + 1}: "${chunk}"`))
        
        // Detect if this is a WhatsApp message
        const isWhatsApp = fromNumberRaw?.startsWith('whatsapp:') || false
        console.log(`[Webhook] Detected WhatsApp: ${isWhatsApp}, Original from: ${fromNumberRaw}`)
        
        // Send messages with conversational delays
        await sendChunkedMessages(fromNumber, twilioPhoneNumber, chunks, 1500, isWhatsApp)
        
        console.log(`[Webhook] Sent ${chunks.length} message chunks to ${fromNumber}`)
        
        // Return empty TwiML response since we sent messages directly
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
          { status: 200, headers: { 'Content-Type': 'text/xml' } }
        )
      } catch (error) {
        console.error('Failed to send chunked messages:', error)
        // Fall through to TwiML response
      }
    } else {
      console.log('[Webhook] Twilio not configured, using TwiML response')
      // Still demonstrate chunking logic
      const chunks = chunkMessage(aiResponse)
      if (chunks.length > 1) {
        console.log(`[Webhook] Would have chunked into ${chunks.length} parts:`)
        chunks.forEach((chunk, i) => console.log(`  Chunk ${i + 1}: "${chunk}"`))
      }
    }
    
    // Fallback to TwiML response (when chunked messaging isn't available)
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

export async function GET() {
  return NextResponse.json({ 
    message: 'Twilio webhook endpoint is active',
    status: 'ok'
  })
}
