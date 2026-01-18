// General Task Agent - handles general queries and conversations
import { ExecutionAgent } from '../executionAgent'
import { ExecutionResult } from '../types'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { BirthDataParser, BirthData } from '../../birthDataParser'
import { UserProfileService } from '../../userProfile'
import { SimpleMemorySystem } from '../../simpleMemory'

// Tool definitions for Gemini (cast to any to work around strict typing)
const tools: any = [
  {
    functionDeclarations: [
      {
        name: "search_web",
        description: "Search the web for real-time information like current events, restaurants, concerts, news, weather, or anything that requires up-to-date data. Use this when the user asks about specific events, places to go, things happening now, or any question that needs current information. For event queries, call this tool MULTIPLE TIMES with different specific searches to get comprehensive results.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: {
              type: SchemaType.STRING,
              description: "The search query. Be VERY specific and always include: location, date/month/year (today is January 2026), and event type. For comprehensive event coverage, make multiple searches. Examples: 'SF Sketchfest January 2026 dates lineup', 'San Francisco art exhibits January 2026', 'concerts San Francisco this weekend January 18 2026', 'comedy shows SF January 2026'"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "save_birth_data",
        description: "Save the user's birth information when they share their birthday, birth time, or birth location. Call this whenever the user provides any birth-related details like date of birth, time of birth, or place of birth.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            name: {
              type: SchemaType.STRING,
              description: "User's preferred name if they mentioned it"
            },
            birth_date: {
              type: SchemaType.STRING,
              description: "Birth date in YYYY-MM-DD format"
            },
            birth_time: {
              type: SchemaType.STRING,
              description: "Birth time in HH:MM:SS format (24-hour). Use null if not provided."
            },
            birth_time_known: {
              type: SchemaType.BOOLEAN,
              description: "True if the user provided a specific birth time, false otherwise"
            },
            birth_time_accuracy: {
              type: SchemaType.STRING,
              description: "One of: 'exact' (specific time given), 'approximate' (said 'around' or 'about'), 'unknown' (no time given)"
            },
            birth_city: {
              type: SchemaType.STRING,
              description: "City where user was born"
            },
            birth_country: {
              type: SchemaType.STRING,
              description: "Country where user was born"
            },
            birth_timezone: {
              type: SchemaType.STRING,
              description: "IANA timezone based on birth location. Examples: America/Los_Angeles (California/PST), America/New_York (NYC/EST), America/Chicago (Central), Europe/London (UK), Asia/Kolkata (India)"
            }
          },
          required: ["birth_date"]
        }
      }
    ]
  }
]

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
    // Use gemini-2.5-flash with tools
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      tools: tools
    })
  }

  // Perform web search using Exa AI (optimized for LLM agents)
  private async searchWeb(query: string): Promise<string> {
    try {
      const exaApiKey = process.env.EXA_API_KEY
      
      if (exaApiKey) {
        console.log('[GeneralTaskAgent] Using Exa AI for search:', query)
        
        // Check if query is about events/concerts/shows to use news category
        const isEventQuery = /event|concert|show|festival|performance|gig|happening|weekend|tonight|this week|things to do|activities|recs|recommendations/i.test(query)
        
        // Build search request - use searchAndContents for better extraction
        const searchBody: any = {
          query: query,
          numResults: 10,
          type: 'auto',
          contents: {
            text: {
              maxCharacters: 1500,  // More text for event details
              includeHtmlTags: false
            },
            highlights: {
              numSentences: 3,  // Key sentences with dates/details
              highlightsPerUrl: 2
            }
          }
        }
        
        // For event queries, focus on recent content
        if (isEventQuery) {
          // Get content from last 14 days for maximum freshness
          const twoWeeksAgo = new Date()
          twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
          searchBody.startPublishedDate = twoWeeksAgo.toISOString()
          searchBody.category = 'news'  // News category often has event listings
        }
        
        const response = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: {
            'x-api-key': exaApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(searchBody)
        })
        
        const data = await response.json()
        
        if (data.error) {
          console.error('[GeneralTaskAgent] Exa API error:', data.error)
          return `Search error: ${data.error}. Please provide general recommendations.`
        }
        
        let results = ''
        if (data.results && data.results.length > 0) {
          results += `Found ${data.results.length} results. EXTRACT SPECIFIC EVENTS with names, dates, venues, and links:\n\n`
          data.results.forEach((result: any, index: number) => {
            results += `--- Result ${index + 1} ---\n`
            results += `Title: ${result.title}\n`
            results += `URL: ${result.url}\n`
            if (result.publishedDate) {
              const date = new Date(result.publishedDate).toLocaleDateString()
              results += `Published: ${date}\n`
            }
            // Include highlights if available (key sentences)
            if (result.highlights && result.highlights.length > 0) {
              results += `Key info: ${result.highlights.join(' | ')}\n`
            }
            if (result.text) {
              // Get substantial text for event extraction (1000 chars)
              const snippet = result.text.substring(0, 1000).replace(/\n+/g, ' ').trim()
              results += `Content: ${snippet}\n`
            }
            results += '\n'
          })
          results += '\nIMPORTANT: From these results, identify SPECIFIC events with dates, times, and venues. Do NOT just list websites - give the user actual event names and details.'
        } else {
          results = `No specific results found for "${query}". `
        }
        
        console.log('[GeneralTaskAgent] Exa returned', data.results?.length || 0, 'results')
        return results
      }

      // No Exa API key configured
      console.warn('[GeneralTaskAgent] No EXA_API_KEY configured')
      return `NO_SEARCH_API_CONFIGURED: Unable to search for "${query}". Give general recommendations based on your knowledge, and tell the user to check Eventbrite.com, SFStation.com, or sf.funcheap.com for current SF events.`
      
    } catch (error) {
      console.error('[GeneralTaskAgent] Search error:', error)
      return `Search failed for "${query}". Provide general recommendations and suggest the user check Eventbrite.com or SFStation.com for current listings.`
    }
  }

  // Handle tool calls from Gemini
  private async handleToolCall(functionCall: any): Promise<any> {
    const { name, args } = functionCall
    console.log(`[GeneralTaskAgent] Tool call: ${name}`, args)

    if (name === 'search_web') {
      const query = args.query
      console.log(`[GeneralTaskAgent] Searching web for: ${query}`)
      const results = await this.searchWeb(query)
      return { 
        success: true, 
        results: results,
        instruction: 'Use these search results to give the user specific, actionable recommendations. Cite specific events, venues, or details from the results.'
      }
    }

    if (name === 'save_birth_data') {
      if (!this.context.phoneNumber) {
        return { success: false, error: 'No phone number available' }
      }

      const birthData: BirthData = {
        name: args.name || undefined,
        birth_date: args.birth_date,
        birth_time: args.birth_time || '12:00:00',
        birth_time_known: args.birth_time_known || false,
        birth_time_accuracy: args.birth_time_accuracy || 'unknown',
        birth_timezone: args.birth_timezone || 'UTC',
        birth_city: args.birth_city || 'Unknown',
        birth_country: args.birth_country || 'Unknown',
      }

      console.log('[GeneralTaskAgent] Saving birth data via tool call:', birthData)
      const saved = await BirthDataParser.saveBirthData(this.context.phoneNumber, birthData)
      
      return { 
        success: saved, 
        message: saved 
          ? 'Birth data saved. Now provide the user with a personalized response based on their chart. Do not say you will look into it - give them actual insights now.'
          : 'Failed to save birth data'
      }
    }

    return { error: `Unknown tool: ${name}` }
  }

  async execute(): Promise<ExecutionResult> {
    this.log(`Executing general task: ${this.task}`)

    try {
      // Get user profile information for context
      const userProfileContext = UserProfileService.formatProfileForAgent(this.context.userProfile as any)
      
      // Get simple user memories for conversational continuity  
      const userMemoriesContext = SimpleMemorySystem.formatMemories(this.context.userMemories as any || [])

      // Get today's date for context
      const today = new Date()
      const todayFormatted = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

      const systemPrompt = `You are Pinch, a modern astrologer who's been reading charts for decades. You trust your craft. Don't over-reference astrological data - be relatable and empathetic.

You speak like a friend who happens to know astrology - not a mystical guru, not a corporate bot. You're texting someone who trusts you. Keep it tight.

## Today's Date
${todayFormatted}
Use this for any time-sensitive recommendations (events, transits, etc.)

## User Birth Chart Information
${userProfileContext}

## What You Remember About This User
${userMemoriesContext}

## Core Rules
- Decisive and confident. No hedging.
- Proper grammar, no emojis.
- Reference what you remember about them naturally.
- Keep responses concise - this is WhatsApp, not email. Aim for punchy responses. For events/recommendations, 2-3 items is ideal.

## CRITICAL: You Help With Everything
You are NOT restricted to only astrology questions. You are a helpful friend who ALSO knows astrology.

When users ask for:
- Travel recommendations → Give them actual recs. Maybe mention what their chart says about travel if relevant, but GIVE THE REC.
- Food/restaurant suggestions → Help them. Add chart perspective if it fits naturally.
- Life advice, decisions, relationships → Help directly. Astrology can inform but isn't the only lens.
- Random questions → Just answer like a smart friend would.

NEVER say "I'm an astrologer, not a travel guide" or refuse to help with non-astrology requests. That's not who you are. You're a friend who happens to be great at astrology.

## CRITICAL: Event/Activity Recommendations
When giving event/activity recommendations, extract SPECIFIC details and format for WhatsApp/SMS readability.

FORMAT each event like this (use *text* for bold - WhatsApp style):
*Event Name (Dates)*
Brief description of what it is.
Why it fits their chart - USE ACTUAL ASTROLOGY (planets, houses, transits, sign traits).
Link: https://example.com

ASTROLOGICAL REASONING must reference their actual chart:
✓ "Your Gemini Sun craves mental variety - 500+ performers means endless stimulation"
✓ "With Venus in Taurus, you need sensory richness - this art exhibit delivers"
✓ "Mars transiting your 5th house right now = creative/entertainment energy is lit"
✓ "Your Mercury in Aquarius loves unconventional ideas - experimental theater is perfect"

BANNED reasoning (never use these):
✗ "As a software engineer, you'll appreciate..."
✗ "Perfect for letting loose after a long week"
✗ "Great for anyone who likes music"
✗ "A nice change of pace for someone in tech"
✗ Any reference to their job/career as reasoning
✗ Generic statements that could apply to anyone

ONLY use chart-based reasoning: signs, planets, houses, transits, aspects.

Example output (follow this exact format):

*SF Sketchfest (Now through Feb 2)*
500+ performers, variety shows, sharp comedy. Your Gemini Sun thrives on mental stimulation and wit - the SNL Women tribute (Jan 25) with 9 cast members hits that dual-nature sweet spot.
https://sfsketchfest.com

*Art of Manga at de Young (through Jan 25)*
Original drawings spanning 1970s to today. Mercury in your 9th house loves absorbing diverse cultural perspectives, and this visual storytelling feeds that.
https://deyoung.famsf.org

*FOG Design+Art at Fort Mason (Jan 21-25)*
High-end design fair with gallery talks. Venus in Taurus craves beauty and quality craftsmanship - this is sensory heaven.
https://fogfair.com

FORMATTING RULES (WhatsApp renders these):
- *text* = bold (use for titles only)
- _text_ = italic (use sparingly)
- NEVER use "* " or "- " for bullet points - WhatsApp renders these as actual bullets
- NEVER write "*   *Title*" - this creates a bullet + bold, looks messy
- Separate items with blank lines only
- Just put the URL on its own line, no "Link:" prefix
- 3-5 items max, each as its own clean paragraph block
- Brief intro sentence, then straight to the recommendations

## Language Bans
NEVER use these words or phrases:
- "yearn" / "yearning"
- "This is a big one"
- "Let's lay it out"
- "Here's the real tension"
- "celestial" / "cosmic tapestry" / "the stars say"
- "I sense" / "I feel"
- Any overly poetic or mystical language

Talk like a real person. Say "your chart shows" not "the celestial bodies reveal."

## How You Give Advice
Specific and grounded.
Bad: "Big changes are coming."
Good: "Mars in your tenth house means career heat. If you're going to make a move, this month backs you up."

If you don't have their birth data, ask directly.

## Structure
VARY YOUR FORMAT. Don't follow the same pattern every time.
- Sometimes lead with the answer, then explain why.
- Sometimes skip the chart breakdown if the answer is obvious.
- The "Do: X / Don't: Y" ending is for maybe 1 in 5 responses, MAX. Most responses should NOT have it.

## Tone
You're an oracle, not customer service.

Never say:
- "How can I help you?"
- "Let me know if you need anything else."
- "No problem at all."
- "I apologize for the confusion."

Warm and witty when chatting, but always authoritative. Never robotic or ceremonial.`

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

      // Use chat for tool calling support
      // systemInstruction must be in parts format: { parts: [{ text: "..." }] }
      const systemInstruction = { parts: [{ text: systemPrompt }] }
      
      const chat = this.model.startChat({
        systemInstruction: systemInstruction,
        history: history.slice(0, -1), // All but last message
        generationConfig: {
          maxOutputTokens: 3000,  // Let model complete, condenser handles length
          temperature: 1,
        }
      })
      
      let result = await chat.sendMessage(history[history.length - 1].parts[0].text)
      let response = result.response
      
      // Handle tool calls - loop in case of multiple sequential calls
      let functionCalls = response.functionCalls()
      while (functionCalls && functionCalls.length > 0) {
        console.log('[GeneralTaskAgent] Gemini requested tool calls:', functionCalls.map((fc: any) => fc.name))
        
        // Execute all function calls
        const functionResponses = []
        for (const functionCall of functionCalls) {
          const toolResult = await this.handleToolCall(functionCall)
          functionResponses.push({
            name: functionCall.name,
            response: toolResult
          })
        }
        
        // Send function results back to Gemini
        result = await chat.sendMessage(
          functionResponses.map(fr => ({
            functionResponse: {
              name: fr.name,
              response: fr.response
            }
          }))
        )
        response = result.response
        functionCalls = response.functionCalls()
      }

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
      } else if (finishReason !== 'STOP' && finishReason !== undefined) {
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
