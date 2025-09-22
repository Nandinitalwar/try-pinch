'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useUserProfile } from '../lib/UserProfileContext'
import AuthPage from '../components/AuthPage'
import UserProfileSetup from '../components/UserProfileSetup'
import { User, Menu, X, Plus, MessageSquare, Send, LogOut } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { userProfile } = useUserProfile()
  const [messages, setMessages] = useState<any[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const startNewChat = () => {
    setMessages([])
    setInputMessage('')
    setSidebarOpen(false)
    inputRef.current?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || isLoading) return

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputMessage,
          history: messages.map(msg => ({ role: msg.role, content: msg.content })),
          userProfile: userProfile || null
        })
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()
      
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error:', error)
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-900 relative">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 fixed md:relative z-50 md:z-0
        w-64 bg-gray-800 flex flex-col h-full
        transition-transform duration-300 ease-in-out
      `}>
        <div className="p-4 border-b border-gray-700">
          <button 
            onClick={startNewChat}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2 px-3 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {!user && (
            <div className="p-4 text-center text-gray-400">
              <p className="text-sm mb-3">Sign in to save your chat history</p>
              <Link 
                href="/login"
                className="block w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2 px-3 text-sm transition-colors text-center"
                onClick={() => setSidebarOpen(false)}
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
              >
                <Menu size={24} />
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-white">AstroWorld</h1>
            </div>
            
            <div className="flex items-center gap-2">
              {user ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowProfileModal(true)}
                    className="rounded-lg py-2 px-3 text-sm bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                  >
                    Profile
                  </button>
                  <button
                    onClick={signOut}
                    className="rounded-lg p-2 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                    title="Sign out"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="rounded-lg py-2 px-3 text-sm bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center gap-2"
                >
                  <User size={16} />
                  <span className="hidden sm:inline">Log in</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-20">
              <h2 className="text-3xl font-bold mb-6 text-white">Welcome to AstroWorld</h2>
              <p className="mb-8">Your AI astrologer is ready to provide cosmic insights!</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {[
                  "What does this week hold for my career?",
                  "When will I find love?",
                  "Should I make a major life change?",
                  "What are my financial prospects?",
                  "How will my health be this month?",
                  "What opportunities await me?"
                ].map((question, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setInputMessage(question)
                      inputRef.current?.focus()
                      setSidebarOpen(false)
                    }}
                    className="p-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-purple-500 rounded-lg text-left text-sm text-gray-300 hover:text-white transition-all duration-200"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-100'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 rounded-lg px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="p-4 border-t border-gray-700">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about your astrological future..."
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className={`rounded-lg px-6 py-2 transition-colors ${
                isLoading || !inputMessage.trim()
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

      {/* Profile Modal */}
      {showProfileModal && user && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Your Profile</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <UserProfileSetup onClose={() => setShowProfileModal(false)} />
          </div>
        </div>
      )}
    </div>
  )
}