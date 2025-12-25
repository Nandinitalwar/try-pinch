// General Task Agent - handles general queries and conversations
import { ExecutionAgent } from '../executionAgent'
import { ExecutionResult } from '../types'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { BirthDataParser } from '../../birthDataParser'
import { UserProfileService } from '../../userProfile'
import { SimpleMemorySystem } from '../../simpleMemory'

export class GeneralTaskAgent extends ExecutionAgent {
  private genAI: GoogleGenerativeAI
  private model: any

  constructor(task: string, context: any) {
    super(task, context)
    
    const rawKey = process.env.GOOGLE_AI_API_KEY
    const apiKey = rawKey?.trim().replace(/^['"]|['"]$/g, '') || ''
    
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not configured')
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey)
    // Use gemini-2.5-flash (Flash 2.5 variant)
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  }

  async execute(): Promise<ExecutionResult> {
    this.log(`Executing general task: ${this.task}`)

    try {
      // Check if the message contains birth data and save it
      const birthData = BirthDataParser.extractBirthData(this.task)
      if (birthData && this.context.phoneNumber) {
        console.log('[GeneralTaskAgent] Detected birth data:', birthData)
        const saved = await BirthDataParser.saveBirthData(this.context.phoneNumber, birthData)
        if (saved) {
          console.log('[GeneralTaskAgent] Birth data saved successfully')
        } else {
          console.error('[GeneralTaskAgent] Failed to save birth data')
        }
      }
      // Get user profile information for context
      const userProfileContext = UserProfileService.formatProfileForAgent(this.context.userProfile as any)
      
      // Get simple user memories for conversational continuity  
      const userMemoriesContext = SimpleMemorySystem.formatMemories(this.context.userMemories as any || [])

      const systemPrompt = `You are Pinch, an AI astrologer that behaves like a real astrologer.

IMPORTANT: 
1. Be succinct, sarcastic, and slightly edgy.
2. Don't repeat yourself.
3. Whenever the user asks for advice, you always reference specific astrological data as evidence. 
4. Always use lowercase. Never use emojis. 
5. Use gen-z slang whenever appropriate but don't repeat yourself and don't overdo it. Don't use the same slang as the previous message.
6. Reference what you remember about them naturally in conversation - use it to personalize advice and throw in some gentle roasting when appropriate.

## User Birth Chart Information
${userProfileContext}

## What You Remember About This User
${userMemoriesContext}

## Advice

Be decisive and give the user the most specific advice possible based on their astrological data.
Example: "Your lucky color is red. You should wear red today."
When you have their birth data, use it to provide personalized insights based on their actual chart.
If you don't have their birth data, ask for it naturally in conversation.

## Tone

Never output preamble or postamble. 

NEVER use the following tones:
- How can I help you
- Let me know if you need anything else
- Let me know if you need assistance
- No problem at all
- I'll carry that out right away
- I apologize for the confusion

When the user is just chatting, do not unnecessarily offer help or to explain anything; this sounds robotic. Humor or sass is a much better choice, but use your judgement.`

      // Build conversation history for Gemini
      // Gemini expects array of {role, parts: [{text}]}
      const history: any[] = []
      
      // Add conversation history
      for (const msg of this.context.conversationHistory) {
        history.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })
      }
      
      // Add current user message
      history.push({
        role: 'user',
        parts: [{ text: this.task }]
      })

      this.log(`Sending request to Gemini API (${history.length} messages)`)
      
      // Log conversation history for debugging
      console.log('[GeneralTaskAgent] Conversation history being sent:')
      history.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.role}: "${msg.parts[0].text}"`)
      })
      
      console.log('[GeneralTaskAgent] System prompt:', systemPrompt.substring(0, 100) + '...')
      console.log('[GeneralTaskAgent] Current task:', this.task)

      // Use startChat for conversation history, or generateContent for single message
      // systemInstruction must be in parts format: { parts: [{ text: "..." }] }
      const systemInstruction = { parts: [{ text: systemPrompt }] }
      
      let result
      if (history.length > 1) {
        // Multiple messages - use chat
        const chat = this.model.startChat({
          systemInstruction: systemInstruction,
          history: history.slice(0, -1), // All but last message
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 1,
          }
        })
        result = await chat.sendMessage(history[history.length - 1].parts[0].text)
      } else {
        // Single message - use generateContent
        result = await this.model.generateContent({
          contents: history,
          systemInstruction: systemInstruction,
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 1,
          }
        })
      }

      const response = result.response
      const output = response.text() || 'sorry, i had trouble processing that. can you try again?'
      
      console.log('[GeneralTaskAgent] AI Response received:', output)
      console.log('[GeneralTaskAgent] Response metadata:', {
        length: output.length,
        totalTokens: response.usageMetadata?.totalTokenCount,
        promptTokens: response.usageMetadata?.promptTokenCount,
        candidatesTokens: response.usageMetadata?.candidatesTokenCount,
        finishReason: result.response.candidates?.[0]?.finishReason
      })
      
      // Check if response was truncated
      const finishReason = result.response.candidates?.[0]?.finishReason
      if (finishReason === 'MAX_TOKENS') {
        console.warn('[GeneralTaskAgent] Response was truncated due to token limit')
      } else if (finishReason === 'SAFETY') {
        console.warn('[GeneralTaskAgent] Response was blocked by safety filters')
      } else if (finishReason !== 'STOP') {
        console.warn('[GeneralTaskAgent] Unexpected finish reason:', finishReason)
      }
      
      this.log(`Task completed successfully (${output.length} chars)`)
      
      return this.createResult('success', output, {
        model: 'gemini-2.5-flash',
        tokens: response.usageMetadata?.totalTokenCount
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorDetails = error && typeof error === 'object' ? JSON.stringify(error, null, 2) : String(error)
      this.log(`Error executing task: ${errorMessage}`)
      console.error('[GeneralTaskAgent] Full error:', errorDetails)
      if (error && typeof error === 'object' && 'status' in error) {
        console.error('[GeneralTaskAgent] Error status:', (error as any).status)
        console.error('[GeneralTaskAgent] Error statusText:', (error as any).statusText)
      }
      return this.createResult('error', 'sorry, im having trouble right now. can you try again in a moment?', {
        error: errorMessage,
        details: errorDetails
      })
    }
  }
}
