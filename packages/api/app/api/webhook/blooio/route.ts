import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { ChatStorage } from '@/lib/chatStorage'
import { InteractionAgent } from '@/lib/agents/interactionAgent'
import { UserProfileService } from '@/lib/userProfile'
import { SimpleMemorySystem } from '@/lib/simpleMemory'
import { bufferMessage } from '@/lib/messageBuffer'
import { startConversationSpan, flushBraintrust } from '@/lib/braintrust'
import { parseBlooioWebhook, BlooioClient } from '@/lib/blooio'
import crypto from 'crypto'

// Verify Blooio webhook signature using HMAC-SHA256
// Header: X-Blooio-Signature, format "t=<timestamp>,v1=<hmac>"
// The HMAC is computed over "{timestamp}.{raw_body}" with the webhook signing secret
function verifyBlooioSignature(payload: string, signature: string | null): boolean {
  const webhookSecret = process.env.BLOOIO_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.log('[Blooio] No webhook secret configured - skipping signature verification')
    return true // Allow if not configured (for development)
  }

  if (!signature) {
    console.log('[Blooio] No signature provided in request')
    return false
  }

  try {
    const parts = new Map(
      signature.split(',').map(part => {
        const [key, ...rest] = part.split('=')
        return [key.trim(), rest.join('=')] as const
      })
    )
    const timestamp = parts.get('t')
    const providedSignature = parts.get('v1')

    if (!timestamp || !providedSignature) {
      console.log('[Blooio] Malformed signature header:', signature)
      return false
    }

    const hmac = crypto.createHmac('sha256', webhookSecret)
    hmac.update(`${timestamp}.${payload}`)
    const expectedSignature = hmac.digest('hex')

    // Compare signatures (constant-time comparison to prevent timing attacks)
    const providedBuffer = Buffer.from(providedSignature)
    const expectedBuffer = Buffer.from(expectedSignature)
    const isValid =
      providedBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(providedBuffer, expectedBuffer)

    if (!isValid) {
      console.log('[Blooio] Invalid webhook signature')
    }

    return isValid
  } catch (error) {
    console.error('[Blooio] Error verifying signature:', error)
    return false
  }
}

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
 * Blooio webhook handler for receiving iMessages
 * POST /api/webhook/blooio
 */
export async function POST(request: NextRequest) {
  console.log('========================================')
  console.log('[Blooio] 🔔 WEBHOOK RECEIVED')
  console.log('[Blooio] Timestamp:', new Date().toISOString())
  console.log('[Blooio] URL:', request.url)
  console.log('[Blooio] Method:', request.method)

  try {
    // Log all headers
    console.log('[Blooio] 📋 Headers:')
    request.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`)
    })

    // Get raw body for signature verification
    const rawBody = await request.text()
    console.log('[Blooio] 📦 Raw body length:', rawBody.length)
    console.log('[Blooio] 📦 Raw body:', rawBody.substring(0, 500))

    // Verify webhook signature
    const signature = request.headers.get('x-blooio-signature')
    console.log('[Blooio] 🔐 Signature header:', signature ? 'present' : 'missing')
    if (!verifyBlooioSignature(rawBody, signature)) {
      console.error('[Blooio] Webhook signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Parse the payload - handles both the documented envelope format
    // ({type, data}) and the compat/legacy flat format ({event, external_id, ...})
    let rawPayload: any
    try {
      rawPayload = JSON.parse(rawBody)
    } catch (parseError) {
      console.error('[Blooio] ❌ Failed to parse JSON payload:', parseError)
      console.error('[Blooio] ❌ Raw body was:', rawBody)
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const message = parseBlooioWebhook(rawPayload)
    if (!message) {
      console.error('[Blooio] ❌ Unrecognized payload shape:', rawBody.substring(0, 300))
      return NextResponse.json({ error: 'Unrecognized payload' }, { status: 400 })
    }
    console.log('[Blooio] ✅ Payload parsed successfully')
    console.log('[Blooio] 📨 Event type:', message.eventType)

    // Only process inbound messages (not status updates like queued, delivered, sent)
    if (message.eventType !== 'message.received') {
      console.log(`[Blooio] ⏭️  Ignoring event: ${message.eventType}`)
      console.log('========================================')
      return NextResponse.json({ status: 'ok' })
    }

    const fromNumber = normalizePhone(message.sender)
    const messageBody = message.text

    console.log('[Blooio] 📞 From (raw):', message.sender)
    console.log('[Blooio] 📞 From (normalized):', fromNumber)
    console.log('[Blooio] 📞 To:', message.recipient)
    console.log('[Blooio] 💬 Message body:', messageBody)
    console.log('[Blooio] 💬 Message length:', messageBody.length)

    if (!fromNumber || !messageBody) {
      console.error('[Blooio] ❌ Missing required fields!')
      console.error('[Blooio] ❌ fromNumber:', fromNumber)
      console.error('[Blooio] ❌ messageBody:', messageBody)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log(`[Blooio][${fromNumber}] ✅ Incoming: "${messageBody.substring(0, 50)}${messageBody.length > 50 ? '...' : ''}"`)
    console.log(`[Blooio] 🆔 Event: ${message.eventType}, Message ID: ${message.messageId}, Protocol: ${message.protocol}`)
    
    // Acknowledge the webhook immediately and run the AI pipeline in the
    // background - the buffer wait + AI response can exceed the webhook timeout
    waitUntil(processInboundMessage(fromNumber, messageBody))

    console.log('[Blooio] ✅ Webhook acknowledged, processing in background')
    console.log('========================================')
    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('========================================')
    console.error('[Blooio] ❌❌❌ WEBHOOK ERROR ❌❌❌')
    console.error('[Blooio] ❌ Error:', error)
    if (error instanceof Error) {
      console.error('[Blooio] ❌ Error name:', error.name)
      console.error('[Blooio] ❌ Error message:', error.message)
      console.error('[Blooio] ❌ Error stack:', error.stack)
    }
    console.error('========================================')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Full inbound message pipeline - runs in the background via waitUntil
 * after the webhook has already been acknowledged
 */
async function processInboundMessage(fromNumber: string, messageBody: string): Promise<void> {
  try {
    // Buffer the message - waits 1.5s for additional messages before processing
    console.log('[Blooio] 🔄 Starting message buffer...')
    const bufferResult = bufferMessage(fromNumber, messageBody)

    if (!bufferResult.isFirst) {
      console.log(`[Blooio][${fromNumber}] ⏸️  Message buffered into existing batch`)
      return
    }

    // This is the first message - wait for the buffer to complete
    console.log('[Blooio] ⏳ Waiting for buffer to complete (1.5s)...')
    const combinedMessage = await bufferResult.promise
    console.log('[Blooio] ✅ Buffer complete')

    console.log(`[Blooio][${fromNumber}] 🚀 Processing combined message: "${combinedMessage.substring(0, 100)}${combinedMessage.length > 100 ? '...' : ''}"`)

    // Start Braintrust conversation span
    console.log('[Blooio] 📊 Starting Braintrust conversation span...')
    const conversationStartTime = Date.now()
    const conversationSpan = startConversationSpan({
      name: 'imessage_conversation',
      phoneNumber: fromNumber,
      userId: '',
      metadata: {
        message_preview: combinedMessage.substring(0, 100),
        message_length: combinedMessage.length,
        service: 'blooio',
      }
    })

    // Get or create user
    console.log('[Blooio] 👤 Getting or creating user...')
    const userId = await ChatStorage.getOrCreateUser(fromNumber)
    if (!userId) {
      console.error('[Blooio] ❌ Failed to get or create user!')
      conversationSpan?.end()
      return
    }
    console.log('[Blooio] ✅ User ID:', userId)

    // Load conversation history
    console.log('[Blooio] 📜 Loading conversation history...')
    const history = ChatStorage.formatForOpenAI(
      await ChatStorage.getConversationHistory(fromNumber, 10)
    )
    console.log(`[Blooio][${fromNumber}] ✅ History count: ${history.length}`)
    
    // Save user message
    console.log('[Blooio] 💾 Saving user message...')
    await ChatStorage.saveMessage(userId, 'user', combinedMessage, undefined, { identifierIsUserId: true })
    console.log('[Blooio] ✅ User message saved')

    // Load user profile and memories
    console.log('[Blooio] 👤 Loading user profile...')
    const userProfile = await UserProfileService.getUserProfile(fromNumber)
    console.log('[Blooio] 👤 User profile:', userProfile ? 'found' : 'not found')

    console.log('[Blooio] 🧠 Loading user memories...')
    const memorySystem = new SimpleMemorySystem()
    const userMemories = await memorySystem.getMemories(fromNumber)
    console.log('[Blooio] 🧠 Loaded', userMemories.length, 'memories')

    // Process with AI agent
    let aiResponse: string
    let agentError: string | undefined
    try {
      console.log('[Blooio] 🤖 Creating InteractionAgent...')
      const agent = new InteractionAgent({
        userId,
        phoneNumber: fromNumber,
        conversationHistory: history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        userProfile: userProfile ?? undefined,
        userMemories
      })

      console.log('[Blooio] 🤖 Processing message with AI...')
      aiResponse = await agent.processMessage(combinedMessage)
      console.log('[Blooio] ✅ AI response generated:', aiResponse.substring(0, 100))
    } catch (error) {
      console.error('[Blooio] ❌ Agent error:', error)
      if (error instanceof Error) {
        console.error('[Blooio] ❌ Error message:', error.message)
        console.error('[Blooio] ❌ Error stack:', error.stack)
        agentError = error.message
      }
      aiResponse = 'I am having trouble right now. Please try again in a moment.'
    }
    
    // End conversation span
    console.log('[Blooio] 📊 Logging to Braintrust...')
    if (conversationSpan) {
      conversationSpan.log({
        input: combinedMessage,
        output: aiResponse,
        metadata: {
          user_id: userId,
          phone_number: fromNumber,
          service: 'blooio',
          latency_ms: Date.now() - conversationStartTime,
        },
        error: agentError,
      })
      conversationSpan.end()
      console.log('[Blooio] ✅ Braintrust span ended')
    }

    // Save AI response
    console.log('[Blooio] 💾 Saving AI response...')
    await ChatStorage.saveMessage(userId, 'assistant', aiResponse, undefined, { identifierIsUserId: true })
    console.log('[Blooio] ✅ AI response saved')

    // Send response via Blooio
    console.log('[Blooio] 📤 Getting Blooio client...')
    const blooioClient = BlooioClient.getClient()
    if (blooioClient) {
      console.log('[Blooio] ✅ Blooio client configured')
      const messageChunks = splitIntoMessages(aiResponse)
      console.log(`[Blooio][${fromNumber}] 📤 Sending ${messageChunks.length} message(s)`)

      for (let i = 0; i < messageChunks.length; i++) {
        const chunk = messageChunks[i]
        console.log(`[Blooio][${fromNumber}] 📤 Sending chunk ${i + 1}/${messageChunks.length}: "${chunk.substring(0, 50)}..."`)

        try {
          const result = await blooioClient.sendMessage({
            to: fromNumber,
            content: chunk,
          })

          if (result.status === 'ERROR') {
            console.error(`[Blooio][${fromNumber}] ❌ Failed to send message:`, result.error)
            console.error(`[Blooio][${fromNumber}] ❌ Full error response:`, JSON.stringify(result, null, 2))
          } else {
            console.log(`[Blooio][${fromNumber}] ✅ Message sent: ${result.message_id}`)
          }
        } catch (sendError) {
          console.error(`[Blooio][${fromNumber}] ❌ Exception while sending:`, sendError)
          if (sendError instanceof Error) {
            console.error(`[Blooio][${fromNumber}] ❌ Error message:`, sendError.message)
            console.error(`[Blooio][${fromNumber}] ❌ Error stack:`, sendError.stack)
          }
        }
      }
    } else {
      console.error('[Blooio] ❌ Client not configured - cannot send response')
      console.error('[Blooio] ❌ BLOOIO_API_KEY:', process.env.BLOOIO_API_KEY ? 'present' : 'missing')
      console.error('[Blooio] ❌ BLOOIO_FROM_NUMBER:', process.env.BLOOIO_FROM_NUMBER ? 'present' : 'missing')
    }

    // Extract and store memories (already in background context)
    console.log('[Blooio] 🧠 Starting memory extraction...')
    try {
      const memoryExtractor = new SimpleMemorySystem()
      const memories = await memoryExtractor.extractMemories(combinedMessage, aiResponse)
      if (memories.length > 0) {
        console.log(`[Blooio][${fromNumber}] 🧠 Extracted ${memories.length} memories`)
        await memoryExtractor.storeMemories(fromNumber, memories)
        console.log(`[Blooio][${fromNumber}] ✅ Memories stored`)
      } else {
        console.log(`[Blooio][${fromNumber}] 🧠 No memories extracted`)
      }
    } catch (error) {
      console.error(`[Blooio][${fromNumber}] ❌ Memory extraction error:`, error)
    }

    // Flush Braintrust logs
    console.log('[Blooio] 📊 Flushing Braintrust logs...')
    await flushBraintrust()
    console.log('[Blooio] ✅ Braintrust logs flushed')

    console.log('[Blooio] ✅ Background processing completed')
    console.log('========================================')

  } catch (error) {
    console.error('========================================')
    console.error('[Blooio] ❌❌❌ BACKGROUND PROCESSING ERROR ❌❌❌')
    console.error('[Blooio] ❌ Error:', error)
    if (error instanceof Error) {
      console.error('[Blooio] ❌ Error name:', error.name)
      console.error('[Blooio] ❌ Error message:', error.message)
      console.error('[Blooio] ❌ Error stack:', error.stack)
    }
    console.error('========================================')
  }
}

/**
 * GET handler for health check
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Blooio webhook endpoint is active',
    status: 'ok'
  })
}

