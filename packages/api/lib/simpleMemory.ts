// User memory via Mem0 (https://docs.mem0.ai)
// Mem0 handles extraction, deduplication, and semantic retrieval server-side:
// we send raw conversation turns, it decides what's worth remembering.
//
// Keeps the SimpleMemorySystem class name/interface so webhook routes and the
// agent pipeline work unchanged from the old homegrown implementation.

export interface SimpleMemory {
  id?: string
  phone_number: string
  memory_content: string
  memory_type: string
  importance: number
  created_at?: string
}

const MEM0_BASE_URL = 'https://api.mem0.ai/v1'

function mem0Key(): string | null {
  const key = process.env.MEM0_API_KEY?.trim()
  return key || null
}

async function mem0Fetch(path: string, init: RequestInit = {}): Promise<any> {
  const key = mem0Key()
  if (!key) {
    console.error('[Memory] MEM0_API_KEY not configured')
    return null
  }

  const response = await fetch(`${MEM0_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Authorization': `Token ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })

  const text = await response.text()
  if (!response.ok) {
    console.error(`[Memory] Mem0 ${init.method || 'GET'} ${path} failed (${response.status}):`, text.substring(0, 300))
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export class SimpleMemorySystem {
  /**
   * Send a conversation turn to Mem0 - it extracts and stores memorable
   * facts server-side (preferences, relationships, plans, etc).
   * Returns the extracted memories (may be empty if nothing was memorable).
   */
  async extractMemories(userMessage: string, agentResponse: string, phoneNumber?: string): Promise<SimpleMemory[]> {
    // Without a phone number we can't attribute memories to a user;
    // actual storage happens in storeMemories which has the number.
    this.pendingTurn = { userMessage, agentResponse }
    return [{
      phone_number: phoneNumber || '',
      memory_content: userMessage,
      memory_type: 'conversation',
      importance: 5,
    }]
  }

  private pendingTurn: { userMessage: string; agentResponse: string } | null = null

  /**
   * Store the buffered conversation turn in Mem0 for this user.
   * Mem0 decides what facts to extract and deduplicates against
   * existing memories automatically.
   */
  async storeMemories(phoneNumber: string, _memories: SimpleMemory[]): Promise<boolean> {
    if (!this.pendingTurn) {
      console.log('[Memory] No pending conversation turn to store')
      return false
    }

    const { userMessage, agentResponse } = this.pendingTurn
    this.pendingTurn = null

    const result = await mem0Fetch('/memories/', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: agentResponse },
        ],
        user_id: phoneNumber,
      }),
    })

    if (result === null) return false

    const extracted = Array.isArray(result) ? result : result.results || []
    console.log(`[Memory] Mem0 processed turn for ${phoneNumber}: ${extracted.length} memory operation(s)`)
    return true
  }

  /**
   * Retrieve memories for a user. When a query is provided, uses Mem0's
   * semantic search to return the most relevant memories; otherwise
   * returns the most recent ones.
   */
  async getMemories(phoneNumber: string, limit: number = 10, query?: string): Promise<SimpleMemory[]> {
    let items: any[] = []

    if (query) {
      const result = await mem0Fetch('/memories/search/', {
        method: 'POST',
        body: JSON.stringify({ query, user_id: phoneNumber, limit }),
      })
      items = (Array.isArray(result) ? result : result?.results) || []
    } else {
      const result = await mem0Fetch(`/memories/?user_id=${encodeURIComponent(phoneNumber)}`)
      items = ((Array.isArray(result) ? result : result?.results) || []).slice(0, limit)
    }

    return items.map((m: any) => ({
      id: m.id,
      phone_number: phoneNumber,
      memory_content: m.memory || m.text || '',
      memory_type: m.categories?.[0] || 'general',
      importance: typeof m.score === 'number' ? Math.round(m.score * 10) : 7,
      created_at: m.created_at,
    })).filter(m => m.memory_content)
  }

  /**
   * Format memories for agent prompt
   */
  static formatMemories(memories: SimpleMemory[]): string {
    if (memories.length === 0) {
      return "No previous memories about this user."
    }

    let context = "What you remember about this user:\n"
    for (const mem of memories) {
      context += `- ${mem.memory_content}\n`
    }
    return context
  }
}
