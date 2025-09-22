import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { NewChatDatabase, ChatMessage, ChatSession } from './newChatDatabase'

export function useNewChatSessions() {
  const { user, session } = useAuth()
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load chat sessions from database
  const loadChatSessions = useCallback(async () => {
    console.log('🔄 useNewChatSessions.loadChatSessions called')
    console.log('User and session check:', { user: !!user, session: !!session, userId: user?.id })
    
    if (!user || !session) {
      console.log('⚠️ No user or session - skipping load')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      console.log('📥 Loading chat sessions from new database...')
      const sessions = await NewChatDatabase.getUserChatSessions(user.id)
      console.log('✅ Loaded chat sessions:', sessions.length, 'sessions')
      setChatSessions(sessions)
    } catch (err: any) {
      setError(err.message)
      console.error('❌ Failed to load chat sessions:', err)
    } finally {
      setLoading(false)
    }
  }, [user, session])

  // Save a message to the database
  const saveMessage = useCallback(async (message: Omit<ChatMessage, 'id' | 'created_at' | 'user_id'>) => {
    console.log('🔄 useNewChatSessions.saveMessage called with:', message)
    console.log('User and session check:', { user: !!user, session: !!session, userId: user?.id })
    
    if (!user || !session) {
      console.log('⚠️ No user or session - skipping save')
      return null
    }

    try {
      console.log('📤 Calling NewChatDatabase.saveMessage...')
      console.log('🔍 User ID validation:', { userId: user.id, type: typeof user.id })
      
      const savedMessage = await NewChatDatabase.saveMessage({
        ...message,
        user_id: user.id
      }, user.email)
      console.log('✅ NewChatDatabase.saveMessage completed successfully')
      
      // Reload chat sessions to update the UI
      await loadChatSessions()
      
      return savedMessage
    } catch (err: any) {
      setError(err.message)
      console.error('❌ Failed to save message:', err)
      return null
    }
  }, [user, session, loadChatSessions])

  // Delete a chat session from database
  const deleteChatSession = useCallback(async (sessionId: string) => {
    if (!user || !session) return

    try {
      await NewChatDatabase.deleteChatSession(sessionId, user.id)
      
      // Update local state
      setChatSessions(prev => prev.filter(session => session.id !== sessionId))
    } catch (err: any) {
      setError(err.message)
      console.error('Failed to delete chat session:', err)
    }
  }, [user, session])

  // Update chat session title
  const updateChatTitle = useCallback(async (sessionId: string, title: string) => {
    if (!user || !session) return

    try {
      await NewChatDatabase.updateChatSessionTitle(sessionId, user.id, title)
      
      // Update local state
      setChatSessions(prev => prev.map(session => 
        session.id === sessionId ? { ...session, title } : session
      ))
    } catch (err: any) {
      setError(err.message)
      console.error('Failed to update chat title:', err)
    }
  }, [user, session])

  // Load chat sessions when user changes
  useEffect(() => {
    if (user && session) {
      loadChatSessions()
    }
  }, [user, session, loadChatSessions])

  return {
    chatSessions,
    loading,
    error,
    saveMessage,
    deleteChatSession,
    updateChatTitle,
    loadChatSessions
  }
}
