import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { ChatStorage } from '@/lib/chatStorage'
import { InteractionAgent } from '@/lib/agents/interactionAgent'
import { UserProfileService } from '@/lib/userProfile'
import { SimpleMemorySystem } from '@/lib/simpleMemory'
import { bufferMessage } from '@/lib/messageBuffer'

const WHATSAPP_CHAR_LIMIT = 950  // WhatsApp limit is 1024, leave buffer for XML escaping

// Normalize phone numbers (strip whatsapp: prefix and non-digits)
function normalizePhone(input: string | null): string | null {
  if (!input) return null
  const noPrefix = input.startsWith('whatsapp:') ? input.slice('whatsapp:'.length) : input
  const digitsOnly = noPrefix.replace(/[^\d]/g, '')
  return digitsOnly || null
}

// Split response into multiple messages at natural break points
// Returns array of message chunks, each under the character limit
function splitIntoMessages(response: string): string[] {
  if (response.length <= WHATSAPP_CHAR_LIMIT) {
    return [response]
  }

  console.log(`[splitIntoMessages] Response is ${response.length} chars, splitting into multiple messages...`)

  const chunks: string[] = []
  let remaining = response

  while (remaining.length > 0) {
    if (remaining.length <= WHATSAPP_CHAR_LIMIT) {
      chunks.push(remaining)
      break
    }

    // Find the best split point within the limit
    const searchArea = remaining.substring(0, WHATSAPP_CHAR_LIMIT)

    // Priority 1: Split at double newline (paragraph break) - keeps content blocks together
    let splitPoint = searchArea.lastIndexOf('\n\n')

    // Priority 2: Split at single newline if no paragraph break found
    if (splitPoint < WHATSAPP_CHAR_LIMIT * 0.4) {
      const newlinePoint = searchArea.lastIndexOf('\n')
      if (newlinePoint > WHATSAPP_CHAR_LIMIT * 0.4) {
        splitPoint = newlinePoint
      }
    }

    // Priority 3: Split at sentence end if no good newline found
    if (splitPoint < WHATSAPP_CHAR_LIMIT * 0.4) {
      const sentencePoints = [
        searchArea.lastIndexOf('. '),
        searchArea.lastIndexOf('! '),
        searchArea.lastIndexOf('? ')
      ]
      const bestSentence = Math.max(...sentencePoints)
      if (bestSentence > WHATSAPP_CHAR_LIMIT * 0.3) {
        splitPoint = bestSentence + 1  // Include the punctuation
      }
    }

    // Fallback: just split at limit (shouldn't happen with well-formatted content)
    if (splitPoint < WHATSAPP_CHAR_LIMIT * 0.3) {
      splitPoint = WHATSAPP_CHAR_LIMIT
    }

    const chunk = remaining.substring(0, splitPoint).trim()
    chunks.push(chunk)
    remaining = remaining.substring(splitPoint).trim()

    console.log(`[splitIntoMessages] Created chunk of ${chunk.length} chars, ${remaining.length} chars remaining`)
  }

  console.log(`[splitIntoMessages] Split into ${chunks.length} messages`)
  return chunks
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
    
    // Buffer the message - waits 1.5s for additional messages before processing
    console.log(`[${fromNumber}] Incoming: "${messageBody.substring(0, 50)}${messageBody.length > 50 ? '...' : ''}"`)
    
    const bufferResult = bufferMessage(fromNumber, messageBody)
    
    if (!bufferResult.isFirst) {
      // This message was added to an existing buffer - return empty response immediately
      // The original request will handle the combined processing
      console.log(`[${fromNumber}] Message buffered, returning empty response`)
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { status: 200, headers: { 'Content-Type': 'text/xml' } }
      )
    }
    
    // This is the first message - wait for the buffer to complete
    const combinedMessage = await bufferResult.promise
    
    console.log(`[${fromNumber}] Processing combined message: "${combinedMessage.substring(0, 100)}${combinedMessage.length > 100 ? '...' : ''}"`)
    
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
    
    // Save user message (save the combined message)
    await ChatStorage.saveMessage(userId, 'user', combinedMessage, undefined, { identifierIsUserId: true })
    
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
      
      aiResponse = await agent.processMessage(combinedMessage)
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

    // Extract and store memories in background (don't block response — Twilio has 15s timeout)
    waitUntil(
      (async () => {
        try {
          const memoryExtractor = new SimpleMemorySystem()
          const memories = await memoryExtractor.extractMemories(combinedMessage, aiResponse)
          if (memories.length > 0) {
            console.log(`[${fromNumber}] Extracted ${memories.length} memories:`, memories.map(m => m.memory_content))
            await memoryExtractor.storeMemories(fromNumber, memories)
            console.log(`[${fromNumber}] Memories stored successfully`)
          }
        } catch (error) {
          console.error(`[${fromNumber}] Memory extraction/storage error:`, error)
        }
      })()
    )

    // Escape XML special characters to prevent TwiML parsing errors
    const escapeXml = (text: string): string => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
    }

    // Split long responses into multiple messages (preserves full content)
    const messageChunks = splitIntoMessages(aiResponse)
    const escapedChunks = messageChunks.map(chunk => escapeXml(chunk))

    console.log(`[${fromNumber}] Sending TwiML response: ${messageChunks.length} message(s), ${messageChunks.map(c => c.length).join('+')} chars`)

    // Build TwiML with multiple <Message> tags if needed
    const messagesTwiml = escapedChunks.map(chunk => `<Message>${chunk}</Message>`).join('')

    // Return TwiML response
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response>${messagesTwiml}</Response>`,
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
