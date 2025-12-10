// Base class for Execution Agents
import { ExecutionResult, AgentContext } from './types'
import { v4 as uuidv4 } from 'uuid'

export abstract class ExecutionAgent {
  protected id: string
  protected task: string
  protected context: AgentContext
  protected logs: string[] = []
  protected startTime: number

  constructor(task: string, context: AgentContext) {
    this.id = uuidv4()
    this.task = task
    this.context = context
    this.startTime = Date.now()
    this.log(`Agent ${this.constructor.name} initialized for task: ${task}`)
  }

  abstract execute(): Promise<ExecutionResult>

  protected log(message: string) {
    const timestamp = new Date().toISOString()
    this.logs.push(`[${timestamp}] ${message}`)
    console.log(`[${this.constructor.name}] ${message}`)
  }

  protected createResult(
    status: 'success' | 'error' | 'partial',
    output: string,
    metadata?: Record<string, any>
  ): ExecutionResult {
    const duration = Date.now() - this.startTime
    return {
      agentId: this.id,
      task: this.task,
      status,
      output,
      logs: [...this.logs],
      metadata: {
        ...metadata,
        duration,
        agentType: this.constructor.name
      }
    }
  }

  getId(): string {
    return this.id
  }

  getTask(): string {
    return this.task
  }
}

