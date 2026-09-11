// Unified Messaging Service
// Handles Twilio SMS plus Pinch's sole iMessage provider, Linq.

import { LinqClient } from './linq'

export interface MessageParams {
  to: string
  content: string
  mediaUrl?: string
  preferIMessage?: boolean
}

export interface MessageResult {
  success: boolean
  service: 'twilio' | 'linq' | 'none'
  messageId?: string
  error?: string
}

export class MessagingService {
  private linqClient = LinqClient.getClient()

  async sendMessage(params: MessageParams): Promise<MessageResult> {
    const { to, content, mediaUrl, preferIMessage = true } = params

    if (preferIMessage) {
      if (!this.linqClient) {
        return {
          success: false,
          service: 'linq',
          error: 'Linq credentials are not configured',
        }
      }
      const result = await this.linqClient.sendMessage({ to, content, mediaUrl })
      if (result.status === 'OK') {
        return { success: true, service: 'linq', messageId: result.message_id }
      }
      return { success: false, service: 'linq', error: result.error }
    }

    // Twilio replies are sent by the Twilio webhook route through TwiML.
    return { success: true, service: 'twilio' }
  }

  getAvailableServices(): string[] {
    const services: string[] = []
    if (this.linqClient) services.push('linq')
    services.push('twilio')
    return services
  }

  getStatus(): {
    provider: 'linq' | null
    linq: boolean
    twilio: boolean
  } {
    return {
      provider: this.linqClient ? 'linq' : null,
      linq: !!this.linqClient,
      twilio: true,
    }
  }
}

let messagingServiceInstance: MessagingService | null = null

export function getMessagingService(): MessagingService {
  if (!messagingServiceInstance) {
    messagingServiceInstance = new MessagingService()
  }
  return messagingServiceInstance
}
