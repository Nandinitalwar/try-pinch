import { v4 as uuidv4 } from 'uuid'

// Chat Message Types
export interface ChatMessage {
  id?: string
  user_id: string
  session_id: string
  role: 'user' | 'assistant'
  message: string
  created_at?: string
}

// In-memory stores (ephemeral; cleared on cold start)
const usersByPhone = new Map<string, string>() // phone -> userId
const messagesByUser = new Map<string, ChatMessage[]>() // userId -> messages
const sessionByUser = new Map<string, string>() // userId -> current session

// Chat Storage Service (in-memory)
export class ChatStorage {
  /**
   * Get or create user ID by phone number (in-memory)
   */
  static async getUserIdByPhone(phoneNumber: string): Promise<string | null> {
    if (!phoneNumber) return null
    const existing = usersByPhone.get(phoneNumber)
    if (existing) return existing
    const userId = uuidv4()
    usersByPhone.set(phoneNumber, userId)
    return userId
  }

  /**
   * Get or create a session ID for a user (in-memory)
   */
  static async getOrCreateSession(userId: string): Promise<string> {
    const existing = sessionByUser.get(userId)
    if (existing) return existing
    const sessionId = uuidv4()
    sessionByUser.set(userId, sessionId)
    return sessionId
  }

  /**
   * Get or create a user by phone number and return the user UUID (in-memory)
   */
  static async getOrCreateUser(phoneNumber: string): Promise<string | null> {
    const sanitizedPhone = phoneNumber?.trim()
    if (!sanitizedPhone) return null
    const existing = usersByPhone.get(sanitizedPhone)
    if (existing) return existing
    const userId = uuidv4()
    usersByPhone.set(sanitizedPhone, userId)
    return userId
  }

  /**
   * Save a chat message
   */
  static async saveMessage(
    identifier: string,
    role: 'user' | 'assistant',
    message: string,
    sessionId?: string,
    options?: { identifierIsUserId?: boolean }
  ): Promise<ChatMessage | null> {
    try {
      const identifierLabel = options?.identifierIsUserId ? 'userId' : 'phoneNumber'

      // Validate identifier before proceeding
      if (!identifier || identifier.trim() === '') {
        console.error(`saveMessage: ${identifierLabel} is empty or null`)
        console.error(`Cannot save message without ${identifierLabel}`)
        return null
      }
      
      let userId: string | null = null
      if (options?.identifierIsUserId) {
        userId = identifier.trim()
      } else {
        userId = await this.getOrCreateUser(identifier.trim())
      }

      if (!userId) {
        console.error('Failed to resolve user ID')
        return null
      }

      // Get or create session ID
      const finalSessionId = sessionId || await this.getOrCreateSession(userId)

      // Build message record
      const msg: ChatMessage = {
        id: uuidv4(),
        user_id: userId,
        session_id: finalSessionId,
        role,
        message,
        created_at: new Date().toISOString()
      }

      const existing = messagesByUser.get(userId) || []
      existing.push(msg)
      messagesByUser.set(userId, existing)

      return msg
    } catch (error) {
      console.error('Error in saveMessage:', error)
      return null
    }
  }

  /**
   * Get conversation history for a phone number
   * Returns the most recent session's messages
   */
  static async getConversationHistory(
    phoneNumber: string,
    limit: number = 20
  ): Promise<ChatMessage[]> {
    try {
      const userId = await this.getUserIdByPhone(phoneNumber)
      if (!userId) return []

      const all = messagesByUser.get(userId) || []
      // Return the most recent `limit` messages for the current session (if any)
      const currentSession = sessionByUser.get(userId)
      const filtered = currentSession
        ? all.filter(m => m.session_id === currentSession)
        : all

      return filtered.slice(-limit)
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
   * Clear/start new session for a user
   */
  static async startNewSession(phoneNumber: string): Promise<string> {
    const userId = await this.getUserIdByPhone(phoneNumber)
    const sessionId = uuidv4()
    if (userId) {
      sessionByUser.set(userId, sessionId)
    }
    return sessionId
  }
}
