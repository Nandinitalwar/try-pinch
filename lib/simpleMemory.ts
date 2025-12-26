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
          // JSON is truncated, try to repair it
          cleanedResponse = repairTruncatedJSON(cleanedResponse, jsonStart)
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

// Helper function to repair truncated JSON from Gemini API
function repairTruncatedJSON(text: string, jsonStart: number): string {
  const jsonText = text.substring(jsonStart)
  
  // Find all complete objects by looking for balanced braces
  const objects: string[] = []
  let depth = 0
  let inString = false
  let objectStart = -1
  let currentObject = ''
  
  for (let i = 0; i < jsonText.length; i++) {
    const char = jsonText[i]
    const prevChar = i > 0 ? jsonText[i - 1] : ''
    
    // Handle string boundaries (ignore escaped quotes)
    if (char === '"' && prevChar !== '\\') {
      inString = !inString
    }
    
    if (!inString) {
      if (char === '{') {
        if (depth === 0) {
          objectStart = i
          currentObject = ''
        }
        depth++
      } else if (char === '}') {
        depth--
        if (depth === 0 && objectStart !== -1) {
          currentObject = jsonText.substring(objectStart, i + 1)
          
          // Validate that this is a complete, parseable object
          try {
            JSON.parse(currentObject)
            objects.push(currentObject)
          } catch {
            // Skip invalid objects
          }
          
          objectStart = -1
          currentObject = ''
        }
      }
    }
  }
  
  // Return array of valid objects, or empty array if none found
  if (objects.length > 0) {
    return '[' + objects.join(',') + ']'
  } else {
    return '[]'
  }
}