import { NextRequest, NextResponse } from 'next/server'
import { UserProfileService } from '@/lib/supabase'
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
  console.log('🔔 === TWILIO WEBHOOK RECEIVED ===')
  addLog('info', '=== TWILIO WEBHOOK RECEIVED ===')
  
  try {
    // Parse the Twilio webhook data
    const body = await request.text()
    console.log('📥 Raw webhook body:', body)
    addLog('debug', 'Raw webhook body received', { bodyLength: body.length })
    
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
    
    // Check if this is a WhatsApp message
    const isWhatsApp = fromNumber?.startsWith('whatsapp:')
    
    console.log('📱 === INCOMING MESSAGE ===')
    console.log('From:', fromNumber)
    console.log('To:', toNumber)
    console.log('Message:', messageBody)
    console.log('Is WhatsApp:', isWhatsApp)
    
    addLog('info', 'Incoming message', { 
      from: fromNumber, 
      to: toNumber,
      messagePreview: messageBody?.substring(0, 50),
      isWhatsApp 
    })
    
    if (!fromNumber || !messageBody) {
      addLog('error', 'Missing required fields')
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get or create conversation state for this user
    let userState = conversationState.get(fromNumber)
    if (!userState) {
      userState = { history: [] }
      conversationState.set(fromNumber, userState)
      console.log('🆕 Created new conversation for:', fromNumber)
      addLog('info', 'Created new conversation', { phone: fromNumber })
    }

    // Add user message to history
    userState.history.push({ role: 'user', content: messageBody })
    addLog('debug', 'Added message to history', { totalMessages: userState.history.length })

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
      const savedProfile = await UserProfileService.upsertProfile(updatedProfile)
      if (savedProfile) {
        console.log('✅ User profile saved to Supabase:', savedProfile.id)
        addLog('info', '✅ User profile saved to Supabase', { id: savedProfile.id, phone: fromNumber })
        userState.userProfile = savedProfile
      } else {
        console.log('❌ Failed to save user profile to Supabase')
        addLog('error', '❌ Failed to save user profile to Supabase')
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
    addLog('debug', 'Calling chat API', { hasUserProfile: !!userState.userProfile })
    const chatResponse = await fetch(`${request.url.split('/api/webhook')[0]}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: messageBody,
        history: userState.history,
        phoneNumber: fromNumber,
        userProfile: userState.userProfile
      })
    })

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text()
      addLog('error', 'Chat API error', { status: chatResponse.status, error: errorText })
      throw new Error(`Chat API error: ${chatResponse.status}`)
    }

    const chatData = await chatResponse.json()
    const aiResponse = chatData.response
    console.log('🤖 AI Response:', aiResponse)
    addLog('info', 'AI response received', { length: aiResponse?.length || 0 })

    // Add AI response to history
    userState.history.push({ role: 'assistant', content: aiResponse })

    // Limit conversation history to last 10 messages to avoid context overflow
    if (userState.history.length > 10) {
      userState.history = userState.history.slice(-10)
    }

    // Send response back using TwiML
    console.log(`📤 Sending ${isWhatsApp ? 'WhatsApp' : 'SMS'} response`)
    console.log('Response:', aiResponse)
    addLog('info', `Sending ${isWhatsApp ? 'WhatsApp' : 'SMS'} response`, { 
      messagePreview: aiResponse?.substring(0, 50) 
    })
    
    // Return TwiML response that tells Twilio to send the message back
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${aiResponse}</Message>
</Response>`
    
    console.log('✅ Webhook complete!')
    return new NextResponse(twimlResponse, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml'
      }
    })

  } catch (error) {
    addLog('error', 'WEBHOOK ERROR', {
      type: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle GET requests (for webhook verification)
export async function GET(request: NextRequest) {
  console.log('=== WEBHOOK GET REQUEST ===')
  console.log('URL:', request.url)
  console.log('Query params:', Object.fromEntries(new URL(request.url).searchParams.entries()))
  
  return NextResponse.json({ 
    message: 'Twilio webhook endpoint is active',
    timestamp: new Date().toISOString()
  })
}