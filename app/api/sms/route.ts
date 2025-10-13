import { NextRequest, NextResponse } from 'next/server'
import smsService, { SMSMessage } from '../../../lib/smsService'

export async function POST(request: NextRequest) {
  console.log('=== SMS API ENDPOINT - REQUEST RECEIVED ===')
  console.log('Timestamp:', new Date().toISOString())
  console.log('Request URL:', request.url)
  console.log('Request method:', request.method)
  console.log('Request headers:', Object.fromEntries(request.headers.entries()))
  
  try {
    
    const body = await request.json()
    console.log('=== SMS API REQUEST BODY ===')
    console.log('Full request body:', JSON.stringify(body, null, 2))
    
    const { phoneNumber, message, userName, type = 'prediction' } = body

    console.log('=== SMS API EXTRACTED FIELDS ===')
    console.log('Phone number:', phoneNumber)
    console.log('User name:', userName)
    console.log('Message type:', type)
    console.log('Original message length:', message?.length || 0)
    console.log('Original message preview:', message?.substring(0, 100) + (message?.length > 100 ? '...' : ''))

    // Validation
    if (!phoneNumber || !message) {
      console.log('❌ SMS API VALIDATION FAILED')
      console.log('Missing phoneNumber:', !phoneNumber)
      console.log('Missing message:', !message)
      
      return NextResponse.json(
        { error: 'Phone number and message are required' },
        { status: 400 }
      )
    }

    // Format message based on type
    console.log('=== SMS MESSAGE FORMATTING ===')
    let formattedMessage: string
    
    switch (type) {
      case 'prediction':
      case 'conversation':
        formattedMessage = smsService.formatPredictionMessage(userName || 'Friend', message)
        console.log('Using conversation message format')
        break
      case 'reminder':
        formattedMessage = smsService.formatReminderMessage(userName || 'Friend', message)
        console.log('Using reminder message format')
        break
      case 'horoscope':
        formattedMessage = smsService.formatHoroscopeMessage(userName || 'Friend', body.starSign || '', message)
        console.log('Using horoscope message format')
        break
      default:
        formattedMessage = message
        console.log('Using raw message format')
    }
    
    console.log('Formatted message length:', formattedMessage.length)
    console.log('Formatted message:', formattedMessage)

    const smsMessage: SMSMessage = {
      to: phoneNumber,
      message: formattedMessage,
      type
    }

    console.log('=== CALLING SMS SERVICE ===')
    const success = await smsService.sendSMS(smsMessage)
    console.log('SMS service result:', success)

    if (success) {
      console.log('✅ SMS API SUCCESS - Returning success response')
      return NextResponse.json({ 
        success: true, 
        message: 'SMS sent successfully' 
      })
    } else {
      console.log('❌ SMS API FAILURE - SMS service returned false')
      return NextResponse.json(
        { error: 'Failed to send SMS' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.log('=== SMS API ERROR ===')
    console.error('❌ SMS API threw an exception')
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Full error object:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}