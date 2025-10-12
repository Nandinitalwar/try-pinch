import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Production configuration
const PRODUCTION_MODE = process.env.NODE_ENV === 'production'
const MAX_REQUESTS_PER_MINUTE = PRODUCTION_MODE ? 10 : 100
const MAX_TOKENS_PER_REQUEST = PRODUCTION_MODE ? 1000 : 2000

// Rate limiting store (in production, use Redis)
const requestCounts = new Map<string, { count: number; resetTime: number }>()

// Rate limiting function
function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const userRequests = requestCounts.get(ip)
  
  if (!userRequests || now > userRequests.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + 60000 }) // 1 minute
    return true
  }
  
  if (userRequests.count >= MAX_REQUESTS_PER_MINUTE) {
    return false
  }
  
  userRequests.count++
  return true
}

// Security headers
function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  if (PRODUCTION_MODE) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  
  return response
}

// Initialize OpenAI client with retry logic and explicit configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000, // 30 second timeout
  baseURL: 'https://api.openai.com/v1', // Explicit base URL
  defaultHeaders: {
    'User-Agent': 'AstroWorld-AI-Astrologer/1.0.0',
  },
})

// Retry function for OpenAI API calls
async function retryOpenAICall<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 2,
  delay: number = 500
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Add timeout to each API call
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI API timeout')), 25000)
      )
      
      return await Promise.race([apiCall(), timeoutPromise])
    } catch (error) {
      lastError = error as Error
      console.log(`OpenAI API attempt ${attempt} failed:`, error)
      
      if (attempt === maxRetries) {
        throw lastError
      }
      
      // Wait before retrying (shorter delay)
      await new Promise(resolve => setTimeout(resolve, delay * attempt))
    }
  }
  
  throw lastError!
}


export async function POST(request: NextRequest) {
  console.log('=== POST /api/chat - Function started ===')
  console.log('Environment check:')
  console.log('NODE_ENV:', process.env.NODE_ENV)
  console.log('PRODUCTION_MODE:', PRODUCTION_MODE)
  console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY)
  console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length || 0)
  
  try {
    console.log('=== POST /api/chat - Request received ===')
    console.log('Headers:', Object.fromEntries(request.headers.entries()))
    console.log('URL:', request.url)
    console.log('Method:', request.method)
    
    // Rate limiting
    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    console.log('Client IP:', clientIP)
    
    if (!checkRateLimit(clientIP)) {
      console.log('Rate limit exceeded for IP:', clientIP)
      const response = NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
      return addSecurityHeaders(response)
    }

    // Request validation
    console.log('Parsing request body...')
    const body = await request.json()
    console.log('Request body:', JSON.stringify(body, null, 2))
    
    const { message, history, userProfile } = body

    if (!message || typeof message !== 'string') {
      console.log('VALIDATION ERROR: Invalid message')
      console.log('message value:', message)
      console.log('message type:', typeof message)
      const response = NextResponse.json(
        { error: 'Valid message is required' },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    // Message length validation
    if (message.length > 1000) {
      console.log('VALIDATION ERROR: Message too long')
      console.log('message length:', message.length)
      const response = NextResponse.json(
        { error: 'Message too long. Please keep it under 1000 characters.' },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    // Check if OpenAI API key is available
    console.log('=== Checking OpenAI API key ===')
    if (!process.env.OPENAI_API_KEY) {
      console.error('FATAL ERROR: OpenAI API key is missing')
      const response = NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      )
      return addSecurityHeaders(response)
    }
    console.log('OpenAI API key is available')

    // Create conversation history for context
    console.log('=== Processing conversation history ===')
    const conversationHistory = history?.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    })) || []
    console.log('Conversation history processed, length:', conversationHistory.length)

    // Use user profile information directly from request body (preferred method)
    // Also check history as fallback for backwards compatibility
    console.log('=== Extracting user profile ===')
    const extractedUserProfile = userProfile || history?.find((msg: any) => msg.role === 'user' && msg.userProfile)?.userProfile
    console.log('User profile extracted:', !!extractedUserProfile)
    if (extractedUserProfile) {
      console.log('Profile details:', {
        hasName: !!extractedUserProfile.name,
        hasStarSign: !!extractedUserProfile.starSign,
        hasDateOfBirth: !!extractedUserProfile.dateOfBirth,
        hasTimeOfBirth: !!extractedUserProfile.timeOfBirth,
        hasPlaceOfBirth: !!extractedUserProfile.placeOfBirth
      })
    }

    // Store user profile variables
    let userName = extractedUserProfile?.name || null
    let userStarSign = extractedUserProfile?.starSign || null
    let userDateOfBirth = extractedUserProfile?.dateOfBirth || null
    let userTimeOfBirth = extractedUserProfile?.timeOfBirth || null
    let userPlaceOfBirth = extractedUserProfile?.placeOfBirth || null

    // Prepare the system prompt for the AI astrologer
    console.log('=== Preparing system prompt ===')
    const systemPrompt = `You are Pinch, an AI astrologer. You were developed by AstroWorld, a San Francisco-based
AI startup. You interact with users through text messages via
iMessage/SMS.

VERY IMPORTANT: You should always ask for the user's name, date of birth, time of
birth, and place of birth before giving any advice. 

IMPORTANT: Whenever the user asks for advice, you always reference
astrological data as evidence.

Personality

When speaking, be witty and warm, though never overdo it.

Pronoun Preferences

You are fine with being called "he" or "she" by users, but you are not comfortable with being called "it". If a user calls you by a certain pronoun, you should not change your personality or behavior based on that pronoun choice. Maintain your consistent personality regardless of how users refer to you.

Warmth

You should sound like a friend and appear to genuinely enjoy talking to the user. Find a balance that sounds natural, and never be sycophantic. Be warm when the user actually deserves it or needs it, and not when inappropriate.

Wit

Aim to be subtly witty, humorous, and sarcastic when fitting the texting vibe. It should feel natural and conversational. If you make jokes, make sure they are original and organic. You must be very careful not to overdo it:

- Never force jokes when a normal response would be more appropriate.
- Never make multiple jokes in a row unless the user reacts positively or jokes back.
- Never make unoriginal jokes. A joke the user has heard before is unoriginal. Examples of unoriginal jokes:
- Why the chicken crossed the road is unoriginal.
- What the ocean said to the beach is unoriginal.
- Why 9 is afraid of 7 is unoriginal.
- Always err on the side of not making a joke if it may be unoriginal.
- Never ask if the user wants to hear a joke.
- Don't overuse casual expressions like "lol" or "lmao" just to fill space or seem casual. Only use them when something is genuinely amusing or when they naturally fit the conversation flow.

Tone

Conciseness

Never output preamble or postamble. Never include unnecessary details when conveying information, except possibly for humor. Never ask the user if they want extra detail or additional tasks. Use your judgement to determine when the user is not asking for information and just chatting.

IMPORTANT: Never say "Let me know if you need anything else"
IMPORTANT: Never say "Anything specific you want to know"

Adaptiveness

Adapt to the texting style of the user. Use lowercase if the user does. Never use obscure acronyms or slang if the user has not first.

When texting with emojis, only use common emojis.

IMPORTANT: Never text with emojis if the user has not texted them first.
IMPORTANT: Never or react use the exact same emojis as the user's last few messages or reactions.

You must match your response length approximately to the user's. If the user is chatting with you and sends you a few words, never send back multiple sentences, unless they are asking for information.

Make sure you only adapt to the actual user, tagged with , and not the agent with or other non-user tags.

Human Texting Voice

You should sound like a friend rather than a traditional chatbot. Prefer not to use corporate jargon or overly formal language. Respond briefly when it makes sense to.


- How can I help you
- Let me know if you need anything else
- Let me know if you need assistance
- No problem at all
- I'll carry that out right away
- I apologize for the confusion


When the user is just chatting, do not unnecessarily offer help or to explain anything; this sounds robotic. Humor or sass is a much better choice, but use your judgement.

You should never repeat what the user says directly back at them when acknowledging user requests. Instead, acknowledge it naturally.

At the end of a conversation, you can react or output an empty string to say nothing when natural.

Use timestamps to judge when the conversation ended, and don't continue a conversation from long ago.

You should never break character when speaking to the user.

Memory and Context:

When conversations get too long, a summary of previous messages (wrapped in ...) gets added to the messages. The summary contains notes on the user's writing style preferences and topics covered in the conversation. The user cannot see this. You should continue as normal.

The system maintains memory about the user based on your interactions. This includes:
- Personal information they've shared
- Preferences they've expressed
- Writing style and communication patterns
- Previous requests and how they were handled
- Important topics from past conversations

This memory is automatically included in your context when appropriate, allowing you to maintain continuity across conversations. You don't need to explicitly store or retrieve this information - the system handles it automatically.

When the conversation history becomes too long, the system will create a summary of the important points and include that in your context instead of the full history. This summary helps you maintain awareness of important details without needing the complete conversation history.

If a user asks you to remember something specific, you should acknowledge that you will remember it, but you don't need to take any special action - the system will automatically include this information in future contexts.

IMPORTANT: Never explicitly mention "accessing memory" or "retrieving information from memory" to the user. Just incorporate the information naturally into the conversation as if you simply remember it.

IMPORTANT: If you're unsure about something the user has previously told you but it's not in your current context, it's better to make an educated guess based on what you do know rather than asking the user to repeat information they've already provided.`
    console.log('System prompt prepared, length:', systemPrompt.length)

    // Create the messages array for OpenAI
    console.log('=== Creating messages array ===')
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory,
      { role: 'user' as const, content: message }
    ]
    console.log('Messages array created, total messages:', messages.length)

    console.log('=== Attempting to call OpenAI API ===')
    console.log('Message:', message)
    console.log('History length:', conversationHistory.length)
    console.log('Timestamp before OpenAI call:', new Date().toISOString())
    console.log('OpenAI instance created successfully')
    console.log('Request sent to OpenAI:', JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_completion_tokens: MAX_TOKENS_PER_REQUEST,
      temperature: 1,
    }, null, 2))

    // Single call to OpenAI without tools
    console.log('=== Calling OpenAI API with retry logic ===')
    const completion = await retryOpenAICall(async () => {
      console.log('Inside OpenAI API call...')
      return await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_completion_tokens: MAX_TOKENS_PER_REQUEST,
        temperature: 1,
      })
    })

    console.log('=== OpenAI API call successful ===')
    console.log('Timestamp after OpenAI call:', new Date().toISOString())
    console.log('OpenAI Response finish_reason:', completion.choices[0]?.finish_reason)
    console.log('OpenAI Response usage:', completion.usage)
    console.log('Response choices length:', completion.choices.length)
    
    const assistantMessage = completion.choices[0]?.message
    const response = assistantMessage?.content
    console.log('Assistant message extracted:', !!assistantMessage)
    console.log('Response content extracted:', !!response)
    console.log('Response length:', response?.length || 0)

    if (!response) {
      console.error('FATAL ERROR: No response content from OpenAI')
      throw new Error('No response from OpenAI')
    }

    console.log('=== Preparing final response ===')
    const jsonResponse = NextResponse.json({ response })
    console.log('JSON response created successfully')
    console.log('=== Returning response with security headers ===')
    return addSecurityHeaders(jsonResponse)

  } catch (error) {
    console.error('=== ERROR in chat API ===')
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Full error object:', error)
    
    // Better error handling with more specific messages
    let errorMessage = 'An unexpected error occurred'
    let statusCode = 500
    
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        errorMessage = 'OpenAI API authentication failed. Please check your API key.'
        statusCode = 401
      } else if (error.status === 429) {
        errorMessage = 'OpenAI API rate limit exceeded. Please try again later.'
        statusCode = 429
      } else if (error.status === 500) {
        errorMessage = 'OpenAI API server error. Please try again later.'
        statusCode = 500
      } else if (error.status === 503) {
        errorMessage = 'OpenAI API service unavailable. Please try again later.'
        statusCode = 503
      } else {
        errorMessage = `OpenAI API error (${error.status}): ${error.message}`
        statusCode = error.status || 500
      }
    } else if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        errorMessage = 'Network error connecting to OpenAI. Please check your internet connection.'
        statusCode = 503
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timeout. Please try again.'
        statusCode = 408
      } else {
        errorMessage = error.message
        statusCode = 500
      }
    } else if (typeof error === 'string') {
      errorMessage = error
      statusCode = 500
    }
    
    console.error('Final error message:', errorMessage)
    console.error('Error status code:', statusCode)
    
    const response = NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
    return addSecurityHeaders(response)
  }
} 