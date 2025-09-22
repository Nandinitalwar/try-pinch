'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChatDatabase, ChatSession } from './chatDatabase'
import { useAuth } from './AuthContext'

export function useChatSessions() {
  const { user, session } = useAuth()
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load chat sessions from database
  const loadChatSessions = useCallback(async () => {
    console.log('🔄 useChatSessions.loadChatSessions called')
    console.log('User and session check:', { user: !!user, session: !!session, userId: user?.id })
    
    if (!user || !session) {
      console.log('⚠️ No user or session - skipping load')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      console.log('📥 Loading chat sessions from database...')
      const sessions = await ChatDatabase.getChatSessions(user.id)
      console.log('✅ Loaded chat sessions:', sessions.length, 'sessions')
      setChatSessions(sessions)
    } catch (err: any) {
      setError(err.message)
      console.error('❌ Failed to load chat sessions:', err)
    } finally {
      setLoading(false)
    }
  }, [user, session])

  // Save a chat session to database
  const saveChatSession = useCallback(async (chatSession: ChatSession) => {
    console.log('🔄 useChatSessions.saveChatSession called with:', chatSession)
    console.log('User and session check:', { user: !!user, session: !!session, userId: user?.id })
    
    if (!user || !session) {
      console.log('⚠️ No user or session - skipping save')
      return
    }

    try {
      console.log('📤 Calling ChatDatabase.saveChatSession...')
      await ChatDatabase.saveChatSession(chatSession, user.id)
      console.log('✅ ChatDatabase.saveChatSession completed successfully')
      
      // Update local state
      setChatSessions(prev => {
        const existing = prev.find(c => c.id === chatSession.id)
        console.log('🔄 Updating local chat sessions state. Existing chat found:', !!existing)
        
        if (existing) {
          const updated = prev.map(c => c.id === chatSession.id ? chatSession : c)
          console.log('♻️ Updated existing chat in local state')
          return updated
        } else {
          const newList = [chatSession, ...prev]
          console.log('➕ Added new chat to local state. New list length:', newList.length)
          return newList
        }
      })
    } catch (err: any) {
      setError(err.message)
      console.error('❌ Failed to save chat session:', err)
    }
  }, [user, session])

  // Delete a chat session from database
  const deleteChatSession = useCallback(async (chatId: string) => {
    if (!user || !session) return

    try {
      await ChatDatabase.deleteChatSession(chatId, user.id)
      
      // Update local state
      setChatSessions(prev => prev.filter(c => c.id !== chatId))
    } catch (err: any) {
      setError(err.message)
      console.error('Failed to delete chat session:', err)
    }
  }, [user, session])

  // Update chat title
  const updateChatTitle = useCallback(async (chatId: string, title: string) => {
    if (!user || !session) return

    try {
      await ChatDatabase.updateChatTitle(chatId, user.id, title)
      
      // Update local state
      setChatSessions(prev => prev.map(c => 
        c.id === chatId ? { ...c, title, updatedAt: new Date() } : c
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
    } else {
      setChatSessions([])
    }
  }, [user, session, loadChatSessions])

  return {
    chatSessions,
    loading,
    error,
    saveChatSession,
    deleteChatSession,
    updateChatTitle,
    loadChatSessions
  }
}
