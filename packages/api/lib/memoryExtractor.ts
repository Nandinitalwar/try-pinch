import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from './supabase'

export interface MemoryItem {
  memory_type: 'preference' | 'personality' | 'relationship' | 'lifestyle' | 'goal' | 'experience' | 'opinion' | 'habit' | 'physical' | 'other'
  memory_key: string
  memory_value: string
  importance_score: number // 1-10
  confidence_score: number // 0-1
}

export interface UserMemory extends MemoryItem {
  id?: string
  phone_number: string
  last_mentioned?: string
  mention_count?: number
  created_at?: string
  updated_at?: string
}

export class MemoryExtractor {
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
   * Extract memorable information from a conversation exchange
   */
  async extractMemories(
    userMessage: string, 
    agentResponse: string, 
    conversationHistory: Array<{ role: string, content: string }> = []
  ): Promise<MemoryItem[]> {
    try {
      const systemPrompt = `You are a memory extraction agent. Your job is to identify information about the user that should be remembered for future conversations.

IMPORTANT RULES:
1. Only extract facts that are personally meaningful and would enhance future conversations
2. Focus on preferences, personality traits, relationships, lifestyle, goals, experiences, opinions, habits
3. Avoid extracting temporary states, generic responses, or obvious information
4. Each memory should be specific and actionable for a sassy astrology AI to reference later

MEMORY TYPES:
- preference: likes/dislikes (food, colors, activities, etc.)
- personality: character traits, quirks, behaviors
- relationship: family, friends, romantic partnerships, pets
- lifestyle: job, hobbies, living situation, routine
- goal: aspirations, fears, challenges, dreams
- experience: significant past events, travels, achievements
- opinion: views on topics, beliefs, values
- habit: regular behaviors, patterns, routines
- physical: appearance details, health, body-related
- other: anything else worth remembering

SCORING:
- importance_score (1-10): How useful is this for future conversations?
  * 8-10: Core personality/major preferences (vegetarian, hates math, has anxiety)
  * 5-7: Interesting details (favorite color, pet name, job)
  * 1-4: Minor mentions (had coffee today, tired)
- confidence_score (0-1): How certain are you this is accurate?
  * 0.9-1.0: Explicitly stated by user
  * 0.6-0.8: Strongly implied
  * 0.3-0.5: Weakly inferred

OUTPUT FORMAT:
Return a JSON array of memory objects. Each should have:
{
  "memory_type": "preference",
  "memory_key": "food_pineapple", 
  "memory_value": "hates pineapple on pizza, thinks it's disgusting",
  "importance_score": 6,
  "confidence_score": 0.95
}

EXAMPLES OF GOOD MEMORIES:
- User says "I'm vegetarian" → preference: diet_vegetarian, importance: 9
- User says "my dog Max" → relationship: pet_dog_max, importance: 7  
- User says "I work in tech" → lifestyle: job_tech, importance: 6
- User says "I hate mornings" → habit: morning_person_no, importance: 6
- User mentions anxiety → personality: has_anxiety, importance: 8

EXAMPLES TO IGNORE:
- "I'm tired today" (temporary state)
- "thanks" (politeness)
- "what should I wear" (question, not personal info)
- Astrology advice given by agent (not about user)

Analyze this conversation exchange and extract memorable information:`

      const prompt = `
USER MESSAGE: "${userMessage}"
AGENT RESPONSE: "${agentResponse}"

RECENT CONVERSATION CONTEXT:
${conversationHistory.slice(-4).map(msg => `${msg.role.toUpperCase()}: "${msg.content}"`).join('\n')}

Extract memories as JSON array:`

      const result = await this.model.generateContent({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.3,
        }
      })

      const response = result.response.text()
      
      // Clean and parse JSON response
      let cleanedResponse = response.trim()
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\n?/, '').replace(/```$/, '')
      }
      if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```\n?/, '').replace(/```$/, '')
      }

      const memories = JSON.parse(cleanedResponse) as MemoryItem[]
      
      // Validate and filter memories
      return memories.filter(memory => 
        memory.memory_key && 
        memory.memory_value && 
        memory.importance_score >= 3 && // Only store moderately important+ memories
        memory.confidence_score >= 0.5   // Only store reasonably confident memories
      )
      
    } catch (error) {
      console.error('Memory extraction error:', error)
      return []
    }
  }

  /**
   * Store memories in Supabase
   */
  async storeMemories(phoneNumber: string, memories: MemoryItem[]): Promise<boolean> {
    if (!supabase || memories.length === 0) return false

    try {
      for (const memory of memories) {
        await supabase
          .from('user_memories')
          .upsert({
            phone_number: phoneNumber,
            memory_type: memory.memory_type,
            memory_key: memory.memory_key,
            memory_value: memory.memory_value,
            importance_score: memory.importance_score,
            confidence_score: memory.confidence_score,
            last_mentioned: new Date().toISOString(),
            mention_count: 1
          }, {
            onConflict: 'phone_number,memory_key',
            ignoreDuplicates: false
          })
      }

      console.log(`[MemoryExtractor] Stored ${memories.length} memories for ${phoneNumber}`)
      return true
      
    } catch (error) {
      console.error('Memory storage error:', error)
      return false
    }
  }

  /**
   * Retrieve relevant memories for context
   */
  async getRelevantMemories(
    phoneNumber: string, 
    limit: number = 10,
    minImportance: number = 5
  ): Promise<UserMemory[]> {
    if (!supabase) return []

    try {
      const { data, error } = await supabase
        .from('user_memories')
        .select('*')
        .eq('phone_number', phoneNumber)
        .gte('importance_score', minImportance)
        .order('importance_score', { ascending: false })
        .order('last_mentioned', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Memory retrieval error:', error)
        return []
      }

      return data as UserMemory[]
      
    } catch (error) {
      console.error('Memory retrieval error:', error)
      return []
    }
  }

  /**
   * Update memory mention count and recency
   */
  async updateMemoryMention(phoneNumber: string, memoryKey: string): Promise<void> {
    if (!supabase) return

    try {
      await supabase
        .from('user_memories')
        .update({
          last_mentioned: new Date().toISOString(),
          mention_count: supabase.rpc('increment_mention_count')
        })
        .eq('phone_number', phoneNumber)
        .eq('memory_key', memoryKey)
    } catch (error) {
      console.error('Memory update error:', error)
    }
  }

  /**
   * Format memories for agent context
   */
  static formatMemoriesForAgent(memories: UserMemory[]): string {
    if (memories.length === 0) {
      return "No specific memories about this user yet."
    }

    const groupedMemories = memories.reduce((acc, memory) => {
      if (!acc[memory.memory_type]) acc[memory.memory_type] = []
      acc[memory.memory_type].push(memory)
      return acc
    }, {} as Record<string, UserMemory[]>)

    let formatted = "What you remember about this user:\n"
    
    Object.entries(groupedMemories).forEach(([type, mems]) => {
      formatted += `\n${type.toUpperCase()}:\n`
      mems.forEach(mem => {
        formatted += `- ${mem.memory_value} (importance: ${mem.importance_score}/10)\n`
      })
    })

    return formatted
  }
}