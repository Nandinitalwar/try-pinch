// SendBlue iMessage Integration
// Allows sending iMessages alongside SMS via Twilio

export interface SendBlueConfig {
  apiKeyId: string
  apiSecretKey: string
  fromNumber: string
}

export interface SendBlueMessage {
  number: string // E.164 formatted recipient phone number
  from_number: string // E.164 formatted sender phone number
  content?: string // Message content
  media_url?: string // URL to media file
  send_style?: string // Expressive message style
  status_callback?: string // URL for status updates
}

export interface SendBlueResponse {
  status: 'OK' | 'ERROR'
  message_handle?: string
  error?: string
}

export interface SendBlueWebhookPayload {
  accountEmail: string
  content: string
  is_outbound: boolean
  status: string
  error_code: number | null
  error_message: string | null
  error_reason: string | null
  error_detail: string | null
  message_handle: string
  date_sent: string
  date_updated: string
  from_number: string
  number: string
  to_number: string
  was_downgraded: boolean | null
  plan: string
  media_url: string
  message_type: string
  group_id: string
  participants: string[]
  send_style: string
  opted_out: boolean
  sendblue_number: string | null
  service: 'iMessage' | 'SMS' | 'RCS'
  group_display_name: string | null
}

/**
 * SendBlue API client for sending iMessages
 */
export class SendBlueClient {
  private apiKeyId: string
  private apiSecretKey: string
  private fromNumber: string
  private baseUrl = 'https://api.sendblue.co/api'

  constructor(config: SendBlueConfig) {
    this.apiKeyId = config.apiKeyId
    this.apiSecretKey = config.apiSecretKey
    this.fromNumber = config.fromNumber
  }

  /**
   * Send a message via SendBlue (iMessage with SMS fallback)
   */
  async sendMessage(params: {
    to: string
    content?: string
    mediaUrl?: string
    statusCallback?: string
  }): Promise<SendBlueResponse> {
    try {
      const body: SendBlueMessage = {
        number: params.to,
        from_number: this.fromNumber,
        content: params.content,
        media_url: params.mediaUrl,
        status_callback: params.statusCallback,
      }

      const response = await fetch(`${this.baseUrl}/send-message`, {
        method: 'POST',
        headers: {
          'sb-api-key-id': this.apiKeyId,
          'sb-api-secret-key': this.apiSecretKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('[SendBlue] API error:', data)
        return {
          status: 'ERROR',
          error: data.message || 'Failed to send message',
        }
      }

      return {
        status: 'OK',
        message_handle: data.message_handle,
      }
    } catch (error) {
      console.error('[SendBlue] Send error:', error)
      return {
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Check if SendBlue is configured
   */
  static isConfigured(): boolean {
    return !!(
      process.env.SENDBLUE_API_KEY_ID &&
      process.env.SENDBLUE_API_SECRET_KEY &&
      process.env.SENDBLUE_FROM_NUMBER
    )
  }

  /**
   * Get a configured SendBlue client instance
   */
  static getClient(): SendBlueClient | null {
    if (!SendBlueClient.isConfigured()) {
      console.log('[SendBlue] Not configured - skipping iMessage support')
      return null
    }

    return new SendBlueClient({
      apiKeyId: process.env.SENDBLUE_API_KEY_ID!,
      apiSecretKey: process.env.SENDBLUE_API_SECRET_KEY!,
      fromNumber: process.env.SENDBLUE_FROM_NUMBER!,
    })
  }
}

