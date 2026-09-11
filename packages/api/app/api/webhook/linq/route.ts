import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { ChatStorage } from '@/lib/chatStorage'
import { InteractionAgent } from '@/lib/agents/interactionAgent'
import { UserProfileService } from '@/lib/userProfile'
import { SimpleMemorySystem } from '@/lib/simpleMemory'
import { bufferMessage } from '@/lib/messageBuffer'
import { startConversationSpan, flushBraintrust } from '@/lib/braintrust'
import { parseLinqWebhook, LinqClient, verifyLinqWebhookSignature } from '@/lib/linq'
import { Vault } from '@/lib/vault'
import { composeMultimodalInput, ProcessedMediaResult } from '@/lib/mediaIngest'
import { scheduleFromMessage } from '@/lib/followups'
import { createChartDeliveryUrl, getChartDeliveryReason } from '@/lib/chartDelivery'
import { getConversationFastPath } from '@/lib/conversationFastPath'

// Normalize phone number to E.164 format
function normalizePhone(phone: string | null): string {
  if (!phone) return ''
  if (phone.includes('@')) return phone.trim().toLowerCase()
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
 * Linq webhook handler for receiving iMessages
 * POST /api/webhook/linq
 */
export async function POST(request: NextRequest) {
  console.log('========================================')
  console.log('[Linq] 🔔 WEBHOOK RECEIVED')
  console.log('[Linq] Timestamp:', new Date().toISOString())
  console.log('[Linq] URL:', request.url)
  console.log('[Linq] Method:', request.method)

  try {
    // Log all headers
    console.log('[Linq] 📋 Headers:')
    request.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`)
    })

    // Get raw body for signature verification
    const rawBody = await request.text()
    console.log('[Linq] 📦 Raw body length:', rawBody.length)
    console.log('[Linq] 📦 Raw body:', rawBody.substring(0, 500))

    // Linq uses the Standard Webhooks signing scheme. Keep unsigned local
    // simulation possible, but production must set LINQ_WEBHOOK_SECRET.
    const webhookSecret = process.env.LINQ_WEBHOOK_SECRET
    const signature = request.headers.get('webhook-signature')
    console.log('[Linq] 🔐 Signature header:', signature ? 'present' : 'missing')
    if (!webhookSecret && process.env.NODE_ENV === 'production') {
      console.error('[Linq] LINQ_WEBHOOK_SECRET is required in production')
      return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 })
    }
    if (webhookSecret && !verifyLinqWebhookSignature(rawBody, request.headers, webhookSecret)) {
      console.error('[Linq] Webhook signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    if (!webhookSecret) {
      console.warn('[Linq] LINQ_WEBHOOK_SECRET is missing - skipping signature verification')
    }

    // Parse both Linq's pinned 2026-02-03 webhook format and its
    // backwards-compatible 2025-01-01 format.
    let rawPayload: any
    try {
      rawPayload = JSON.parse(rawBody)
    } catch (parseError) {
      console.error('[Linq] ❌ Failed to parse JSON payload:', parseError)
      console.error('[Linq] ❌ Raw body was:', rawBody)
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const message = parseLinqWebhook(rawPayload)
    if (!message) {
      console.error('[Linq] ❌ Unrecognized payload shape:', rawBody.substring(0, 300))
      return NextResponse.json({ error: 'Unrecognized payload' }, { status: 400 })
    }
    console.log('[Linq] ✅ Payload parsed successfully')
    console.log('[Linq] 📨 Event type:', message.eventType)

    // Only process live inbound messages, not delivery updates, outbound
    // echoes, or historical messages recovered by Linq reconciliation.
    if (message.eventType !== 'message.received') {
      console.log(`[Linq] ⏭️  Ignoring event: ${message.eventType}`)
      console.log('========================================')
      return NextResponse.json({ status: 'ok' })
    }
    if (message.direction !== 'inbound') {
      console.log(`[Linq] ⏭️  Ignoring non-inbound message: ${message.direction}`)
      return NextResponse.json({ status: 'ok' })
    }
    if (message.isReconciled) {
      console.log('[Linq] ⏭️  Ignoring reconciled historical message')
      return NextResponse.json({ status: 'ok' })
    }

    const fromNumber = normalizePhone(message.sender)
    const messageBody = message.text

    console.log('[Linq] 📞 From (raw):', message.sender)
    console.log('[Linq] 📞 From (normalized):', fromNumber)
    console.log('[Linq] 📞 To:', message.recipient)
    console.log('[Linq] 💬 Message body:', messageBody)
    console.log('[Linq] 💬 Message length:', messageBody.length)

    const attachmentUrls = message.attachmentUrls
    console.log('[Linq] 📎 Attachments:', attachmentUrls.length)

    // A photo with no caption is a valid message - only reject when there is
    // nothing at all to work with.
    if (!fromNumber || !message.chatId || !message.eventId || (!messageBody && attachmentUrls.length === 0)) {
      console.error('[Linq] ❌ Missing required fields!')
      console.error('[Linq] ❌ fromNumber:', fromNumber)
      console.error('[Linq] ❌ chatId:', message.chatId)
      console.error('[Linq] ❌ eventId:', message.eventId)
      console.error('[Linq] ❌ messageBody:', messageBody)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log(`[Linq][${fromNumber}] ✅ Incoming: "${messageBody.substring(0, 50)}${messageBody.length > 50 ? '...' : ''}"`)
    console.log(`[Linq] 🆔 Event: ${message.eventType}, Message ID: ${message.messageId}, Service: ${message.service}`)

    // Acknowledge the webhook immediately and run the AI pipeline in the
    // background - the buffer wait + AI response can exceed the webhook timeout
    waitUntil(processInboundMessage(
      fromNumber,
      messageBody,
      attachmentUrls,
      message.chatId,
      message.eventId,
      request.nextUrl.origin,
    ))

    console.log('[Linq] ✅ Webhook acknowledged, processing in background')
    console.log('========================================')
    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('========================================')
    console.error('[Linq] ❌❌❌ WEBHOOK ERROR ❌❌❌')
    console.error('[Linq] ❌ Error:', error)
    if (error instanceof Error) {
      console.error('[Linq] ❌ Error name:', error.name)
      console.error('[Linq] ❌ Error message:', error.message)
      console.error('[Linq] ❌ Error stack:', error.stack)
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
async function processInboundMessage(
  fromNumber: string,
  messageBody: string,
  attachmentUrls: string[],
  chatId: string,
  linqEventId: string,
  requestOrigin: string,
): Promise<void> {
  try {
    // Log the raw inbound event before anything interprets it, so extraction
    // can always be rerun against what actually arrived.
    const eventId = await Vault.logInbound({
      phoneNumber: fromNumber,
      source: 'imessage',
      text: messageBody || undefined,
      mediaUrls: attachmentUrls,
    })
    console.log('[Linq] 📥 Event logged:', eventId || 'failed')

    // Buffer the message - waits 1.5s for additional messages before processing
    console.log('[Linq] 🔄 Starting message buffer...')
    const bufferResult = bufferMessage(fromNumber, messageBody)

    if (!bufferResult.isFirst) {
      console.log(`[Linq][${fromNumber}] ⏸️  Message buffered into existing batch`)
      return
    }

    // This is the first message - wait for the buffer to complete
    console.log('[Linq] ⏳ Waiting for buffer to complete (1.5s)...')
    const combinedMessage = await bufferResult.promise
    console.log('[Linq] ✅ Buffer complete')

    console.log(`[Linq][${fromNumber}] 🚀 Processing combined message: "${combinedMessage.substring(0, 100)}${combinedMessage.length > 100 ? '...' : ''}"`)

    // Start Braintrust conversation span
    console.log('[Linq] 📊 Starting Braintrust conversation span...')
    const conversationStartTime = Date.now()
    const conversationSpan = startConversationSpan({
      name: 'imessage_conversation',
      phoneNumber: fromNumber,
      userId: '',
      metadata: {
        message_preview: combinedMessage.substring(0, 100),
        message_length: combinedMessage.length,
        service: 'linq',
      }
    })

    // Get or create user
    console.log('[Linq] 👤 Getting or creating user...')
    const userId = await ChatStorage.getOrCreateUser(fromNumber)
    if (!userId) {
      console.error('[Linq] ❌ Failed to get or create user!')
      conversationSpan?.end()
      return
    }
    console.log('[Linq] ✅ User ID:', userId)

    // Load conversation history
    console.log('[Linq] 📜 Loading conversation history...')
    const history = ChatStorage.formatForOpenAI(
      await ChatStorage.getConversationHistory(fromNumber, 10)
    )
    console.log(`[Linq][${fromNumber}] ✅ History count: ${history.length}`)

    // Understand attachments before saving or replying. A voice transcript is
    // user-authored content, so it must enter history, retrieval, reminders,
    // and memory extraction exactly like typed text.
    let mediaResult: ProcessedMediaResult = { visualSummaries: [], transcripts: [], failedCount: 0 }
    if (attachmentUrls.length > 0) {
      console.log('[Linq] 🖼️  Analyzing media and voice notes...')
      try {
        mediaResult = await Vault.processMedia({
          phoneNumber: fromNumber,
          mediaUrls: attachmentUrls,
          text: combinedMessage,
          eventId,
        })
        console.log('[Linq] 🖼️  Media understood:', {
          visuals: mediaResult.visualSummaries.length,
          voiceNotes: mediaResult.transcripts.length,
          failed: mediaResult.failedCount,
        })
      } catch (error) {
        console.error('[Linq] ❌ Media analysis error:', error)
        mediaResult.failedCount = attachmentUrls.length
      }
    }
    const multimodal = composeMultimodalInput(combinedMessage, mediaResult)
    const fastPathReply = getConversationFastPath(multimodal.agentMessage)

    console.log('[Linq] 💾 Saving user message...')
    await ChatStorage.saveMessage(userId, 'user', multimodal.historyMessage, undefined, { identifierIsUserId: true })
    console.log('[Linq] ✅ User message saved')

    // Load user profile and memories
    console.log('[Linq] 👤 Loading user profile...')
    const userProfile = await UserProfileService.getUserProfile(fromNumber)
    console.log('[Linq] 👤 User profile:', userProfile ? 'found' : 'not found')

    console.log('[Linq] 🧠 Loading user memories...')
    const memorySystem = new SimpleMemorySystem()
    const userMemories = fastPathReply
      ? []
      : await memorySystem.getMemories(fromNumber, 10, multimodal.effectiveMessage || undefined)
    console.log('[Linq] 🧠 Loaded', userMemories.length, 'memories')

    // Process with AI agent
    let aiResponse: string
    let agentError: string | undefined
    try {
      if (fastPathReply) {
        console.log('[Linq] 🤖 Bare greeting fast path')
        aiResponse = fastPathReply
      } else {
        console.log('[Linq] 🤖 Creating InteractionAgent...')
        const agent = new InteractionAgent({
          userId,
          phoneNumber: fromNumber,
          conversationHistory: history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          userProfile: userProfile ?? undefined,
          userMemories
        })

        console.log('[Linq] 🤖 Processing message with AI...')
        aiResponse = await agent.processMessage(multimodal.agentMessage)
      }
      console.log('[Linq] ✅ AI response generated:', aiResponse.substring(0, 100))
    } catch (error) {
      console.error('[Linq] ❌ Agent error:', error)
      if (error instanceof Error) {
        console.error('[Linq] ❌ Error message:', error.message)
        console.error('[Linq] ❌ Error stack:', error.stack)
        agentError = error.message
      }
      aiResponse = 'I am having trouble right now. Please try again in a moment.'
    }

    // End conversation span
    console.log('[Linq] 📊 Logging to Braintrust...')
    if (conversationSpan) {
      conversationSpan.log({
        input: multimodal.agentMessage,
        output: aiResponse,
        metadata: {
          user_id: userId,
          phone_number: fromNumber,
          service: 'linq',
          latency_ms: Date.now() - conversationStartTime,
        },
        error: agentError,
      })
      conversationSpan.end()
      console.log('[Linq] ✅ Braintrust span ended')
    }

    // Save AI response
    console.log('[Linq] 💾 Saving AI response...')
    await ChatStorage.saveMessage(userId, 'assistant', aiResponse, undefined, { identifierIsUserId: true })
    console.log('[Linq] ✅ AI response saved')

    // The first horoscope reveal, a newly-computed chart, or an explicit
    // "show my chart" gets the verified wheel as an iMessage PNG attachment.
    // Linq downloads this short-lived signed URL before sending the media part.
    const updatedProfile = await UserProfileService.getUserProfile(fromNumber)
    const chartDeliveryReason = agentError
      ? null
      : getChartDeliveryReason(userProfile, updatedProfile, multimodal.effectiveMessage)
    let chartMediaUrl: string | undefined
    if (chartDeliveryReason) {
      try {
        chartMediaUrl = createChartDeliveryUrl(requestOrigin, fromNumber)
        console.log(`[Linq] 🪐 Chart attachment prepared (${chartDeliveryReason})`)
      } catch (error) {
        console.error('[Linq] ❌ Could not create signed chart URL:', error)
      }
    }

    // Send response via Linq
    console.log('[Linq] 📤 Getting Linq client...')
    const linqClient = LinqClient.getClient()
    if (linqClient) {
      console.log('[Linq] ✅ Linq client configured')
      const messageChunks = splitIntoMessages(aiResponse)
      console.log(`[Linq][${fromNumber}] 📤 Sending ${messageChunks.length} message(s)`)
      let chartAttachmentAccepted = false

      for (let i = 0; i < messageChunks.length; i++) {
        const chunk = messageChunks[i]
        const mediaUrl = i === 0 ? chartMediaUrl : undefined
        console.log(`[Linq][${fromNumber}] 📤 Sending chunk ${i + 1}/${messageChunks.length}: "${chunk.substring(0, 50)}..."`)

        try {
          const result = await linqClient.sendMessage({
            to: fromNumber,
            content: chunk,
            mediaUrl,
            chatId,
            idempotencyKey: linqEventId ? `${linqEventId}:reply:${i}` : undefined,
          })

          if (result.status === 'ERROR') {
            console.error(`[Linq][${fromNumber}] ❌ Failed to send message:`, result.error)
            console.error(`[Linq][${fromNumber}] ❌ Full error response:`, JSON.stringify(result, null, 2))
          } else {
            console.log(`[Linq][${fromNumber}] ✅ Message sent: ${result.message_id}`)
            if (mediaUrl) chartAttachmentAccepted = true
          }
        } catch (sendError) {
          console.error(`[Linq][${fromNumber}] ❌ Exception while sending:`, sendError)
          if (sendError instanceof Error) {
            console.error(`[Linq][${fromNumber}] ❌ Error message:`, sendError.message)
            console.error(`[Linq][${fromNumber}] ❌ Error stack:`, sendError.stack)
          }
        }
      }

      if (chartAttachmentAccepted && !updatedProfile?.chart_introduced_at) {
        const marked = await UserProfileService.markChartIntroduced(fromNumber)
        console.log(`[Linq] 🪐 Chart introduction recorded: ${marked}`)
      }
    } else {
      console.error('[Linq] ❌ Client not configured - cannot send response')
      console.error('[Linq] ❌ LINQ_API_KEY:', process.env.LINQ_API_KEY ? 'present' : 'missing')
    }

    // Build the vault from any links they shared. Runs after the reply is sent
    // because watching a video takes seconds and must never delay the response.
    console.log('[Linq] 🔗 Checking for shareable links...')
    try {
      const savedCount = await Vault.processLinks({
        phoneNumber: fromNumber,
        text: multimodal.effectiveMessage,
        eventId,
      })
      if (savedCount > 0) {
        console.log(`[Linq][${fromNumber}] 🔗 Vault updated with ${savedCount} place(s)`)
      }
    } catch (error) {
      console.error(`[Linq][${fromNumber}] ❌ Link processing error:`, error)
    }

    // Schedule follow-ups for anything they said is coming up
    try {
      const n = multimodal.effectiveMessage && !fastPathReply
        ? await scheduleFromMessage({ phoneNumber: fromNumber, message: multimodal.effectiveMessage, eventId })
        : 0
      if (n > 0) console.log(`[Linq][${fromNumber}] 📅 Scheduled ${n} follow-up(s)`)
    } catch (error) {
      console.error(`[Linq][${fromNumber}] ❌ Follow-up scheduling error:`, error)
    }

    // Extract and store memories (already in background context)
    console.log('[Linq] 🧠 Starting memory extraction...')
    try {
      const memoryExtractor = new SimpleMemorySystem()
      const memories = multimodal.effectiveMessage && !fastPathReply
        ? await memoryExtractor.extractMemories(
            multimodal.effectiveMessage,
            aiResponse,
            fromNumber,
            eventId
          )
        : []
      if (memories.length > 0) {
        console.log(`[Linq][${fromNumber}] 🧠 Extracted ${memories.length} memories`)
        await memoryExtractor.storeMemories(fromNumber, memories)
        console.log(`[Linq][${fromNumber}] ✅ Memories stored`)
      } else {
        console.log(`[Linq][${fromNumber}] 🧠 No memories extracted`)
      }
    } catch (error) {
      console.error(`[Linq][${fromNumber}] ❌ Memory extraction error:`, error)
    }

    // Flush Braintrust logs
    console.log('[Linq] 📊 Flushing Braintrust logs...')
    await flushBraintrust()
    console.log('[Linq] ✅ Braintrust logs flushed')

    console.log('[Linq] ✅ Background processing completed')
    console.log('========================================')

  } catch (error) {
    console.error('========================================')
    console.error('[Linq] ❌❌❌ BACKGROUND PROCESSING ERROR ❌❌❌')
    console.error('[Linq] ❌ Error:', error)
    if (error instanceof Error) {
      console.error('[Linq] ❌ Error name:', error.name)
      console.error('[Linq] ❌ Error message:', error.message)
      console.error('[Linq] ❌ Error stack:', error.stack)
    }
    console.error('========================================')
  }
}

/**
 * GET handler for health check
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Linq webhook endpoint is active',
    status: 'ok'
  })
}
