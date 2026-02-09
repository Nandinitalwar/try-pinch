/**
 * Message Buffer System
 * 
 * Debounces incoming messages per user to combine rapid successive messages
 * into a single request. Waits for 1.5s of "silence" before processing.
 */

interface PendingMessage {
  messages: string[]
  timer: NodeJS.Timeout
  resolve: (combined: string) => void
}

const DEBOUNCE_MS = 1500  // Wait 1.5 seconds for additional messages

// In-memory buffer (works for single-instance, for multi-instance use Redis)
const pendingMessages = new Map<string, PendingMessage>()

/**
 * Add a message to the buffer for a user. 
 * Returns { isFirst: true, promise } for the first message (caller should await promise)
 * Returns { isFirst: false } for subsequent messages (caller should return immediately)
 * 
 * @param userId - Unique identifier for the user (phone number)
 * @param message - The incoming message text
 */
export function bufferMessage(userId: string, message: string): { isFirst: true, promise: Promise<string> } | { isFirst: false } {
  const existing = pendingMessages.get(userId)
  
  if (existing) {
    // User already has pending messages - add to queue and reset timer
    console.log(`[MessageBuffer] ${userId}: Adding to existing buffer (${existing.messages.length} msgs)`)
    existing.messages.push(message)
    clearTimeout(existing.timer)
    
    // Set new timer
    existing.timer = setTimeout(() => {
      const combined = existing.messages.join('\n\n')
      console.log(`[MessageBuffer] ${userId}: Processing ${existing.messages.length} buffered messages`)
      pendingMessages.delete(userId)
      existing.resolve(combined)
    }, DEBOUNCE_MS)
    
    // Tell caller this wasn't the first message - they should return empty response
    return { isFirst: false }
  } else {
    // First message from this user - start new buffer
    console.log(`[MessageBuffer] ${userId}: Starting new buffer`)
    
    const promise = new Promise<string>((resolve) => {
      const timer = setTimeout(() => {
        const pending = pendingMessages.get(userId)
        if (pending) {
          const combined = pending.messages.join('\n\n')
          console.log(`[MessageBuffer] ${userId}: Processing ${pending.messages.length} buffered message(s)`)
          pendingMessages.delete(userId)
          resolve(combined)
        }
      }, DEBOUNCE_MS)
      
      pendingMessages.set(userId, {
        messages: [message],
        timer,
        resolve
      })
    })
    
    return { isFirst: true, promise }
  }
}

/**
 * Check if a user has pending messages being buffered
 */
export function hasPendingMessages(userId: string): boolean {
  return pendingMessages.has(userId)
}

/**
 * Cancel any pending buffer for a user (e.g., on error)
 */
export function cancelBuffer(userId: string): void {
  const existing = pendingMessages.get(userId)
  if (existing) {
    clearTimeout(existing.timer)
    pendingMessages.delete(userId)
    console.log(`[MessageBuffer] ${userId}: Buffer cancelled`)
  }
}