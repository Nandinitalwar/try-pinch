import crypto from 'crypto'

// Linq Partner API v3 iMessage integration.
// API docs: https://docs.linqapp.com

export interface LinqConfig {
  apiKey: string
}

export interface LinqResponse {
  status: 'OK' | 'ERROR'
  message_id?: string
  chat_id?: string
  error?: string
}

export interface LinqInboundMessage {
  eventType: string
  eventId: string
  messageId: string
  chatId: string
  direction: 'inbound' | 'outbound' | string
  sender: string
  recipient: string
  text: string
  service: string | null
  isGroup: boolean
  isReconciled: boolean
  attachmentUrls: string[]
}

interface LinqPart {
  type?: string
  value?: string
  url?: string
  fallback_text?: string
}

function normalizeParts(raw: unknown): {
  text: string
  attachmentUrls: string[]
} {
  if (!Array.isArray(raw)) {
    return { text: '', attachmentUrls: [] }
  }

  const parts = raw as LinqPart[]
  const text = parts
    .map(part => {
      if ((part.type === 'text' || part.type === 'link') && typeof part.value === 'string') {
        return part.value
      }
      if (part.type === 'imessage_app' && typeof part.fallback_text === 'string') {
        return part.fallback_text
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')

  const attachmentUrls = parts
    .filter(part => part.type === 'media' && typeof part.url === 'string')
    .map(part => part.url as string)

  return { text, attachmentUrls }
}

/**
 * Normalize both supported Linq webhook formats:
 * - 2026-02-03: message fields live directly under `data`
 * - 2025-01-01: message fields live under `data.message`
 */
export function parseLinqWebhook(payload: unknown): LinqInboundMessage | null {
  if (!payload || typeof payload !== 'object') return null

  const envelope = payload as Record<string, any>
  const data = envelope.data
  if (typeof envelope.event_type !== 'string' || !data || typeof data !== 'object') {
    return null
  }

  if (data.chat && Array.isArray(data.parts)) {
    const { text, attachmentUrls } = normalizeParts(data.parts)
    return {
      eventType: envelope.event_type,
      eventId: envelope.event_id || '',
      messageId: data.id || '',
      chatId: data.chat.id || '',
      direction: data.direction || '',
      sender: data.sender_handle?.handle || '',
      recipient: data.chat.owner_handle?.handle || '',
      text,
      service: data.service ?? null,
      isGroup: !!data.chat.is_group,
      isReconciled: !!data.reconciled_at,
      attachmentUrls,
    }
  }

  if (data.message && Array.isArray(data.message.parts)) {
    const { text, attachmentUrls } = normalizeParts(data.message.parts)
    return {
      eventType: envelope.event_type,
      eventId: envelope.event_id || '',
      messageId: data.message.id || '',
      chatId: data.chat_id || '',
      direction: data.is_from_me ? 'outbound' : 'inbound',
      sender: data.from_handle?.handle || data.from || '',
      recipient: data.recipient_handle?.handle || data.recipient_phone || '',
      text,
      service: data.service ?? null,
      isGroup: !!data.is_group,
      isReconciled: !!(data.reconciled_at || data.message.reconciled_at),
      attachmentUrls,
    }
  }

  return null
}

/**
 * Verify Linq's Standard Webhooks signature and reject replays older than five minutes.
 */
export function verifyLinqWebhookSignature(
  rawBody: string,
  headers: Pick<Headers, 'get'>,
  webhookSecret: string,
  nowMs: number = Date.now()
): boolean {
  const messageId = headers.get('webhook-id')
  const timestamp = headers.get('webhook-timestamp')
  const signatures = headers.get('webhook-signature')

  if (!messageId || !timestamp || !signatures || !webhookSecret) {
    return false
  }

  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds)) return false

  const ageSeconds = Math.abs(nowMs / 1000 - timestampSeconds)
  if (ageSeconds > 5 * 60) return false

  try {
    const encodedSecret = webhookSecret.startsWith('whsec_')
      ? webhookSecret.slice('whsec_'.length)
      : webhookSecret
    const key = Buffer.from(encodedSecret, 'base64')
    if (key.length === 0) return false

    const signedContent = `${messageId}.${timestamp}.${rawBody}`
    const expected = crypto
      .createHmac('sha256', key)
      .update(signedContent)
      .digest()

    return signatures.split(' ').some(candidate => {
      if (!candidate.startsWith('v1,')) return false

      try {
        const provided = Buffer.from(candidate.slice(3), 'base64')
        return provided.length === expected.length && crypto.timingSafeEqual(provided, expected)
      } catch {
        return false
      }
    })
  } catch {
    return false
  }
}

/**
 * Small fetch-based Linq client. Replies use the webhook's chat ID; proactive sends
 * use Linq's managed endpoint so an active chat/line is reused automatically.
 */
export class LinqClient {
  private apiKey: string
  private baseUrl = 'https://api.linqapp.com/api/partner/v3'

  constructor(config: LinqConfig) {
    this.apiKey = config.apiKey
  }

  async sendMessage(params: {
    to: string
    content?: string
    mediaUrl?: string
    chatId?: string
    idempotencyKey?: string
  }): Promise<LinqResponse> {
    const parts: Array<Record<string, string>> = []
    if (params.content) {
      parts.push({ type: 'text', value: params.content })
    }
    if (params.mediaUrl) {
      parts.push({ type: 'media', url: params.mediaUrl })
    }

    if (parts.length === 0) {
      return { status: 'ERROR', error: 'A text or media part is required' }
    }

    const message: Record<string, unknown> = { parts }
    if (params.idempotencyKey) {
      message.idempotency_key = params.idempotencyKey
    }

    const isReply = !!params.chatId
    const url = isReply
      ? `${this.baseUrl}/chats/${encodeURIComponent(params.chatId!)}/messages`
      : `${this.baseUrl}/messages`
    const body = isReply
      ? { message }
      : { to: [params.to], message }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const responseText = await response.text()
      let data: any = {}
      if (responseText) {
        try {
          data = JSON.parse(responseText)
        } catch {
          return {
            status: 'ERROR',
            error: `Invalid JSON response from Linq (HTTP ${response.status})`,
          }
        }
      }

      if (!response.ok) {
        return {
          status: 'ERROR',
          error:
            data.error?.message ||
            data.message ||
            `Failed to send message (HTTP ${response.status})`,
        }
      }

      return {
        status: 'OK',
        message_id: data.message?.id || data.message_id || data.last_message?.id,
        chat_id: data.chat_id || data.id || params.chatId,
      }
    } catch (error) {
      return {
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  static isConfigured(): boolean {
    return !!process.env.LINQ_API_KEY
  }

  static getClient(): LinqClient | null {
    if (!LinqClient.isConfigured()) {
      console.log('[Linq] Not configured - skipping iMessage support')
      return null
    }

    return new LinqClient({ apiKey: process.env.LINQ_API_KEY! })
  }
}
