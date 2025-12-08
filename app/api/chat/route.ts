import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { addLog } from '@/lib/logger'

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

// Initialize OpenRouter client (compatible with OpenAI SDK)
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  maxRetries: 3,
  timeout: 30000, // 30 second timeout
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://aiastrologer.vercel.app',
    'X-Title': 'AI Astrologer SMS Bot'
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
  addLog('info', '=== POST /api/chat - Function started ===')
  addLog('debug', 'Environment check', {
    NODE_ENV: process.env.NODE_ENV,
    PRODUCTION_MODE,
    OPENROUTER_API_KEY_exists: !!process.env.OPENROUTER_API_KEY
  })
  
  try {
    addLog('info', 'POST /api/chat - Request received', {
      url: request.url,
      method: request.method
    })
    
    // Rate limiting
    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    addLog('debug', 'Client IP', { ip: clientIP })
    
    if (!checkRateLimit(clientIP)) {
      addLog('warn', 'Rate limit exceeded', { ip: clientIP })
      const response = NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
      return addSecurityHeaders(response)
    }

    // Request validation
    const body = await request.json()
    addLog('debug', 'Request body parsed', { 
      hasMessage: !!body.message, 
      hasHistory: !!body.history,
      hasUserProfile: !!body.userProfile 
    })
    
    const { message, history, userProfile } = body

    if (!message || typeof message !== 'string') {
      addLog('error', 'VALIDATION ERROR: Invalid message', { message, type: typeof message })
      const response = NextResponse.json(
        { error: 'Valid message is required' },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    // Message length validation
    if (message.length > 1000) {
      addLog('error', 'VALIDATION ERROR: Message too long', { length: message.length })
      const response = NextResponse.json(
        { error: 'Message too long. Please keep it under 1000 characters.' },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    // Check if OpenRouter API key is available
    if (!process.env.OPENROUTER_API_KEY) {
      addLog('error', 'FATAL ERROR: OpenRouter API key is missing')
      const response = NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      )
      return addSecurityHeaders(response)
    }

    // Create conversation history for context
    const conversationHistory = history?.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    })) || []
    addLog('debug', 'Conversation history processed', { length: conversationHistory.length })

    // Use user profile information directly from request body
    const extractedUserProfile = userProfile || history?.find((msg: any) => msg.role === 'user' && msg.userProfile)?.userProfile
    if (extractedUserProfile) {
      addLog('info', 'User profile found', {
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
    addLog('debug', 'Preparing AI request', { message: message.substring(0, 50) })
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

    // Create the messages array for OpenAI
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory,
      { role: 'user' as const, content: message }
    ]

    // Single call to OpenAI without tools
    console.log('\n' + '='.repeat(80))
    console.log('STEP 2 CONTINUED: OPENROUTER API REQUEST DETAILS')
    console.log('='.repeat(80))
    console.log('Model: openai/gpt-4o-mini')
    console.log('Message count:', messages.length)
    console.log('Max tokens:', MAX_TOKENS_PER_REQUEST)
    console.log('Temperature:', 1)
    console.log('Request timestamp:', new Date().toISOString())
    console.log('='.repeat(80))
    addLog('info', 'Calling OpenRouter API', { messageCount: messages.length })
    
    const completion = await retryOpenAICall(async () => {
      console.log('Sending request to OpenRouter API...')
      const startTime = Date.now()
      const result = await openai.chat.completions.create({
        model: 'openai/gpt-4o-mini', // Using OpenAI GPT-4o-mini via OpenRouter
        messages,
        max_tokens: MAX_TOKENS_PER_REQUEST,
        temperature: 1,
      })
      const duration = Date.now() - startTime
      console.log(`OpenRouter API responded in ${duration}ms`)
      return result
    })

    console.log('\n' + '='.repeat(80))
    console.log('STEP 3 CONTINUED: OPENROUTER API RESPONSE DETAILS')
    console.log('='.repeat(80))
    console.log('Finish reason:', completion.choices[0]?.finish_reason)
    console.log('Token usage:', JSON.stringify(completion.usage, null, 2))
    console.log('Choices count:', completion.choices?.length || 0)
    console.log('='.repeat(80))
    addLog('info', 'OpenAI API call successful', { 
      finish_reason: completion.choices[0]?.finish_reason,
      tokens: completion.usage
    })
    
    const assistantMessage = completion.choices[0]?.message
    const response = assistantMessage?.content

    if (!response) {
      console.log('\n❌ NO RESPONSE RECEIVED FROM OPENROUTER')
      console.log('='.repeat(80))
      console.log('Completion object:', JSON.stringify(completion, null, 2))
      console.log('Assistant message:', assistantMessage)
      console.log('Choices:', completion.choices)
      addLog('error', 'FATAL ERROR: No response content from OpenAI')
      throw new Error('No response from OpenAI')
    }

    console.log('\n✅ RESPONSE CONTENT RECEIVED')
    console.log('='.repeat(80))
    console.log('Response length:', response.length)
    console.log('Response preview:', response.substring(0, 200))
    console.log('='.repeat(80) + '\n')

    addLog('info', 'AI response generated', { length: response.length, preview: response.substring(0, 100) })
    const jsonResponse = NextResponse.json({ response })
    return addSecurityHeaders(jsonResponse)

  } catch (error) {
    console.log('\n❌ CHAT API ERROR')
    console.log('='.repeat(80))
    console.log('Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.log('Error message:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.log('Stack trace:', error.stack)
    }
    if (error instanceof OpenAI.APIError) {
      console.log('OpenRouter API Error Details:')
      console.log('  Status:', error.status)
      console.log('  Code:', error.code)
      console.log('  Type:', error.type)
      console.log('  Param:', error.param)
    }
    console.log('='.repeat(80) + '\n')
    addLog('error', 'ERROR in chat API', {
      type: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    
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
    
    addLog('error', 'Final error', { message: errorMessage, statusCode })
    
    const response = NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
    return addSecurityHeaders(response)
  }
} 