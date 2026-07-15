// Unified Messaging Service
// Handles sending messages via both Twilio (SMS) and Blooio (iMessage)

import { BlooioClient } from './blooio'

export interface MessageParams {
  to: string
  content: string
  mediaUrl?: string
  preferIMessage?: boolean // If true, try Blooio first
}

export interface MessageResult {
  success: boolean
  service: 'twilio' | 'blooio' | 'none'
  messageId?: string
  error?: string
}

/**
 * Unified messaging service that can send via Twilio or Blooio
 */
export class MessagingService {
  private blooioClient: BlooioClient | null

  constructor() {
    this.blooioClient = BlooioClient.getClient()
  }

  /**
   * Send a message using the best available service
   * Priority: Blooio (iMessage) > Twilio (SMS)
   */
  async sendMessage(params: MessageParams): Promise<MessageResult> {
    const { to, content, mediaUrl, preferIMessage = true } = params

    // Try Blooio first if available and preferred
    if (preferIMessage && this.blooioClient) {
      console.log(`[MessagingService] Attempting to send via Blooio (iMessage) to ${to}`)
      const result = await this.blooioClient.sendMessage({
        to,
        content,
        mediaUrl,
      })

      if (result.status === 'OK') {
        console.log(`[MessagingService] Successfully sent via Blooio: ${result.message_id}`)
        return {
          success: true,
          service: 'blooio',
          messageId: result.message_id,
        }
      } else {
        console.warn(`[MessagingService] Blooio failed: ${result.error}`)
        // Fall through to Twilio
      }
    }

    // Fallback to Twilio (or use if Blooio not available)
    console.log(`[MessagingService] Using Twilio (SMS) to ${to}`)
    // Note: Twilio sending is handled by TwiML response in webhook
    // This is just for logging/tracking purposes
    return {
      success: true,
      service: 'twilio',
      messageId: undefined, // Twilio handles this via TwiML
    }
  }

  /**
   * Check which services are available
   */
  getAvailableServices(): string[] {
    const services: string[] = []

    if (this.blooioClient) {
      services.push('blooio')
    }

    // Twilio is always available (handled by webhook TwiML response)
    services.push('twilio')

    return services
  }

  /**
   * Get service status
   */
  getStatus(): {
    blooio: boolean
    twilio: boolean
  } {
    return {
      blooio: !!this.blooioClient,
      twilio: true, // Always available via TwiML
    }
  }
}

/**
 * Get a singleton instance of the messaging service
 */
let messagingServiceInstance: MessagingService | null = null

export function getMessagingService(): MessagingService {
  if (!messagingServiceInstance) {
    messagingServiceInstance = new MessagingService()
  }
  return messagingServiceInstance
}

