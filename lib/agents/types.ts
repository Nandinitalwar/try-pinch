// Agent Types and Interfaces

export interface ExecutionResult {
  agentId: string
  task: string
  status: 'success' | 'error' | 'partial'
  output: string
  logs: string[]
  metadata?: Record<string, any>
}

export interface Task {
  id: string
  type: string
  description: string
  priority: number
  requiresAgent?: string // Specific agent type if needed
}

export interface AgentContext {
  userId: string
  phoneNumber: string
  conversationHistory: Array<{ role: 'user' | 'assistant', content: string }>
  userProfile?: Record<string, any>
  userMemories?: Array<any>
}

