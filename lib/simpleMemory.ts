import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from './supabase'

export interface SimpleMemory {
  id?: string
  phone_number: string
  memory_content: string
  memory_type: string
  importance: number
  created_at?: string
}

export class SimpleMemorySystem {
  private genAI: GoogleGenerativeAI
  private model: any

  constructor() {
    const rawKey = process.env.GOOGLE_AI_API_KEY
    const apiKey = rawKey?.trim().replace(/^['"]|['"]$/g, '') || ''
    
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not configured')
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  }

  /**
   * Extract simple memorable facts from conversation
   */
  async extractMemories(userMessage: string, agentResponse: string): Promise<SimpleMemory[]> {
    try {
      const prompt = `Extract memorable facts about this user from their message. Focus on:
- Preferences (likes/dislikes)  
- Relationships (family, friends, pets)
- Lifestyle (job, hobbies, living situation)
- Personal details (name, location, important facts)

Only extract things that would be useful to remember in future conversations.

User message: "${userMessage}"

Return as JSON array:
[
  {
    "memory_content": "hates pineapple pizza",
    "memory_type": "preference", 
    "importance": 7
  }
]

Types: preference, relationship, lifestyle, personal, other
Importance: 1-10 (higher = more important)`

      const result = await this.model.generateContent({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.3,
        }
      })

      const response = result.response.text()
      console.log('[SimpleMemory] Raw AI response:', response)
      
      let cleanedResponse = response.trim()
      
      // Clean JSON markers
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\s*\n?/, '').replace(/\n?\s*```$/, '')
      }
      if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```\s*\n?/, '').replace(/\n?\s*```$/, '')
      }
      
      // Handle cases where AI returns text before JSON or truncated JSON
      const jsonStart = cleanedResponse.indexOf('[')
      let jsonEnd = cleanedResponse.lastIndexOf(']')
      
      if (jsonStart !== -1) {
        if (jsonEnd === -1 || jsonEnd < jsonStart) {
          // JSON is truncated, try to find last complete object
          const lastObjectStart = cleanedResponse.lastIndexOf('{', cleanedResponse.length)
          if (lastObjectStart > jsonStart) {
            // Truncate at last complete object and close the array
            let truncatePoint = lastObjectStart
            // Go back to find previous complete object
            while (truncatePoint > jsonStart && cleanedResponse[truncatePoint] !== '}') {
              truncatePoint--
            }
            if (cleanedResponse[truncatePoint] === '}') {
              cleanedResponse = cleanedResponse.substring(jsonStart, truncatePoint + 1) + ']'
            } else {
              cleanedResponse = cleanedResponse.substring(jsonStart) + ']'
            }
          } else {
            cleanedResponse = cleanedResponse.substring(jsonStart) + ']'
          }
        } else {
          cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1)
        }
      }
      
      console.log('[SimpleMemory] Cleaned response for parsing:', cleanedResponse)

      try {
        const memories = JSON.parse(cleanedResponse) as SimpleMemory[]
        const validMemories = memories.filter(m => m.memory_content && m.importance >= 5)
        console.log('[SimpleMemory] Parsed memories:', validMemories)
        return validMemories
      } catch (parseError) {
        console.error('[SimpleMemory] JSON parse failed:', parseError)
        console.error('[SimpleMemory] Failed to parse:', cleanedResponse)
        // Return empty array on parse failure instead of crashing
        return []
      }
      
    } catch (error) {
      console.error('Memory extraction error:', error)
      return []
    }
  }

  /**
   * Store memories in Supabase
   */
  async storeMemories(phoneNumber: string, memories: SimpleMemory[]): Promise<boolean> {
    if (!supabase) {
      console.error('[SimpleMemory] Supabase not configured')
      return false
    }
    
    if (memories.length === 0) {
      console.log('[SimpleMemory] No memories to store')
      return false
    }

    console.log(`[SimpleMemory] Attempting to store ${memories.length} memories for ${phoneNumber}`)
    console.log('[SimpleMemory] Memories to store:', memories)

    try {
      for (const memory of memories) {
        console.log(`[SimpleMemory] Storing memory:`, memory)
        
        const { data, error } = await supabase
          .from('user_memories')
          .upsert({
            phone_number: phoneNumber,
            memory_content: memory.memory_content,
            memory_type: memory.memory_type,
            importance: memory.importance
          }, {
            onConflict: 'phone_number,memory_content',
            ignoreDuplicates: false
          })
          .select()
        
        if (error) {
          console.error(`[SimpleMemory] Error storing memory:`, error)
          console.error(`[SimpleMemory] Failed memory:`, memory)
        } else {
          console.log(`[SimpleMemory] Successfully stored:`, data)
        }
      }

      console.log(`[SimpleMemory] Finished storing memories for ${phoneNumber}`)
      return true
      
    } catch (error) {
      console.error('[SimpleMemory] Storage error:', error)
      return false
    }
  }

  /**
   * Get relevant memories for context
   */
  async getMemories(phoneNumber: string, limit: number = 10): Promise<SimpleMemory[]> {
    if (!supabase) return []

    try {
      const { data, error } = await supabase
        .from('user_memories')
        .select('*')
        .eq('phone_number', phoneNumber)
        .gte('importance', 5) // only important memories
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Memory retrieval error:', error)
        return []
      }

      return data as SimpleMemory[]
      
    } catch (error) {
      console.error('Memory retrieval error:', error)
      return []
    }
  }

  /**
   * Format memories for agent prompt
   */
  static formatMemories(memories: SimpleMemory[]): string {
    if (memories.length === 0) {
      return "No previous memories about this user."
    }

    let context = "What you remember about this user:\n"
    
    const groups: Record<string, SimpleMemory[]> = {}
    memories.forEach(memory => {
      if (!groups[memory.memory_type]) groups[memory.memory_type] = []
      groups[memory.memory_type].push(memory)
    })

    Object.entries(groups).forEach(([type, mems]) => {
      context += `\n${type.toUpperCase()}:\n`
      mems.forEach(mem => {
        context += `- ${mem.memory_content}\n`
      })
    })

    return context
  }
}