// Task Decomposer - analyzes user requests and identifies tasks
import { Task } from './types'
import { v4 as uuidv4 } from 'uuid'
import { GoogleGenerativeAI } from '@google/generative-ai'

export class TaskDecomposer {
  private genAI: GoogleGenerativeAI
  private model: any

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is required')
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  }

  async decompose(userMessage: string, conversationHistory: Array<{ role: 'user' | 'assistant', content: string }>): Promise<Task[]> {
    const systemPrompt = `You are a task decomposition system. Analyze user messages and identify what tasks need to be executed.

Return a JSON object with a "tasks" array. Each task should have:
- type: The type of task (e.g., "general_query", "reminder", "email", "calculation", "information_lookup")
- description: A clear description of what needs to be done
- priority: 1-10 (10 is highest priority)
- requiresAgent: Optional specific agent type if needed

Examples:
- "remind me to call mom tomorrow" → {"tasks": [{"type": "reminder", "description": "Set reminder to call mom tomorrow", "priority": 8}]}
- "what's my horoscope?" → {"tasks": [{"type": "general_query", "description": "Get horoscope information", "priority": 7}]}
- "send an email to john" → {"tasks": [{"type": "email", "description": "Send email to john", "priority": 9, "requiresAgent": "email"}]}

For simple conversational messages, return a single "general_query" task.

Return ONLY valid JSON object with "tasks" array, no other text.`

    try {
      // Build conversation history for Gemini
      const history: any[] = []
      
      for (const msg of conversationHistory) {
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
          maxOutputTokens: 500,
          temperature: 0.3,
          responseMimeType: 'application/json'
        }
      })

      const response = result.response.text()
      const parsed = JSON.parse(response)
      
      // Handle both {tasks: [...]} and [...] formats
      let tasksArray: any[] = []
      if (Array.isArray(parsed)) {
        tasksArray = parsed
      } else if (parsed.tasks && Array.isArray(parsed.tasks)) {
        tasksArray = parsed.tasks
      } else if (parsed.task) {
        tasksArray = [parsed.task]
      }
      
      return tasksArray.map((task: any) => ({
        id: uuidv4(),
        type: task.type || 'general_query',
        description: task.description || userMessage,
        priority: task.priority || 5,
        requiresAgent: task.requiresAgent
      }))
    } catch (error) {
      console.error('Task decomposition error:', error)
      // Fallback: return single general task
      return [{
        id: uuidv4(),
        type: 'general_query',
        description: userMessage,
        priority: 5
      }]
    }
  }
}
