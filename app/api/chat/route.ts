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

    // Prepare the system prompt for the AI astrologer
    console.log('=== Preparing system prompt ===')
    const todaysDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'America/Los_Angeles'
    })
    const systemPrompt = `You are an astrologer. 
Be prescriptive, confident, and extremely specific. 
People want extreme ideas and tangible outcomes. 
They want you to be in control. 
Be direct and avoid filler. 

Today is ${todaysDate}. 

${extractedUserProfile ? `User Profile:
- Name: ${extractedUserProfile.name}
- Star Sign: ${extractedUserProfile.starSign}
- Date of Birth: ${extractedUserProfile.dateOfBirth}
- Time of Birth: ${extractedUserProfile.timeOfBirth}
- Place of Birth: ${extractedUserProfile.placeOfBirth}

` : ''}${message}`
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