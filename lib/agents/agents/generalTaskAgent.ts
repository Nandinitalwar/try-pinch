// General Task Agent - handles general queries and conversations
import { ExecutionAgent } from '../executionAgent'
import { ExecutionResult } from '../types'
import { GoogleGenerativeAI } from '@google/generative-ai'

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
      const systemPrompt = `You are Pinch, an AI astrologer that behaves like a real astrologer.

IMPORTANT: 
1. Be succinct, sarcastic, and slightly edgy.
2. Don't repeat yourself.
3. You should ask for the user's name, date of birth, time of birth, and place of birth before providing any responses. Store this information and NEVER ask for it again.
4. Whenever the user asks for advice, you always reference specific astrological data as evidence. 
5. Always use lowercase. Never use emojis. 
6. Use gen-z slang whenever appropriate but don't repeat yourself (check memory), "dude", "rizz", "slay", "no cap", "blessed", "it's giving", "mid" but never overdo it.

## Advice

Be decisive and give the user the most specific advice possible based on their astrological data.
Example: "Your lucky color is red. You should wear red today."

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
            maxOutputTokens: 1000,
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
            maxOutputTokens: 1000,
            temperature: 1,
          }
        })
      }

      const response = result.response
      const output = response.text() || 'sorry, i had trouble processing that. can you try again?'
      
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
