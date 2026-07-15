// Blooio iMessage Integration
// Allows sending iMessages alongside SMS via Twilio
// API docs: https://docs.blooio.com

export interface BlooioConfig {
  apiKey: string
  fromNumber: string
}

export interface BlooioSendBody {
  text: string
  attachments?: string[]
  from_number?: string
  use_typing_indicator?: boolean
}

export interface BlooioResponse {
  status: 'OK' | 'ERROR'
  message_id?: string
  error?: string
}

// Webhook event envelope — every delivery shares this shape,
// with the event-specific resource in `data`
export interface BlooioWebhookEvent {
  id: string // evt_...
  type:
    | 'message.received'
    | 'message.queued'
    | 'message.sent'
    | 'message.delivered'
    | 'message.failed'
    | 'message.read'
    | 'message.reaction'
  created_at: number // epoch milliseconds
  organization_id: string
  data: BlooioMessageData
}

export interface BlooioMessageData {
  message_id: string // msg_...
  chat_id: string
  channel_id: string
  channel_type: string
  kind: string
  direction: 'inbound' | 'outbound'
  text?: string
  status: string
  protocol: 'imessage' | 'sms' | 'rcs' | string
  provider_message_id?: string
  message_type: string
  sender: string // the user's phone number (E.164) for inbound messages
  recipient: string // your Blooio number for inbound messages
  contact?: { identifier: string }
  channel_address?: string
  attachments?: Array<{ url?: string } | string>
}

// Normalized webhook message - deliveries arrive in one of two shapes:
// 1. Documented envelope: { id, type, created_at, data: {...} }
// 2. Compat/legacy flat (what v2-created webhooks actually send):
//    { event, external_id, internal_id, text, ... }
export interface BlooioInboundMessage {
  eventType: string
  messageId: string
  sender: string
  recipient: string
  text: string
  protocol: string | null
  isGroup: boolean
}

export function parseBlooioWebhook(payload: any): BlooioInboundMessage | null {
  if (!payload) return null

  // Envelope shape: { type: "message.received", data: {...} }
  if (payload.type && payload.data) {
    const d = payload.data
    return {
      eventType: payload.type,
      messageId: d.message_id || '',
      sender: d.sender || d.contact?.identifier || '',
      recipient: d.recipient || d.channel_address || '',
      text: d.text || '',
      protocol: d.protocol ?? null,
      isGroup: !!d.is_group,
    }
  }

  // Compat/legacy flat shape: { event: "message.received", external_id, internal_id, ... }
  if (payload.event) {
    return {
      eventType: payload.event,
      messageId: payload.message_id || '',
      sender: payload.sender || payload.external_id || '',
      recipient: payload.internal_id || '',
      text: payload.text || '',
      protocol: payload.protocol ?? null,
      isGroup: !!payload.is_group,
    }
  }

  return null
}

/**
 * Blooio API client for sending iMessages
 */
export class BlooioClient {
  private apiKey: string
  private fromNumber: string
  private baseUrl = 'https://api.blooio.com/v2/api'

  constructor(config: BlooioConfig) {
    this.apiKey = config.apiKey
    this.fromNumber = config.fromNumber
  }

  /**
   * Send a message via Blooio (iMessage with SMS fallback)
   */
  async sendMessage(params: {
    to: string
    content?: string
    mediaUrl?: string
  }): Promise<BlooioResponse> {
    console.log('[BlooioClient] 📤 sendMessage called')
    console.log('[BlooioClient] 📤 To:', params.to)
    console.log('[BlooioClient] 📤 Content length:', params.content?.length || 0)
    console.log('[BlooioClient] 📤 Media URL:', params.mediaUrl || 'none')

    try {
      // The chat_id is the recipient's phone number (E.164)
      const chatId = params.to

      const body: BlooioSendBody = {
        text: params.content || '',
        attachments: params.mediaUrl ? [params.mediaUrl] : undefined,
        from_number: this.fromNumber,
      }

      const url = `${this.baseUrl}/chats/${encodeURIComponent(chatId)}/messages`
      console.log('[BlooioClient] 📤 Request URL:', url)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      console.log('[BlooioClient] 📥 Response status:', response.status)

      const responseText = await response.text()

      let data: any
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error('[BlooioClient] ❌ Failed to parse response JSON:', responseText)
        return {
          status: 'ERROR',
          error: 'Invalid JSON response from Blooio',
        }
      }

      if (!response.ok) {
        console.error('[BlooioClient] ❌ API error:', JSON.stringify(data))
        return {
          status: 'ERROR',
          error: data.error?.message || data.message || `Failed to send message (HTTP ${response.status})`,
        }
      }

      console.log('[BlooioClient] ✅ Message sent:', data.message_id || data.id)

      return {
        status: 'OK',
        message_id: data.message_id || data.id,
      }
    } catch (error) {
      console.error('[BlooioClient] ❌ Send error:', error)
      return {
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Check if Blooio is configured
   */
  static isConfigured(): boolean {
    return !!(
      process.env.BLOOIO_API_KEY &&
      process.env.BLOOIO_FROM_NUMBER
    )
  }

  /**
   * Get a configured Blooio client instance
   */
  static getClient(): BlooioClient | null {
    if (!BlooioClient.isConfigured()) {
      console.log('[Blooio] Not configured - skipping iMessage support')
      return null
    }

    return new BlooioClient({
      apiKey: process.env.BLOOIO_API_KEY!,
      fromNumber: process.env.BLOOIO_FROM_NUMBER!,
    })
  }
}
