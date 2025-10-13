// Centralized logging utility
// Works both locally and in production

export interface LogEntry {
  timestamp: string
  level: 'info' | 'error' | 'warn' | 'debug'
  message: string
  data?: any
}

// Store logs in memory (max 500 entries)
const MAX_LOGS = 500
let logs: LogEntry[] = []

// Export function to add logs from API routes
export function addLog(level: LogEntry['level'], message: string, data?: any) {
  const log: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data
  }
  
  logs.push(log)
  
  // Keep only the last MAX_LOGS entries
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(-MAX_LOGS)
  }
  
  // Also log to console for terminal visibility
  const consoleMethod = level === 'error' ? console.error : 
                       level === 'warn' ? console.warn : 
                       console.log
  
  consoleMethod(`[${level.toUpperCase()}]`, message, data || '')
}

// Get all logs
export function getLogs(): LogEntry[] {
  return logs
}

// Clear all logs
export function clearLogs(): void {
  logs = []
}

