import twilio from 'twilio'

// Initialize Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

export interface SMSMessage {
  to: string
  message: string
  type: 'prediction' | 'reminder' | 'horoscope'
}

export class SMSService {
  private static instance: SMSService
  private fromNumber: string

  private constructor() {
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || ''
    
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !this.fromNumber) {
      console.warn('Twilio credentials not configured. SMS notifications will be disabled.')
    }
  }

  static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService()
    }
    return SMSService.instance
  }

  async sendSMS(smsMessage: SMSMessage): Promise<boolean> {
    console.log('=== SMS SERVICE - ATTEMPTING TO SEND SMS ===')
    console.log('SMS Message Details:', {
      to: smsMessage.to,
      type: smsMessage.type,
      messageLength: smsMessage.message.length,
      message: smsMessage.message.substring(0, 100) + (smsMessage.message.length > 100 ? '...' : '')
    })
    
    try {
      // Check if Twilio is configured
      console.log('=== TWILIO CONFIGURATION CHECK ===')
      console.log('TWILIO_ACCOUNT_SID exists:', !!process.env.TWILIO_ACCOUNT_SID)
      console.log('TWILIO_AUTH_TOKEN exists:', !!process.env.TWILIO_AUTH_TOKEN)
      console.log('TWILIO_PHONE_NUMBER exists:', !!this.fromNumber)
      console.log('From number:', this.fromNumber)
      
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !this.fromNumber) {
        console.log('❌ SMS not sent: Twilio not configured')
        return false
      }

      // Validate phone number format (basic validation)
      console.log('=== PHONE NUMBER VALIDATION ===')
      console.log('Phone number to validate:', smsMessage.to)
      console.log('Is valid format:', this.isValidPhoneNumber(smsMessage.to))
      
      if (!this.isValidPhoneNumber(smsMessage.to)) {
        console.log('❌ SMS not sent: Invalid phone number format')
        return false
      }

      console.log('=== SENDING SMS VIA TWILIO API ===')
      console.log('Twilio request payload:', {
        body: smsMessage.message,
        from: this.fromNumber,
        to: smsMessage.to
      })
      
      const message = await client.messages.create({
        body: smsMessage.message,
        from: this.fromNumber,
        to: smsMessage.to
      })

      console.log('=== TWILIO API RESPONSE ===')
      console.log('✅ SMS sent successfully!')
      console.log('Message SID:', message.sid)
      console.log('Status:', message.status)
      console.log('Direction:', message.direction)
      console.log('Date created:', message.dateCreated)
      console.log('Price:', message.price)
      console.log('Price unit:', message.priceUnit)
      
      return true
    } catch (error) {
      console.log('=== TWILIO API ERROR ===')
      console.error('❌ Failed to send SMS')
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error)
      console.error('Error message:', error instanceof Error ? error.message : String(error))
      console.error('Full error object:', error)
      
      // Log additional Twilio-specific error details if available
      if (error && typeof error === 'object' && 'code' in error) {
        console.error('Twilio error code:', (error as any).code)
        console.error('Twilio error status:', (error as any).status)
        console.error('Twilio error more info:', (error as any).moreInfo)
      }
      
      return false
    }
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic phone number validation (E.164 format)
    const phoneRegex = /^\+[1-9]\d{1,14}$/
    return phoneRegex.test(phoneNumber)
  }

  // Format prediction message for SMS
  formatPredictionMessage(userName: string, prediction: string): string {
    // Send very short test message
    return `Test SMS`
  }

  // Format reminder message for SMS
  formatReminderMessage(userName: string, reminderText: string): string {
    return `Hi ${userName}! ⭐ Reminder from AstroWorld: ${reminderText}\n\nChat with your astrologer: https://aiastrologer.vercel.app`
  }

  // Format daily horoscope message
  formatHoroscopeMessage(userName: string, starSign: string, horoscope: string): string {
    const maxLength = 120
    const truncatedHoroscope = horoscope.length > maxLength 
      ? horoscope.substring(0, maxLength) + '...' 
      : horoscope
    
    return `${starSign} Daily: ${truncatedHoroscope}\n\nGet personalized readings: https://aiastrologer.vercel.app`
  }
}

export default SMSService.getInstance()