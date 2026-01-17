import { v4 as uuidv4 } from 'uuid'
import { supabase } from './supabase'

// Chat Message Types
export interface ChatMessage {
  id?: string
  phone_number: string
  session_id: string
  role: 'user' | 'assistant'
  message: string
  created_at?: string
}

// In-memory stores (conversation history is ephemeral by design)
const sessionByPhone = new Map<string, string>()
const messagesByPhone = new Map<string, ChatMessage[]>()

// Chat Storage Service (in-memory chat history, Supabase for user_profiles/memories)
export class ChatStorage {
  /**
   * Check if user profile exists in database
   */
  static async userProfileExists(phoneNumber: string): Promise<boolean> {
    if (!phoneNumber) return false
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('phone_number', phoneNumber)
      .single()
    
    return !error && !!data
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
   * Save a chat message (in-memory only)
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

      const existing = messagesByPhone.get(phoneNumber) || []
      existing.push(msg)
      messagesByPhone.set(phoneNumber, existing)

      return msg
    } catch (error) {
      console.error('Error in saveMessage:', error)
      return null
    }
  }

  /**
   * Get conversation history for a phone number (in-memory)
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
      
      // Filter to current session if exists
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
   * Clear/start new session for a phone number
   */
  static async startNewSession(phoneNumber: string): Promise<string> {
    const sessionId = uuidv4()
    sessionByPhone.set(phoneNumber, sessionId)
    return sessionId
  }

  /**
   * Get user memories from database
   */
  static async getUserMemories(phoneNumber: string): Promise<Array<{ memory_content: string, memory_type: string, importance: number }>> {
    if (!phoneNumber) return []
    
    const { data, error } = await supabase
      .from('user_memories')
      .select('memory_content, memory_type, importance')
      .eq('phone_number', phoneNumber)
      .order('importance', { ascending: false })
    
    if (error) {
      console.error('Error fetching memories:', error)
      return []
    }
    
    return data || []
  }
}
