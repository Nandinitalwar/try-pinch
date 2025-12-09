// Simple logger - just console.log wrapper
export function addLog(level: 'info' | 'error' | 'warn' | 'debug', message: string, data?: any) {
  const prefix = `[${level.toUpperCase()}]`
  if (data) {
    console.log(prefix, message, data)
  } else {
    console.log(prefix, message)
  }
}
