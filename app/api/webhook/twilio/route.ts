import { NextRequest, NextResponse } from 'next/server'
import { UserProfileService } from '@/lib/supabase'
import { ChatStorage } from '@/lib/chatStorage'
import { addLog } from '@/lib/logger'

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
    for (const [key, value] of params.entries()) {
      console.log(`  ${key}: ${value}`)
    }
    
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

    // Call the chat API to get AI response
    console.log('\n' + '='.repeat(80))
    console.log('STEP 2: SENDING REQUEST TO OPENROUTER API')
    console.log('='.repeat(80))
    const chatApiUrl = `${request.url.split('/api/webhook')[0]}/api/chat`
    console.log('Chat API URL:', chatApiUrl)
    console.log('User Message:', messageBody)
    console.log('History length:', history.length)
    console.log('Timestamp:', new Date().toISOString())
    console.log('='.repeat(80))
    addLog('debug', 'Calling chat API', { hasUserProfile: !!userState.userProfile })
    
    const chatRequestStart = Date.now()
    const chatResponse = await fetch(chatApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: messageBody,
        history: history, // Using Supabase history instead of in-memory
        phoneNumber: fromNumber,
        userProfile: userState.userProfile
      })
    })
    const chatRequestDuration = Date.now() - chatRequestStart

    console.log('Chat API response status:', chatResponse.status)
    console.log('Chat API response time:', chatRequestDuration + 'ms')

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text()
      console.log('\n❌ CHAT API ERROR RESPONSE')
      console.log('='.repeat(80))
      console.log('Status:', chatResponse.status)
      console.log('Status Text:', chatResponse.statusText)
      console.log('Error text:', errorText)
      console.log('Response headers:', Object.fromEntries(chatResponse.headers.entries()))
      console.log('='.repeat(80) + '\n')
      addLog('error', 'Chat API error', { status: chatResponse.status, error: errorText })
      
      // Try to parse error as JSON for more details
      try {
        const errorJson = JSON.parse(errorText)
        console.log('Parsed error JSON:', errorJson)
      } catch (e) {
        console.log('Error text is not JSON')
      }
      
      throw new Error(`Chat API error: ${chatResponse.status} - ${errorText}`)
    }

    const chatData = await chatResponse.json()
    const aiResponse = chatData.response
    
    if (!aiResponse) {
      console.log('\n' + '='.repeat(80))
      console.log('STEP 3 ERROR: NO RESPONSE FROM OPENROUTER')
      console.log('='.repeat(80))
      console.log('Chat data received:', JSON.stringify(chatData, null, 2))
      console.log('='.repeat(80) + '\n')
      throw new Error('No response from chat API')
    }
    
    console.log('\n' + '='.repeat(80))
    console.log('STEP 3: RESPONSE RECEIVED FROM OPENROUTER')
    console.log('='.repeat(80))
    console.log('Response length:', aiResponse.length)
    console.log('Response:', aiResponse)
    console.log('Timestamp:', new Date().toISOString())
    console.log('='.repeat(80))
    addLog('info', 'AI response received', { length: aiResponse?.length || 0 })

    // Save AI response to Supabase
    console.log('\n💾 SAVING AI RESPONSE TO SUPABASE...')
    const savedAiMessage = await ChatStorage.saveMessage(fromNumber, 'assistant', aiResponse)
    if (savedAiMessage) {
      console.log('✅ AI response saved to Supabase')
      console.log('Message ID:', savedAiMessage.id)
      addLog('info', '✅ AI response saved to Supabase', { messageId: savedAiMessage.id })
    } else {
      console.log('❌ FAILED to save AI response')
      addLog('error', 'Failed to save AI response to Supabase')
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