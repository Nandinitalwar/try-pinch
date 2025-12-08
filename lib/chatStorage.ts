import { supabase } from './supabase'
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

// Chat Storage Service
export class ChatStorage {
  
  /**
   * Get or create user ID by phone number
   * This ensures we have a user_id to link chats to
   */
  static async getUserIdByPhone(phoneNumber: string): Promise<string | null> {
    try {
      if (!phoneNumber) {
        console.error('getUserIdByPhone: phoneNumber is empty or null')
        return null
      }

      if (!supabase) {
        console.error('getUserIdByPhone: Supabase client is null - check environment variables')
        return null
      }

      console.log('getUserIdByPhone: Looking for user with phone:', phoneNumber)
      
      // Try to find existing user
      const { data: user, error } = await supabase
        .from('users')
        .select('id')
        .eq('phone_number', phoneNumber)
        .single()

      if (user) {
        console.log('getUserIdByPhone: Found existing user:', user.id)
        return user.id
      }

      // If user doesn't exist, create them
      if (error?.code === 'PGRST116') {
        console.log('getUserIdByPhone: User not found, creating new user with phone:', phoneNumber)
        console.log('Inserting user with phone_number:', phoneNumber)
        console.log('Phone number type:', typeof phoneNumber)
        console.log('Phone number is truthy:', !!phoneNumber)
        
        // Ensure phone_number is always set - use fallback if needed
        let finalPhoneNumber = phoneNumber?.trim() || ''
        
        if (!finalPhoneNumber || finalPhoneNumber === '') {
          console.error('ERROR: phone_number is empty or null, generating fallback')
          // Generate a unique fallback identifier
          finalPhoneNumber = `fallback_${Date.now()}_${Math.random().toString(36).substring(7)}`
          console.log('Generated fallback phone_number:', finalPhoneNumber)
        }
        
        // Double-check it's not null/empty before insert
        if (!finalPhoneNumber || finalPhoneNumber.trim() === '') {
          console.error('ERROR: Cannot create user - phone_number is still empty after fallback')
          return null
        }
        
        const insertData = { phone_number: finalPhoneNumber.trim() }
        console.log('Insert data (final):', JSON.stringify(insertData))
        console.log('Phone number length:', insertData.phone_number.length)
        console.log('Phone number is not null:', insertData.phone_number !== null)
        console.log('Phone number is not undefined:', insertData.phone_number !== undefined)
        
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert(insertData)
          .select('id, phone_number')
          .single()

        if (insertError) {
          console.error('Error creating user:', insertError)
          console.error('Insert data that failed:', JSON.stringify(insertData))
          console.error('Phone number used:', finalPhoneNumber)
          console.error('Phone number type:', typeof finalPhoneNumber)
          console.error('Phone number length:', finalPhoneNumber?.length)
          return null
        }

        console.log('getUserIdByPhone: Created new user:', newUser?.id)
        console.log('Created user phone_number:', newUser?.phone_number)
        
        // Verify the created user has phone_number
        if (!newUser?.phone_number) {
          console.error('ERROR: Created user but phone_number is null!')
          console.error('New user data:', JSON.stringify(newUser, null, 2))
        }
        
        return newUser?.id || null
      }

      console.error('Error fetching user:', error)
      return null
    } catch (error) {
      console.error('Error in getUserIdByPhone:', error)
      return null
    }
  }

  /**
   * Get or create a session ID for a user
   * Creates a new session or returns the most recent one
   */
  static async getOrCreateSession(userId: string): Promise<string> {
    try {
      // Get the most recent session for this user
      const { data: recentChat } = await supabase
        .from('chats')
        .select('session_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (recentChat?.session_id) {
        return recentChat.session_id
      }

      // Create new session ID
      return uuidv4()
    } catch (error) {
      // If no recent chat found, create new session
      return uuidv4()
    }
  }

  /**
   * Save a chat message
   */
  static async saveMessage(
    phoneNumber: string,
    role: 'user' | 'assistant',
    message: string,
    sessionId?: string
  ): Promise<ChatMessage | null> {
    try {
      // Validate phone number before proceeding
      if (!phoneNumber || phoneNumber.trim() === '') {
        console.error('saveMessage: phoneNumber is empty or null')
        console.error('Cannot save message without phone number')
        return null
      }
      
      // Get user ID (this will create user if needed)
      const userId = await this.getUserIdByPhone(phoneNumber.trim())
      if (!userId) {
        console.error('Failed to get user ID for phone:', phoneNumber)
        console.error('This means user creation failed - check logs above')
        return null
      }
      
      console.log('saveMessage: Got user ID:', userId, 'for phone:', phoneNumber)

      // Get or create session ID
      const finalSessionId = sessionId || await this.getOrCreateSession(userId)

      // Insert chat message
      const { data, error } = await supabase
        .from('chats')
        .insert({
          user_id: userId,
          session_id: finalSessionId,
          role,
          message
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving chat message:', error)
        return null
      }

      return data
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
      // Get user ID
      const userId = await this.getUserIdByPhone(phoneNumber)
      if (!userId) {
        return []
      }

      // Get session ID (most recent)
      const sessionId = await this.getOrCreateSession(userId)

      // Fetch messages from this session
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (error) {
        console.error('Error fetching conversation history:', error)
        return []
      }

      return data || []
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
    if (!userId) {
      return uuidv4()
    }
    return uuidv4()
  }
}
