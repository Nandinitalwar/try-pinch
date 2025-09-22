import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    twilioAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: !!process.env.TWILIO_PHONE_NUMBER,
    phoneNumberValue: process.env.TWILIO_PHONE_NUMBER,
    accountSidLength: process.env.TWILIO_ACCOUNT_SID?.length || 0,
    authTokenLength: process.env.TWILIO_AUTH_TOKEN?.length || 0,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  })
}