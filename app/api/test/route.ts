import { NextRequest, NextResponse } from 'next/server'

// Simple test endpoint to verify deployment is working
export async function GET(request: NextRequest) {
  console.log('\n' + '='.repeat(80))
  console.log('TEST ENDPOINT HIT')
  console.log('Timestamp:', new Date().toISOString())
  console.log('URL:', request.url)
  console.log('='.repeat(80) + '\n')
  
  return NextResponse.json({
    status: 'ok',
    message: 'API is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
    hasTwilioSid: !!process.env.TWILIO_ACCOUNT_SID,
    hasTwilioToken: !!process.env.TWILIO_AUTH_TOKEN,
    hasTwilioNumber: !!process.env.TWILIO_PHONE_NUMBER,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  })
}

