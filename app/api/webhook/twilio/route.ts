import { NextRequest, NextResponse } from 'next/server'
import { UserProfileService } from '@/lib/supabase'
import { ChatStorage } from '@/lib/chatStorage'
import { addLog } from '@/lib/logger'
import OpenAI from 'openai'

// Verify that the request came from Twilio
function validateTwilioSignature(request: NextRequest, body: string): boolean {
  const signature = request.headers.get('x-twilio-signature')
  const url = request.url
  
  if (!signature || !process.env.TWILIO_AUTH_TOKEN) {
    return false
  }

  // Skip signature validation in development when Twilio credentials are not set
  if (process.env.NODE_ENV === 'development' && process.env.TWILIO_AUTH_TOKEN === 'your_twilio_auth_token_here') {
    return true
  }

  // For production, you would import twilio here and validate
  // const twilio = require('twilio')
  // return twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, body)
  
  return true // Skip validation for now
}

// Store conversation state (in production, use a database like Redis or PostgreSQL)
const conversationState = new Map<string, {
  history: Array<{ role: 'user' | 'assistant', content: string }>
  userProfile?: {
    name?: string
    starSign?: string
    dateOfBirth?: string
    timeOfBirth?: string
    placeOfBirth?: string
  }
}>()

export async function POST(request: NextRequest) {
  // Log immediately - this should ALWAYS run if function is called
  console.log('\n' + '='.repeat(80))
  console.log('=== WEBHOOK FUNCTION CALLED ===')
  console.log('Time:', new Date().toISOString())
  console.log('URL:', request.url)
  console.log('Method:', request.method)
  console.log('='.repeat(80))
  
  const timestamp = new Date().toISOString()
  console.log('\n' + '='.repeat(80))
  console.log('STEP 1: TEXT RECEIVED FROM TWILIO')
  console.log('='.repeat(80))
  console.log('Timestamp:', timestamp)
  console.log('='.repeat(80))
  
  try {
    addLog('info', '=== TWILIO WEBHOOK RECEIVED ===', { timestamp, url: request.url })
  } catch (e) {
    console.log('Warning: addLog failed, continuing anyway:', e)
  }
  
  try {
    // Parse the Twilio webhook data
    const body = await request.text()
    console.log('\n📥 RAW WEBHOOK BODY:')
    console.log(body)
    console.log('Body length:', body.length)
    console.log('Body type:', typeof body)
    console.log('\n📊 PARSED WEBHOOK DATA:')
    addLog('debug', 'Raw webhook body received', { bodyLength: body.length, body: body.substring(0, 200) })
    
    // Validate the request came from Twilio (optional but recommended)
    if (process.env.NODE_ENV === 'production') {
      if (!validateTwilioSignature(request, body)) {
        addLog('error', 'Invalid Twilio signature')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    
    // Parse the form data
    const params = new URLSearchParams(body)
    const fromNumber = params.get('From')
    const messageBody = params.get('Body')
    const toNumber = params.get('To')
    const messageSid = params.get('MessageSid')
    const accountSid = params.get('AccountSid')
    
    // Log all params for debugging
    console.log('All Twilio params:')
    Array.from(params.entries()).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`)
    })
    
    // Check if this is a WhatsApp message
    const isWhatsApp = fromNumber?.startsWith('whatsapp:')
    
    console.log('STEP 1 CONTINUED: PARSED MESSAGE DATA')
    console.log('From:', fromNumber)
    console.log('To:', toNumber)
    console.log('Message Body:', messageBody)
    console.log('Message Body type:', typeof messageBody)
    console.log('Message Body length:', messageBody?.length)
    console.log('Is WhatsApp:', isWhatsApp)
    console.log('='.repeat(80))
    
    addLog('info', 'Incoming message details', { 
      from: fromNumber, 
      to: toNumber,
      messageSid,
      accountSid,
      messageBody: messageBody?.substring(0, 100),
      isWhatsApp,
      timestamp: new Date().toISOString()
    })
    
    if (!fromNumber) {
      console.error('ERROR: fromNumber is missing')
      console.error('All params:', Object.fromEntries(params.entries()))
      addLog('error', 'Missing required field: From')
      return NextResponse.json({ error: 'Missing required field: From' }, { status: 400 })
    }
    
    if (!messageBody) {
      console.error('ERROR: messageBody (Body) is missing')
      console.error('All params:', Object.fromEntries(params.entries()))
      addLog('error', 'Missing required field: Body')
      return NextResponse.json({ error: 'Missing required field: Body' }, { status: 400 })
    }

    // Load conversation history from Supabase
    console.log('💾 Loading conversation history from Supabase...')
    const conversationHistory = await ChatStorage.getConversationHistory(fromNumber, 10)
    addLog('info', 'Loaded conversation history from Supabase', { messageCount: conversationHistory.length })
    
    // Convert to OpenAI format
    const history = ChatStorage.formatForOpenAI(conversationHistory)
    
    // Get or create conversation state for this user (keep for in-memory profile)
    let userState = conversationState.get(fromNumber)
    if (!userState) {
      userState = { history: [] }
      conversationState.set(fromNumber, userState)
      console.log('🆕 Created new in-memory state for:', fromNumber)
    }
    
    // Save user message to Supabase
    console.log('\n💾 SAVING USER MESSAGE TO SUPABASE...')
    console.log('Phone:', fromNumber)
    console.log('Message:', messageBody)
    const savedUserMessage = await ChatStorage.saveMessage(fromNumber, 'user', messageBody)
    if (savedUserMessage) {
      console.log('✅ User message saved to Supabase')
      console.log('Message ID:', savedUserMessage.id)
      console.log('Session ID:', savedUserMessage.session_id)
      addLog('info', '✅ User message saved to Supabase', { 
        messageId: savedUserMessage.id,
        sessionId: savedUserMessage.session_id,
        phone: fromNumber
      })
    } else {
      console.log('❌ FAILED to save user message to Supabase')
      console.error('ChatStorage.saveMessage returned null')
      addLog('error', 'Failed to save user message to Supabase', { phone: fromNumber })
    }
    
    // Add user message to history for API call
    history.push({ role: 'user', content: messageBody })

    // Extract and store user profile information if present
    const birthDetails = UserProfileService.extractBirthDetails(messageBody)
    if (Object.keys(birthDetails).length > 0) {
      console.log('🔍 Extracted birth details:', birthDetails)
      addLog('info', 'Extracted birth details from message', birthDetails)
      
      // Load existing profile from Supabase
      const existingProfile = await UserProfileService.getProfile(fromNumber)
      
      // Merge with existing data
      const updatedProfile = {
        phone_number: fromNumber,
        ...existingProfile,
        ...birthDetails
      }
      
      // Save to Supabase
      console.log('\n💾 SAVING USER PROFILE TO SUPABASE...')
      console.log('Profile data:', JSON.stringify(updatedProfile, null, 2))
      const savedProfile = await UserProfileService.upsertProfile(updatedProfile)
      if (savedProfile) {
        console.log('✅ USER PROFILE SAVED TO SUPABASE')
        console.log('Profile ID:', savedProfile.id)
        console.log('Phone:', savedProfile.phone_number)
        console.log('Name:', savedProfile.name)
        console.log('DOB:', savedProfile.date_of_birth)
        addLog('info', '✅ User profile saved to Supabase', { 
          id: savedProfile.id, 
          phone: fromNumber,
          name: savedProfile.name,
          dob: savedProfile.date_of_birth
        })
        userState.userProfile = savedProfile
      } else {
        console.log('❌ FAILED TO SAVE USER PROFILE')
        console.error('UserProfileService.upsertProfile returned null')
        addLog('error', '❌ Failed to save user profile to Supabase', { phone: fromNumber })
      }
    } else {
      // Try to load existing profile from Supabase if we don't have it in memory
      if (!userState.userProfile) {
        const existingProfile = await UserProfileService.getProfile(fromNumber)
        if (existingProfile) {
          console.log('✅ Loaded existing profile from Supabase for:', fromNumber)
          addLog('info', '✅ Loaded existing profile from Supabase', { phone: fromNumber })
          userState.userProfile = existingProfile
        }
      }
    }

    // Call OpenRouter directly (no internal fetch to avoid serverless→serverless issues)
    console.log('\n' + '='.repeat(80))
    console.log('STEP 2: CALLING OPENROUTER API DIRECTLY')
    console.log('='.repeat(80))
    console.log('User Message:', messageBody)
    console.log('History length:', history.length)
    console.log('Timestamp:', new Date().toISOString())
    console.log('='.repeat(80))
    
    let aiResponse: string
    
    try {
      // Initialize OpenRouter client with shorter timeout for Vercel
      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error('OpenRouter API key is not configured')
      }
      
      const openai = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        maxRetries: 1, // Reduce retries for faster failure
        timeout: 10000, // 10 second timeout (Vercel limit)
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://aiastrologer.vercel.app',
          'X-Title': 'AI Astrologer SMS Bot'
        },
      })
      
      // Prepare system prompt
      const systemPrompt = `You are Pinch, an AI astrologer that behaves like a real astrologer.

IMPORTANT: 
1. As soon as the user asks for advice, you should ask for the user's name, date of birth, time of
birth, and place of birth before providing any responses. Store this information and NEVER ask for it again.
2. Whenever the user asks for advice, you always reference specific
astrological data as evidence. 
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

      // Build messages array
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...history,
        { role: 'user' as const, content: messageBody }
      ]
      
      console.log('Sending request to OpenRouter API...')
      console.log('Model: openai/gpt-4o-mini')
      console.log('Message count:', messages.length)
      
      const startTime = Date.now()
      const completion = await openai.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages,
        max_tokens: 1000,
        temperature: 1,
      })
      const duration = Date.now() - startTime
      
      console.log(`OpenRouter API responded in ${duration}ms`)
      console.log('Finish reason:', completion.choices[0]?.finish_reason)
      
      const assistantMessage = completion.choices[0]?.message
      aiResponse = assistantMessage?.content || ''
      
      if (!aiResponse) {
        console.error('No response content from OpenRouter')
        aiResponse = 'sorry, i had trouble processing that. can you try again?'
      } else {
        console.log('Response length:', aiResponse.length)
        console.log('Response preview:', aiResponse.substring(0, 100))
      }
      
    } catch (error) {
      console.error('\n❌ OPENROUTER API ERROR')
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error)
      console.error('Error message:', error instanceof Error ? error.message : String(error))
      
      // Log error but don't throw - return safe fallback instead
      addLog('error', 'OpenRouter API error', {
        type: error instanceof Error ? error.constructor.name : typeof error,
        message: error instanceof Error ? error.message : String(error)
      })
      
      // Return safe fallback message instead of throwing
      aiResponse = 'sorry, im having trouble right now. can you try again in a moment?'
    }
    
    console.log('\n' + '='.repeat(80))
    console.log('STEP 3: RESPONSE RECEIVED FROM OPENROUTER')
    console.log('='.repeat(80))
    console.log('Response:', aiResponse)
    console.log('='.repeat(80))
    addLog('info', 'AI response received', { length: aiResponse?.length || 0 })

    // Save AI response to Supabase (non-blocking - don't fail if this errors)
    try {
      console.log('\n💾 SAVING AI RESPONSE TO SUPABASE...')
      const savedAiMessage = await ChatStorage.saveMessage(fromNumber, 'assistant', aiResponse)
      if (savedAiMessage) {
        console.log('✅ AI response saved to Supabase')
        console.log('Message ID:', savedAiMessage.id)
        addLog('info', '✅ AI response saved to Supabase', { messageId: savedAiMessage.id })
      } else {
        console.log('⚠️ Failed to save AI response (non-critical)')
      }
    } catch (saveError) {
      console.error('⚠️ Error saving AI response (non-critical):', saveError)
      // Don't throw - continue to send response to user
    }

    // Send response back using TwiML
    console.log('\n' + '='.repeat(80))
    console.log('STEP 4: SENDING RESPONSE BACK TO USER VIA TWILIO')
    console.log('='.repeat(80))
    console.log('Type:', isWhatsApp ? 'WhatsApp' : 'SMS')
    console.log('To:', fromNumber)
    console.log('Response Length:', aiResponse?.length || 0)
    console.log('Response Preview:', aiResponse?.substring(0, 100))
    console.log('Timestamp:', new Date().toISOString())
    console.log('='.repeat(80))
    addLog('info', `Sending ${isWhatsApp ? 'WhatsApp' : 'SMS'} response`, { 
      messagePreview: aiResponse?.substring(0, 50) 
    })
    
    // Return TwiML response that tells Twilio to send the message back
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${aiResponse}</Message>
</Response>`
    
    console.log('\n✅ ALL STEPS COMPLETE - MESSAGE SENT TO USER')
    console.log('='.repeat(80))
    console.log('TwiML Response Length:', twimlResponse.length)
    console.log('='.repeat(80) + '\n')
    
    return new NextResponse(twimlResponse, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml'
      }
    })

  } catch (error) {
    console.log('\n❌ WEBHOOK ERROR!')
    console.error('Error Type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('Error Message:', error instanceof Error ? error.message : String(error))
    console.error('Error Stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.log('='.repeat(80) + '\n')
    
    addLog('error', 'WEBHOOK ERROR', {
      type: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    
    // Return TwiML error message so user knows something went wrong
    const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>sorry, something went wrong. please try again in a moment.</Message>
</Response>`
    
    return new NextResponse(errorTwiML, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml'
      }
    })
  }
}

// Handle GET requests (for webhook verification and testing)
export async function GET(request: NextRequest) {
  console.log('\n' + '='.repeat(80))
  console.log('=== WEBHOOK GET REQUEST (TEST) ===')
  console.log('URL:', request.url)
  console.log('Query params:', Object.fromEntries(new URL(request.url).searchParams.entries()))
  console.log('Timestamp:', new Date().toISOString())
  console.log('='.repeat(80) + '\n')
  
  return NextResponse.json({ 
    message: 'Twilio webhook endpoint is active',
    url: request.url,
    timestamp: new Date().toISOString(),
    status: 'ok'
  })
}