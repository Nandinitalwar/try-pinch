import { supabase } from './supabase'

export interface ChatMessage {
  id?: string
  user_id: string
  session_id: string
  role: 'user' | 'assistant'
  message: string
  created_at?: Date
  email?: string
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
  userId: string
}

export class NewChatDatabase {
  // Upsert user into the users table
  static async upsertUser(userId: string, email?: string): Promise<void> {
    console.log('🔍 Upserting user:', { userId, email })
    
    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          id: userId,
          email: email || null
        })

      if (error) {
        console.error('❌ Error upserting user:', error)
        throw error
      }
      console.log('✅ User upserted successfully')
    } catch (error) {
      console.error('❌ Failed to upsert user:', error)
      throw error
    }
  }

  // Save a chat message to the database
  static async saveMessage(message: ChatMessage, userEmail?: string): Promise<ChatMessage> {
    console.log('🗄️ NewChatDatabase.saveMessage called with:', message)
    
    try {
      // Upsert user first
      await this.upsertUser(message.user_id, userEmail)
      
      const insertData = {
        user_id: message.user_id,
        session_id: message.session_id,
        role: message.role,
        message: message.message,
        email: userEmail || null
      }
      
      console.log('📤 Inserting data to chats table:', insertData)
      console.log('📊 Data types:', {
        user_id: typeof insertData.user_id,
        session_id: typeof insertData.session_id,
        role: typeof insertData.role,
        message: typeof insertData.message,
        email: typeof insertData.email
      })
      
      const { data, error } = await supabase
        .from('chats')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error('❌ Supabase error saving message:', error)
        throw error
      }

      console.log('✅ Message saved successfully:', data)
      return {
        id: data.id,
        user_id: data.user_id,
        session_id: data.session_id,
        role: data.role,
        message: data.message,
        created_at: new Date(data.created_at)
      }
    } catch (error) {
      console.error('❌ Failed to save message:', error)
      throw error
    }
  }

  // Get all messages for a chat session
  static async getSessionMessages(sessionId: string, userId: string): Promise<ChatMessage[]> {
    console.log('📥 NewChatDatabase.getSessionMessages called:', { sessionId, userId })
    
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('❌ Supabase error fetching session messages:', error)
        throw error
      }

      console.log('📊 Raw session messages:', data)
      
      const messages = data?.map(msg => ({
        id: msg.id,
        user_id: msg.user_id,
        session_id: msg.session_id,
        role: msg.role,
        message: msg.message,
        created_at: new Date(msg.created_at)
      })) || []
      
      console.log('✅ Processed session messages:', messages.length, 'messages')
      return messages
    } catch (error) {
      console.error('❌ Failed to fetch session messages:', error)
      return []
    }
  }

  // Get all chat sessions for a user (grouped by session_id)
  static async getUserChatSessions(userId: string): Promise<ChatSession[]> {
    console.log('📥 NewChatDatabase.getUserChatSessions called for userId:', userId)
    
    try {
      // First, get all unique session IDs for the user
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('chats')
        .select('session_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (sessionsError) {
        console.error('❌ Supabase error fetching user sessions:', sessionsError)
        throw sessionsError
      }

      // Get unique session IDs
      const uniqueSessions = sessionsData?.reduce((acc, curr) => {
        if (!acc.find(s => s.session_id === curr.session_id)) {
          acc.push(curr)
        }
        return acc
      }, [] as any[]) || []

      console.log('📊 Unique sessions found:', uniqueSessions.length)

      // For each session, get the messages and create a ChatSession object
      const chatSessions: ChatSession[] = []
      
      for (const session of uniqueSessions) {
        const messages = await this.getSessionMessages(session.session_id, userId)
        
        if (messages.length > 0) {
          const firstUserMessage = messages.find(m => m.role === 'user')
          const title = firstUserMessage?.message.substring(0, 50) + '...' || 'New Chat'
          
          chatSessions.push({
            id: session.session_id,
            title,
            messages,
            createdAt: new Date(session.created_at),
            updatedAt: new Date(Math.max(...messages.map(m => m.created_at?.getTime() || 0))),
            userId
          })
        }
      }

      console.log('✅ Processed chat sessions:', chatSessions.length, 'sessions')
      return chatSessions
    } catch (error) {
      console.error('❌ Failed to fetch user chat sessions:', error)
      return []
    }
  }

  // Delete a chat session (all messages in that session)
  static async deleteChatSession(sessionId: string, userId: string): Promise<void> {
    console.log('🗑️ NewChatDatabase.deleteChatSession called:', { sessionId, userId })
    
    try {
      const { error } = await supabase
        .from('chats')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId)

      if (error) {
        console.error('❌ Supabase error deleting chat session:', error)
        throw error
      }

      console.log('✅ Chat session deleted successfully')
    } catch (error) {
      console.error('❌ Failed to delete chat session:', error)
      throw error
    }
  }

  // Update chat session title (by updating the first user message)
  static async updateChatSessionTitle(sessionId: string, userId: string, newTitle: string): Promise<void> {
    console.log('📝 NewChatDatabase.updateChatSessionTitle called:', { sessionId, userId, newTitle })
    
    try {
      // Get the first user message in the session
      const { data: firstMessage, error: fetchError } = await supabase
        .from('chats')
        .select('id')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('role', 'user')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (fetchError) {
        console.error('❌ Supabase error fetching first message:', fetchError)
        throw fetchError
      }

      // Update the first message with the new title
      const { error: updateError } = await supabase
        .from('chats')
        .update({ message: newTitle })
        .eq('id', firstMessage.id)

      if (updateError) {
        console.error('❌ Supabase error updating message:', updateError)
        throw updateError
      }

      console.log('✅ Chat session title updated successfully')
    } catch (error) {
      console.error('❌ Failed to update chat session title:', error)
      throw error
    }
  }
}
