'use client'

import { useState, useEffect, useRef } from 'react'

interface LogEntry {
  timestamp: string
  level: 'info' | 'error' | 'warn' | 'debug'
  message: string
  data?: any
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<string>('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [isProduction, setIsProduction] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsProduction(window.location.hostname.includes('vercel.app'))
  }, [])

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  // Poll for logs from the API
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/logs')
        if (response.ok) {
          const data = await response.json()
          setLogs(data.logs || [])
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error)
      }
    }, 1000) // Poll every second

    return () => clearInterval(interval)
  }, [])

  const clearLogs = async () => {
    try {
      await fetch('/api/logs', { method: 'DELETE' })
      setLogs([])
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  const filteredLogs = logs.filter(log => 
    !filter || 
    log.message.toLowerCase().includes(filter.toLowerCase()) ||
    JSON.stringify(log.data || '').toLowerCase().includes(filter.toLowerCase())
  )

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return '#ff4444'
      case 'warn': return '#ffaa00'
      case 'info': return '#4444ff'
      case 'debug': return '#888888'
      default: return '#ffffff'
    }
  }

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
      fontFamily: 'Monaco, Courier, monospace'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '20px',
        borderBottom: '1px solid #333',
        backgroundColor: '#0a0a0a'
      }}>
        <h1 style={{ margin: '0 0 15px 0', fontSize: '24px' }}>
          Backend Logs
        </h1>
        {isProduction && (
          <div style={{ 
            marginBottom: '15px', 
            padding: '10px', 
            backgroundColor: '#2a2a2a', 
            borderRadius: '4px',
            fontSize: '12px',
            color: '#ffaa00'
          }}>
            <strong>Production Mode:</strong> In-memory logs only show current session. For full logs, check{' '}
            <a 
              href="https://vercel.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#4a9eff', textDecoration: 'underline' }}
            >
              Vercel Dashboard → Functions → Logs
            </a>
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              backgroundColor: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '4px',
              color: '#ffffff',
              flex: '1',
              minWidth: '200px'
            }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
          <button
            onClick={clearLogs}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff4444',
              border: 'none',
              borderRadius: '4px',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Clear Logs
          </button>
          <div style={{ 
            padding: '8px 12px',
            backgroundColor: '#2a2a2a',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            {filteredLogs.length} / {logs.length} logs
          </div>
        </div>
      </div>

      {/* Logs Container */}
      <div style={{ 
        flex: 1,
        overflow: 'auto',
        padding: '10px'
      }}>
        {filteredLogs.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px',
            color: '#666',
            fontSize: '14px'
          }}>
            {logs.length === 0 
              ? (isProduction 
                  ? 'No in-memory logs. Check Vercel Dashboard for function logs, or make a request to see logs here.' 
                  : 'No logs yet. Make an API request to see logs appear here.')
              : 'No logs match your filter.'}
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={index}
              style={{
                padding: '10px',
                marginBottom: '5px',
                backgroundColor: '#2a2a2a',
                borderLeft: `4px solid ${getLevelColor(log.level)}`,
                borderRadius: '2px',
                fontSize: '13px',
                lineHeight: '1.5'
              }}
            >
              <div style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
                <span style={{ color: '#666', fontSize: '11px', minWidth: '80px' }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span style={{ 
                  color: getLevelColor(log.level),
                  fontWeight: 'bold',
                  minWidth: '50px',
                  fontSize: '11px',
                  textTransform: 'uppercase'
                }}>
                  {log.level}
                </span>
                <span style={{ flex: 1, wordBreak: 'break-word' }}>
                  {log.message}
                </span>
              </div>
              {log.data && (
                <pre style={{
                  margin: '5px 0 0 100px',
                  padding: '8px',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '2px',
                  fontSize: '11px',
                  overflow: 'auto',
                  color: '#88ff88'
                }}>
                  {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  )
}

