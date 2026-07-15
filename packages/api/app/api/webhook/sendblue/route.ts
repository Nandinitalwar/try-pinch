import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { ChatStorage } from '@/lib/chatStorage'
import { InteractionAgent } from '@/lib/agents/interactionAgent'
import { UserProfileService } from '@/lib/userProfile'
import { SimpleMemorySystem } from '@/lib/simpleMemory'
import { bufferMessage } from '@/lib/messageBuffer'
import { startConversationSpan, flushBraintrust } from '@/lib/braintrust'
import { SendBlueWebhookPayload, SendBlueClient } from '@/lib/sendblue'

// Normalize phone number to E.164 format
function normalizePhone(phone: string | null): string {
  if (!phone) return ''
  let cleaned = phone.replace(/[^\d+]/g, '')
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned
  }
  return cleaned
}

// Split long messages into chunks (iMessage limit is ~18996 chars, but we use conservative limit)
function splitIntoMessages(text: string, maxLength: number = 1500): string[] {
  if (text.length <= maxLength) return [text]
  
  const chunks: string[] = []
  let remaining = text
  
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining)
      break
    }
    
    // Try to split at sentence boundary
    let splitIndex = remaining.lastIndexOf('. ', maxLength)
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remaining.lastIndexOf(' ', maxLength)
    }
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = maxLength
    } else {
      splitIndex += 1 // Include the period/space
    }
    
    chunks.push(remaining.substring(0, splitIndex).trim())
    remaining = remaining.substring(splitIndex).trim()
  }
  
  return chunks
}

/**
 * SendBlue webhook handler for receiving iMessages
 * POST /api/webhook/sendblue
 */
export async function POST(request: NextRequest) {
  try {
    const payload: SendBlueWebhookPayload = await request.json()
    
    // Only process inbound messages (not status updates for outbound messages)
    if (payload.is_outbound) {
      console.log(`[SendBlue] Ignoring outbound message status: ${payload.status}`)
      return NextResponse.json({ status: 'ok' })
    }
    
    const fromNumber = normalizePhone(payload.from_number || payload.number)
    const messageBody = payload.content
    
    if (!fromNumber || !messageBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    console.log(`[SendBlue][${fromNumber}] Incoming: "${messageBody.substring(0, 50)}${messageBody.length > 50 ? '...' : ''}"`)
    console.log(`[SendBlue] Service: ${payload.service}, Status: ${payload.status}`)
    
    // Buffer the message - waits 1.5s for additional messages before processing
    const bufferResult = bufferMessage(fromNumber, messageBody)
    
    if (!bufferResult.isFirst) {
      console.log(`[SendBlue][${fromNumber}] Message buffered, returning empty response`)
      return NextResponse.json({ status: 'ok' })
    }
    
    // This is the first message - wait for the buffer to complete
    const combinedMessage = await bufferResult.promise
    
    console.log(`[SendBlue][${fromNumber}] Processing combined message: "${combinedMessage.substring(0, 100)}${combinedMessage.length > 100 ? '...' : ''}"`)
    
    // Start Braintrust conversation span
    const conversationStartTime = Date.now()
    const conversationSpan = startConversationSpan({
      name: 'imessage_conversation',
      phoneNumber: fromNumber,
      userId: '',
      metadata: {
        message_preview: combinedMessage.substring(0, 100),
        message_length: combinedMessage.length,
        service: payload.service,
      }
    })
    
    // Get or create user
    const userId = await ChatStorage.getOrCreateUser(fromNumber)
    if (!userId) {
      conversationSpan?.end()
      return NextResponse.json({ error: 'Failed to identify user' }, { status: 500 })
    }
    
    // Load conversation history
    const history = ChatStorage.formatForOpenAI(
      await ChatStorage.getConversationHistory(fromNumber, 10)
    )
    console.log(`[SendBlue][${fromNumber}] History count: ${history.length}`)
    
    // Save user message
    await ChatStorage.saveMessage(userId, 'user', combinedMessage, undefined, { identifierIsUserId: true })
    
    // Load user profile and memories
    const userProfile = await UserProfileService.getUserProfile(fromNumber)
    const memorySystem = new SimpleMemorySystem()
    const userMemories = await memorySystem.getMemories(fromNumber)
    
    // Process with AI agent
    let aiResponse: string
    let agentError: string | undefined
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
      console.error('[SendBlue] Agent error:', error)
      if (error instanceof Error) {
        agentError = error.message
      }
      aiResponse = 'I am having trouble right now. Please try again in a moment.'
    }
    
    // End conversation span
    if (conversationSpan) {
      conversationSpan.log({
        input: combinedMessage,
        output: aiResponse,
        metadata: {
          user_id: userId,
          phone_number: fromNumber,
          service: payload.service,
          latency_ms: Date.now() - conversationStartTime,
        },
        error: agentError,
      })
      conversationSpan.end()
    }
    
    // Save AI response
    await ChatStorage.saveMessage(userId, 'assistant', aiResponse, undefined, { identifierIsUserId: true })

    // Send response via SendBlue
    const sendBlueClient = SendBlueClient.getClient()
    if (sendBlueClient) {
      const messageChunks = splitIntoMessages(aiResponse)
      console.log(`[SendBlue][${fromNumber}] Sending ${messageChunks.length} message(s)`)

      for (const chunk of messageChunks) {
        const result = await sendBlueClient.sendMessage({
          to: fromNumber,
          content: chunk,
        })

        if (result.status === 'ERROR') {
          console.error(`[SendBlue][${fromNumber}] Failed to send message:`, result.error)
        } else {
          console.log(`[SendBlue][${fromNumber}] Message sent: ${result.message_handle}`)
        }
      }
    } else {
      console.error('[SendBlue] Client not configured - cannot send response')
    }

    // Extract and store memories in background
    waitUntil(
      (async () => {
        try {
          const memoryExtractor = new SimpleMemorySystem()
          const memories = await memoryExtractor.extractMemories(combinedMessage, aiResponse)
          if (memories.length > 0) {
            console.log(`[SendBlue][${fromNumber}] Extracted ${memories.length} memories`)
            await memoryExtractor.storeMemories(fromNumber, memories)
          }
        } catch (error) {
          console.error(`[SendBlue][${fromNumber}] Memory extraction error:`, error)
        }

        // Flush Braintrust logs
        await flushBraintrust()
      })()
    )

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('[SendBlue] Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET handler for health check
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'SendBlue webhook endpoint is active',
    status: 'ok'
  })
}


