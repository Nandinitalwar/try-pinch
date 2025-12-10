// Interaction Agent - Main orchestrator that manages execution agents
import { AgentRegistry } from './agentRegistry'
import { TaskDecomposer } from './taskDecomposer'
import { ExecutionAgent } from './executionAgent'
import { GeneralTaskAgent } from './agents/generalTaskAgent'
import { Task, ExecutionResult, AgentContext } from './types'
import { GoogleGenerativeAI } from '@google/generative-ai'

export class InteractionAgent {
  private registry: AgentRegistry
  private decomposer: TaskDecomposer
  private genAI: GoogleGenerativeAI
  private model: any
  private context: AgentContext

  constructor(context: AgentContext) {
    this.registry = new AgentRegistry()
    this.context = context
    
    const rawKey = process.env.GOOGLE_AI_API_KEY
    const apiKey = rawKey?.trim().replace(/^['"]|['"]$/g, '') || ''
    
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not configured')
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    this.decomposer = new TaskDecomposer(apiKey)
  }

  async processMessage(userMessage: string): Promise<string> {
    console.log(`[InteractionAgent] Processing message: ${userMessage.substring(0, 50)}...`)

    try {
      // Step 1: Decompose the request into tasks
      const tasks = await this.decomposeRequest(userMessage)
      console.log(`[InteractionAgent] Decomposed into ${tasks.length} task(s):`, tasks.map(t => t.type))

      // Step 2: Get or spawn execution agents for each task
      const agents = await this.getOrSpawnAgents(tasks)
      console.log(`[InteractionAgent] Spawned ${agents.length} execution agent(s)`)

      // Step 3: Execute agents in parallel
      const results = await Promise.all(
        agents.map(agent => agent.execute())
      )
      console.log(`[InteractionAgent] All agents completed`)

      // Step 4: Synthesize results into coherent response
      const response = await this.synthesizeResponse(userMessage, results)
      console.log(`[InteractionAgent] Response synthesized (${response.length} chars)`)

      return response
    } catch (error) {
      console.error('[InteractionAgent] Error processing message:', error)
      return 'sorry, something went wrong. please try again in a moment.'
    }
  }

  private async decomposeRequest(userMessage: string): Promise<Task[]> {
    return await this.decomposer.decompose(userMessage, this.context.conversationHistory)
  }

  private async getOrSpawnAgents(tasks: Task[]): Promise<ExecutionAgent[]> {
    const agents: ExecutionAgent[] = []

    for (const task of tasks) {
      // Check if we can reuse an existing agent
      const existingAgents = this.registry.getAgentsByTaskType(task.type)
      
      // For now, always spawn new agents (can optimize later to reuse)
      let agent: ExecutionAgent

      switch (task.type) {
        case 'general_query':
        default:
          agent = new GeneralTaskAgent(task.description, this.context)
          break
        // Add more agent types here as needed
        // case 'reminder':
        //   agent = new ReminderAgent(task.description, this.context)
        //   break
        // case 'email':
        //   agent = new EmailAgent(task.description, this.context)
        //   break
      }

      this.registry.register(agent, task.type)
      agents.push(agent)
    }

    return agents
  }

  private async synthesizeResponse(
    userMessage: string,
    results: ExecutionResult[]
  ): Promise<string> {
    // If single result, return it directly
    if (results.length === 1) {
      return results[0].output
    }

    // If multiple results, synthesize them
    const systemPrompt = `You are synthesizing outputs from multiple execution agents into a single coherent response.

The user asked: "${userMessage}"

Agent results:
${results.map((r, i) => `Agent ${i + 1} (${r.status}): ${r.output}`).join('\n\n')}

Synthesize these into a single, natural response. Don't mention that multiple agents were used. Just provide a cohesive answer.`

    try {
      // Build conversation history for Gemini
      const history: any[] = []
      
      for (const msg of this.context.conversationHistory) {
        history.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })
      }
      
      history.push({
        role: 'user',
        parts: [{ text: userMessage }]
      })

      // systemInstruction must be in parts format
      const systemInstruction = { parts: [{ text: systemPrompt }] }
      
      const result = await this.model.generateContent({
        contents: history,
        systemInstruction: systemInstruction,
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.7,
        }
      })

      const response = result.response.text()
      return response || results[0]?.output || 'sorry, i had trouble processing that.'
    } catch (error) {
      console.error('[InteractionAgent] Synthesis error:', error)
      // Fallback: return first result
      return results[0]?.output || 'sorry, im having trouble right now.'
    }
  }

  getRegistry(): AgentRegistry {
    return this.registry
  }
}
