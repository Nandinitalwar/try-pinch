'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Generate session ID on mount
    setSessionId(`web-${Date.now()}`)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, sessionId })
      })

      const data = await res.json()
      
      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}` }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
        if (data.sessionId) setSessionId(data.sessionId)
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error. Please try again.' }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🔮 Pinch</h1>
        <p style={styles.subtitle}>Your AI astrologer</p>
      </div>

      <div style={styles.chatContainer}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <p>Ask me anything! Try:</p>
            <ul style={styles.suggestions}>
              <li>"Should I take a sick day tomorrow?"</li>
              <li>"What should I eat for dinner?"</li>
              <li>"Should I go to this party or stay home?"</li>
            </ul>
          </div>
        )}
        
        {messages.map((msg, i) => (
          <div key={i} style={{
            ...styles.message,
            ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage)
          }}>
            {msg.content}
          </div>
        ))}
        
        {isLoading && (
          <div style={{ ...styles.message, ...styles.assistantMessage }}>
            <span style={styles.typing}>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputContainer}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Pinch anything..."
          style={styles.input}
          disabled={isLoading}
        />
        <button onClick={sendMessage} disabled={isLoading || !input.trim()} style={styles.button}>
          Send
        </button>
      </div>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1a1a2e',
    color: '#eee',
  },
  header: {
    padding: '20px',
    textAlign: 'center',
    borderBottom: '1px solid #333',
  },
  title: {
    margin: 0,
    fontSize: '24px',
  },
  subtitle: {
    margin: '5px 0 0',
    color: '#888',
    fontSize: '14px',
  },
  chatContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
  },
  emptyState: {
    textAlign: 'center',
    color: '#666',
    marginTop: '40px',
  },
  suggestions: {
    listStyle: 'none',
    padding: 0,
    marginTop: '15px',
  },
  message: {
    padding: '12px 16px',
    borderRadius: '16px',
    marginBottom: '10px',
    maxWidth: '80%',
    wordWrap: 'break-word',
  },
  userMessage: {
    backgroundColor: '#4a4a8a',
    marginLeft: 'auto',
    borderBottomRightRadius: '4px',
  },
  assistantMessage: {
    backgroundColor: '#2d2d44',
    marginRight: 'auto',
    borderBottomLeftRadius: '4px',
  },
  typing: {
    fontStyle: 'italic',
    color: '#888',
  },
  inputContainer: {
    padding: '15px',
    borderTop: '1px solid #333',
    display: 'flex',
    gap: '10px',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '24px',
    border: 'none',
    backgroundColor: '#2d2d44',
    color: '#eee',
    fontSize: '16px',
    outline: 'none',
  },
  button: {
    padding: '12px 24px',
    borderRadius: '24px',
    border: 'none',
    backgroundColor: '#6a6aaa',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '16px',
  },
}
