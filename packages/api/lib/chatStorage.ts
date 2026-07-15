import { v4 as uuidv4 } from 'uuid'
import { convex, api } from './convexClient'

// Chat Message Types
export interface ChatMessage {
  id?: string
  phone_number: string
  session_id: string
  role: 'user' | 'assistant'
  message: string
  created_at?: string
}

// In-memory stores (fast path; Convex is the durable source of truth)
const sessionByPhone = new Map<string, string>()
const messagesByPhone = new Map<string, ChatMessage[]>()


// Chat Storage Service (in-memory cache + Convex persistence)
export class ChatStorage {
  /**
   * Check if user profile exists in database
   */
  static async userProfileExists(phoneNumber: string): Promise<boolean> {
    if (!phoneNumber || !convex) return false

    try {
      const profile = await convex.query(api.profiles.getByPhone, { phoneNumber })
      return !!profile
    } catch (error) {
      console.error('[ChatStorage] Error checking profile:', error)
      return false
    }
  }

  /**
   * Get or create a session ID for a phone number
   */
  static async getOrCreateSession(phoneNumber: string): Promise<string> {
    const existing = sessionByPhone.get(phoneNumber)
    if (existing) return existing
    const sessionId = uuidv4()
    sessionByPhone.set(phoneNumber, sessionId)
    return sessionId
  }

  /**
   * Get or create user - returns phone number as identifier
   * Note: Full profile creation happens later when birth data is collected
   */
  static async getOrCreateUser(phoneNumber: string): Promise<string | null> {
    const sanitizedPhone = phoneNumber?.trim()
    if (!sanitizedPhone) return null

    // Initialize in-memory storage for this phone if needed
    if (!messagesByPhone.has(sanitizedPhone)) {
      messagesByPhone.set(sanitizedPhone, [])
    }

    // Return phone as the identifier (profile created later with birth data)
    return sanitizedPhone
  }

  /**
   * Save a chat message (in-memory + Convex persistence)
   */
  static async saveMessage(
    identifier: string,
    role: 'user' | 'assistant',
    message: string,
    sessionId?: string,
    options?: { identifierIsUserId?: boolean }
  ): Promise<ChatMessage | null> {
    try {
      if (!identifier || identifier.trim() === '') {
        console.error('saveMessage: identifier is empty or null')
        return null
      }

      // identifier is always phone number now
      const phoneNumber = identifier.trim()
      const finalSessionId = sessionId || await this.getOrCreateSession(phoneNumber)

      const msg: ChatMessage = {
        id: uuidv4(),
        phone_number: phoneNumber,
        session_id: finalSessionId,
        role,
        message,
        created_at: new Date().toISOString()
      }

      // Save to in-memory cache for fast access
      const existing = messagesByPhone.get(phoneNumber) || []
      existing.push(msg)
      messagesByPhone.set(phoneNumber, existing)

      // Persist to Convex
      if (convex) {
        try {
          await convex.mutation(api.chats.save, {
            phoneNumber,
            sessionId: finalSessionId,
            role,
            message,
          })
          console.log(`[ChatStorage] Chat persisted for ${phoneNumber}`)
        } catch (error) {
          console.error('[ChatStorage] Error persisting chat:', error)
        }
      }

      return msg
    } catch (error) {
      console.error('Error in saveMessage:', error)
      return null
    }
  }

  /**
   * Get conversation history for a phone number (in-memory with Convex fallback)
   */
  static async getConversationHistory(
    phoneNumber: string,
    limit: number = 20
  ): Promise<ChatMessage[]> {
    try {
      const sanitizedPhone = phoneNumber?.trim()
      if (!sanitizedPhone) return []

      const all = messagesByPhone.get(sanitizedPhone) || []
      const currentSession = sessionByPhone.get(sanitizedPhone)

      // If we have in-memory messages, use those
      if (all.length > 0) {
        const filtered = currentSession
          ? all.filter(m => m.session_id === currentSession)
          : all
        return filtered.slice(-limit)
      }

      // Fallback: Load from Convex if in-memory is empty (e.g., after cold start)
      if (convex) {
        try {
          const chats = await convex.query(api.chats.history, {
            phoneNumber: sanitizedPhone,
            limit,
          })

          if (chats && chats.length > 0) {
            console.log(`[ChatStorage] Loaded ${chats.length} messages from Convex for ${sanitizedPhone}`)

            const messages: ChatMessage[] = chats.map((chat: any) => ({
              id: chat._id,
              phone_number: sanitizedPhone,
              session_id: chat.sessionId,
              role: chat.role as 'user' | 'assistant',
              message: chat.message,
              created_at: new Date(chat._creationTime).toISOString()
            }))

            messagesByPhone.set(sanitizedPhone, messages)

            if (messages.length > 0) {
              sessionByPhone.set(sanitizedPhone, messages[messages.length - 1].session_id)
            }

            return messages
          }
        } catch (error) {
          console.error('[ChatStorage] Error loading history from Convex:', error)
        }
      }

      return []
    } catch (error) {
      console.error('Error in getConversationHistory:', error)
      return []
    }
  }

  /**
   * Format conversation history for OpenAI API
   */
  static formatForOpenAI(messages: ChatMessage[]): Array<{ role: 'user' | 'assistant', content: string }> {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.message
    }))
  }

  /**
   * Clear/start new session for a phone number
   */
  static async startNewSession(phoneNumber: string): Promise<string> {
    const sessionId = uuidv4()
    sessionByPhone.set(phoneNumber, sessionId)
    return sessionId
  }
}
