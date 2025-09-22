import { supabase } from './supabase'

export interface ChatSession {
  id: string
  title: string
  messages: any[]
  createdAt: Date
  updatedAt: Date
  userProfile?: any
  userId?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  userProfile?: any
  predictionId?: string
}

export class ChatDatabase {
  // Save a chat session to the database
  static async saveChatSession(chatSession: ChatSession, userId: string) {
    console.log('🗄️ ChatDatabase.saveChatSession called with:', { 
      chatId: chatSession.id, 
      title: chatSession.title, 
      userId, 
      messageCount: chatSession.messages.length 
    })
    
    try {
      const payload = {
        id: chatSession.id,
        title: chatSession.title,
        user_id: userId,
        created_at: chatSession.createdAt.toISOString(),
        updated_at: chatSession.updatedAt.toISOString(),
        messages: chatSession.messages
      }
      
      console.log('📤 Supabase upsert payload:', payload)
      
      const { data, error } = await supabase
        .from('chat_sessions')
        .upsert(payload)

      if (error) {
        console.error('❌ Supabase error saving chat session:', error)
        throw error
      }

      console.log('✅ Supabase upsert successful:', data)
      return data
    } catch (error) {
      console.error('❌ Failed to save chat session:', error)
      throw error
    }
  }

  // Get all chat sessions for a user
  static async getChatSessions(userId: string): Promise<ChatSession[]> {
    console.log('📥 ChatDatabase.getChatSessions called for userId:', userId)
    
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('❌ Supabase error fetching chat sessions:', error)
        throw error
      }

      console.log('📊 Raw Supabase data:', data)
      
      const sessions = data?.map(session => ({
        id: session.id,
        title: session.title,
        messages: session.messages || [],
        createdAt: new Date(session.created_at),
        updatedAt: new Date(session.updated_at),
        userId: session.user_id
      })) || []
      
      console.log('✅ Processed chat sessions:', sessions.length, 'sessions')
      return sessions
    } catch (error) {
      console.error('❌ Failed to fetch chat sessions:', error)
      return []
    }
  }

  // Get a specific chat session
  static async getChatSession(chatId: string, userId: string): Promise<ChatSession | null> {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', chatId)
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('Error fetching chat session:', error)
        return null
      }

      return {
        id: data.id,
        title: data.title,
        messages: data.messages || [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        userId: data.user_id
      }
    } catch (error) {
      console.error('Failed to fetch chat session:', error)
      return null
    }
  }

  // Delete a chat session
  static async deleteChatSession(chatId: string, userId: string) {
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', chatId)
        .eq('user_id', userId)

      if (error) {
        console.error('Error deleting chat session:', error)
        throw error
      }

      return true
    } catch (error) {
      console.error('Failed to delete chat session:', error)
      throw error
    }
  }

  // Update chat session title
  static async updateChatTitle(chatId: string, userId: string, title: string) {
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ 
          title,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId)
        .eq('user_id', userId)

      if (error) {
        console.error('Error updating chat title:', error)
        throw error
      }

      return true
    } catch (error) {
      console.error('Failed to update chat title:', error)
      throw error
    }
  }
}
