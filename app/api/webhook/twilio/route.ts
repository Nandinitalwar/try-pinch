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

// Meaningful chunking that preserves natural content boundaries
function chunkMessage(message: string, maxLength: number = 1400): string[] {
  if (message.length <= maxLength) {
    return [message]
  }
  
  const chunks: string[] = []
  
  // Split by double line breaks first (natural topic/section boundaries)
  const sections = message.split('\n\n').filter(s => s.trim())
  
  let currentChunk = ''
  
  for (const section of sections) {
    const potentialChunk = currentChunk ? currentChunk + '\n\n' + section : section
    
    // If adding this section would exceed limit, save current chunk
    if (potentialChunk.length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim())
      currentChunk = section
    } else {
      currentChunk = potentialChunk
    }
    
    // If single section is too long, split by sentences at natural points
    if (currentChunk.length > maxLength) {
      const sentenceChunks = splitBySentences(currentChunk, maxLength)
      
      // Add all but the last chunk
      for (let i = 0; i < sentenceChunks.length - 1; i++) {
        chunks.push(sentenceChunks[i].trim())
      }
      
      // Keep the last chunk as current
      currentChunk = sentenceChunks[sentenceChunks.length - 1] || ''
    }
  }
  
  // Add remaining content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks.filter(chunk => chunk.length > 0)
}

// Split text by sentences while preserving meaning
function splitBySentences(text: string, maxLength: number): string[] {
  const chunks: string[] = []
  
  // Split by sentence endings but keep the punctuation
  const sentences = text.split(/(?<=[.!?])\s+/)
  
  let currentChunk = ''
  
  for (const sentence of sentences) {
    const potentialChunk = currentChunk ? currentChunk + ' ' + sentence : sentence
    
    if (potentialChunk.length <= maxLength) {
      currentChunk = potentialChunk
    } else {
      if (currentChunk) {
        chunks.push(currentChunk)
      }
      currentChunk = sentence
      
      // If single sentence is still too long, split it forcefully at word boundaries
      if (currentChunk.length > maxLength) {
        const words = currentChunk.split(' ')
        let wordChunk = ''
        
        for (const word of words) {
          if ((wordChunk + ' ' + word).length <= maxLength) {
            wordChunk = wordChunk ? wordChunk + ' ' + word : word
          } else {
            if (wordChunk) {
              chunks.push(wordChunk)
            }
            wordChunk = word
          }
        }
        
        currentChunk = wordChunk
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk)
  }
  
  return chunks
}

// Fix WhatsApp text formatting to preserve intended meaning
function fixWhatsAppFormatting(text: string): string {
  let fixed = text
  
  // Only fix strikethrough pattern (~text~) as it often changes meaning unintentionally
  // Keep bold (*text*) and italic (_text_) as they're usually intentional formatting
  
  // Fix strikethrough - add spaces to break the pattern
  fixed = fixed.replace(/~([^~\s][^~]*[^~\s])~/g, '~ $1 ~')
  
  // Fix edge case where single characters get strikethrough
  fixed = fixed.replace(/~(\w)~/g, '~ $1 ~')
  
  return fixed
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const params = new URLSearchParams(body)
    
    const fromNumberRaw = params.get('From')
    const toNumberRaw = params.get('To') // This is the Twilio number that received the message
    const fromNumber = normalizePhone(fromNumberRaw)
    const messageBody = params.get('Body')
    const messageStatus = params.get('MessageStatus')
    const smsStatus = params.get('SmsStatus')
    const messageSid = params.get('MessageSid') // Required for typing indicator
    
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
    
    // Fix WhatsApp formatting issues to preserve intended meaning
    aiResponse = fixWhatsAppFormatting(aiResponse)
    
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
    
    // Detect if this is a WhatsApp message
    const isWhatsApp = fromNumberRaw?.startsWith('whatsapp:') || false
    console.log(`[Webhook] Detected WhatsApp: ${isWhatsApp}, Original from: ${fromNumberRaw}, Original to: ${toNumberRaw}`)
    
    // Use the "To" parameter from the webhook as the sender ID (this is what Twilio uses in TwiML)
    // This ensures we use the exact same sender ID that Twilio would use automatically
    let twilioPhoneNumber: string | null = null
    if (toNumberRaw) {
      // Extract the phone number from the To parameter (may have whatsapp: prefix)
      const toNumberNormalized = normalizePhone(toNumberRaw)
      if (toNumberNormalized) {
        twilioPhoneNumber = toNumberNormalized
      }
    }
    
    // Fallback to environment variable if To parameter not available
    if (!twilioPhoneNumber) {
      const envWhatsAppId = process.env.TWILIO_WHATSAPP_SENDER_ID || null
      const envPhoneNumber = process.env.TWILIO_PHONE_NUMBER || null
      
      twilioPhoneNumber = isWhatsApp 
        ? (envWhatsAppId || envPhoneNumber)
        : envPhoneNumber
      
      if (isWhatsApp && !envWhatsAppId) {
        console.warn('[Webhook] Warning: Using fallback TWILIO_PHONE_NUMBER for WhatsApp (To parameter not available)')
      }
    }
    
    console.log(`[Webhook] Using sender ID: ${twilioPhoneNumber} (WhatsApp: ${isWhatsApp})`)
    
    if (twilioClientInstance && twilioPhoneNumber && twilioPhoneNumber.trim()) {
      try {
        // Use meaningful chunking for longer responses
        const chunks = chunkMessage(aiResponse, 1400)
        
        const toNumber = isWhatsApp ? `whatsapp:+${fromNumber}` : `+${fromNumber}`
        const fromFormatted = twilioPhoneNumber.startsWith('+') ? twilioPhoneNumber : `+${twilioPhoneNumber}`
        const fromNumber_formatted = isWhatsApp ? `whatsapp:${fromFormatted}` : fromFormatted

        console.log(`[Webhook] Sending ${chunks.length} meaningful chunk(s) to ${fromNumber} (${aiResponse.length} total chars)`)
        
        // Send each chunk with a brief delay
        for (let i = 0; i < chunks.length; i++) {
          console.log(`[Webhook] Sending chunk ${i + 1}/${chunks.length}: ${chunks[i].length} chars`)
          
          await twilioClientInstance.messages.create({
            body: chunks[i],
            from: fromNumber_formatted,
            to: toNumber
          })
          
          // Brief delay between chunks (only if multiple)
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 800))
          }
        }
        
        console.log(`[Webhook] Sent ${chunks.length} chunk(s) to ${fromNumber}`)
        
        // Return empty TwiML response since we sent message directly
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
          { status: 200, headers: { 'Content-Type': 'text/xml' } }
        )
      } catch (error) {
        console.error('Failed to send message:', error)
        // Fall through to TwiML response
      }
    } else {
      console.log('[Webhook] Twilio not configured, using TwiML response')
    }
    
    // Fallback to TwiML response (when direct messaging isn't available)
    // Use first meaningful chunk only for TwiML
    const chunks = chunkMessage(aiResponse, 1400)
    const firstChunk = chunks[0] || aiResponse
    
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${firstChunk}</Message></Response>`,
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
