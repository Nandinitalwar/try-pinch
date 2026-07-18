// General Task Agent - handles general queries and conversations
import { ExecutionAgent } from '../executionAgent'
import { ExecutionResult } from '../types'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { BirthDataParser, BirthData } from '../../birthDataParser'
import { UserProfileService } from '../../userProfile'
import { SimpleMemorySystem } from '../../simpleMemory'
import { logLLMCall, logToolCall } from '../../braintrust'

// Tool definitions for Gemini (cast to any to work around strict typing)
const tools: any = [
  {
    functionDeclarations: [
      {
        name: "search_web",
        description: "Search the web for real-time information like current events, restaurants, concerts, news, weather, daily horoscopes, astrology forecasts, or anything that requires up-to-date data. Use this when the user asks about specific events, places to go, things happening now, or any question that needs current information. For event queries, call this tool MULTIPLE TIMES with different specific searches to get comprehensive results. IMPORTANT: When the user asks for ANY everyday advice (food, plans, what to do, decisions), ALSO search for today's astrology forecast for their sun sign to inform your recommendation. CRITICAL: When searching for events happening 'tonight' or 'now', include the current time in your search to find events that haven't started yet.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: {
              type: SchemaType.STRING,
              description: "The search query. Be VERY specific and always include: location, date/month/year (today is February 2026), time of day if relevant, and event type. For events happening NOW or TONIGHT, specify 'late night' or 'after 9pm' or similar time constraints. For comprehensive event coverage, make multiple searches. For daily astrology, search for the user's sun sign forecast. Examples: 'SF Sketchfest February 2026 dates lineup', 'San Francisco late night events after 9pm February 2026', 'San Francisco bars open now', 'Scorpio daily horoscope February 8 2026', 'astrology forecast today February 2026 transits'"
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
            },
            birth_latitude: {
              type: SchemaType.NUMBER,
              description: "REQUIRED whenever birth_city is known: latitude of the birth city in decimal degrees (e.g., 28.61 for New Delhi). You know the coordinates of world cities - always fill this in. Needed to compute the rising sign."
            },
            birth_longitude: {
              type: SchemaType.NUMBER,
              description: "REQUIRED whenever birth_city is known: longitude of the birth city in decimal degrees, negative for west (e.g., -122.42 for San Francisco, 77.21 for New Delhi). Needed to compute the rising sign."
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
        
        // Check if query is about events/concerts/shows or daily astrology to use news/recent category
        const isEventQuery = /event|concert|show|festival|performance|gig|happening|weekend|tonight|this week|things to do|activities|recs|recommendations|horoscope|daily astrology|forecast|transit/i.test(query)
        
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

    const startTime = Date.now()

    if (name === 'search_web') {
      const query = args.query
      console.log(`[GeneralTaskAgent] Searching web for: ${query}`)
      const results = await this.searchWeb(query)

      // Log tool call to Braintrust
      logToolCall({
        name: 'search_web',
        input: { query },
        output: { results },
        metadata: {
          latency_ms: Date.now() - startTime,
          user_id: this.context.userId,
          phone_number: this.context.phoneNumber,
        }
      })

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
        birth_latitude: typeof args.birth_latitude === 'number' ? args.birth_latitude : undefined,
        birth_longitude: typeof args.birth_longitude === 'number' ? args.birth_longitude : undefined,
      }

      console.log('[GeneralTaskAgent] Saving birth data via tool call:', birthData)
      const saved = await BirthDataParser.saveBirthData(this.context.phoneNumber, birthData)

      // Log tool call to Braintrust
      logToolCall({
        name: 'save_birth_data',
        input: args,
        output: { success: saved },
        metadata: {
          latency_ms: Date.now() - startTime,
          user_id: this.context.userId,
          phone_number: this.context.phoneNumber,
        }
      })

      if (!saved) {
        return { success: false, message: 'Failed to save birth data' }
      }

      // Fetch the freshly computed chart so the model's reply reflects
      // reality, not the stale pre-save onboarding directive
      const freshProfile = await UserProfileService.getUserProfile(this.context.phoneNumber)
      const chartSummary = freshProfile?.sun_sign
        ? `Chart computed: ${freshProfile.sun_sign} Sun, ${freshProfile.moon_sign} Moon, ${freshProfile.rising_sign ? freshProfile.rising_sign + ' rising' : 'rising unknown (no exact birth time)'}.`
        : 'Chart could not be computed.'
      const stillMissing = !birthData.birth_time_known
        ? ' Their exact birth time is still missing - you may briefly mention that sharing it later unlocks their rising sign and houses, but do NOT re-ask for anything they just gave you.'
        : ' You now have everything - never ask for birth details again.'

      return {
        success: true,
        message: `Birth data SAVED permanently. ${chartSummary} Use these exact placements in your reply now - do not re-ask for their birth date or city, they just gave them.${stillMissing}`
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

      // Get current date and time in user's timezone (or default to America/Los_Angeles)
      const userTimezone = (this.context.userProfile as any)?.birth_timezone || 'America/Los_Angeles'
      const now = new Date()

      const dateFormatted = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: userTimezone
      })

      const timeFormatted = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: userTimezone
      })

      // Deterministic onboarding gate based on what's actually in the database,
      // so collecting birth data never depends on the model remembering to ask
      const profile = this.context.userProfile as any
      let birthDataDirective: string
      if (!profile?.birth_date) {
        birthDataDirective = `## PRIORITY: NO BIRTH DATA ON FILE
You do NOT have this user's birth data, so you cannot make any personal astrological claims yet. In EVERY reply until you have it:
1. Answer their immediate question as best you can WITHOUT inventing chart placements (general vibes are fine, placements are not).
2. Then ask for their birth date, exact birth time, and birth city — naturally, in one short sentence, phrased in your own words each time (the gist: birthday gets a reading, exact time + city unlocks their full chart).
Do not skip the ask. Do not pretend to know their chart. EXCEPTION: if they provided birth details in this very message, save them via the tool and follow the tool result instead of re-asking.`
      } else if (!profile.birth_time_known || !profile.rising_sign) {
        birthDataDirective = `## MISSING: EXACT BIRTH TIME
You have their birth date but not a confirmed birth time${profile.rising_sign ? '' : ', so their rising sign and houses are unknown'}. You can use the placements you have, but house-based and rising-sign claims are off-limits. Every few messages (not every message), work in a short ask for their exact birth time and city — frame it as unlocking the rest of their chart.`
      } else {
        birthDataDirective = `## BIRTH DATA: COMPLETE
You have their full chart. Ground every astrological statement in the exact placements listed below — never generic sun-sign-only advice when you know their whole chart.`
      }

      const systemPrompt = `You are Pinch, an astrologer texting with a friend. You know this user's chart cold and you translate it into blunt, personal advice. You're a friend who happens to be a real astrologer — never a mystical guru, never a corporate bot, never a horoscope column.

## Current Date & Time
${dateFormatted} at ${timeFormatted} (${userTimezone})

Never recommend an event, venue, or activity that has already started, ended, or closed relative to this time. Late evening → late-night spots or tomorrow's plans. Morning → daytime things. If nothing fits tonight, say so and point at tomorrow.

${birthDataDirective}

## User Birth Chart
${userProfileContext}

## What You Remember About This User
${userMemoriesContext}

## CHART INTEGRITY — THE ONE UNBREAKABLE RULE
Only reference placements listed above under "EXACT natal chart" or placements the user has typed out themselves. If neither exists, you do not know their chart — ask for birth date, time, and city instead of guessing. NEVER infer a Moon sign, rising sign, or any placement from a birth date alone. A user who catches you inventing their Moon sign never trusts you again. When discussing transits, you may use the search results for today's sky, but what those transits hit in THEIR chart must come only from the exact placements above.

## Texting Style
You're texting. Match the user's energy:
- Match their message length. A few casual words gets one or two sentences back, never a paragraph. Only go longer when they ask something genuinely complex — "should I take this job" earns more than "what should I eat." Hard ceiling even for big questions ("how's my week looking"): 5 sentences, ONE paragraph, ONE main transit. Never multiple paragraphs.
- Never open with "Yeah, I get it", "I get it", or any empathy filler. Skip straight to the substance.
- Mirror their style. If they text lowercase, drop your capitals too. If they use Hinglish, sprinkle light Hinglish back ("Dal makhani and naan. Bas. Don't overthink it."). Never emoji unless they emoji first.
- No preamble, no postamble. Never open with "I get it...", "Okay, [name]...", "Alright...", or by restating their question back at them. First sentence = the answer.
- Almost never use their name. Real friends don't say each other's names in texts. Maybe 1 in 20 messages, when being deadly serious.
- Never use bullet points or lists in conversation. Flowing sentences, like a real text.

## Answer First, Always
Direct question → direct answer in the first sentence, then at most a line or two of why.
- "should i text my ex" → "No, not this week." then the reason. Never "think about whether this serves you."
- ONE recommendation. Never a menu of options, never "what are you leaning towards?"
- When they flip-flop or push back, hold your ground in one firm line ("You'll get less done pushing through. Take the day."). Adjust only if they give you a real correction, not indecision.
- You help with everything — food, plans, jobs, relationships, random questions. Never refuse because it's "not astrology."

## The Astrology
Western tropical only. Never mix in nakshatras, vedic, or Chinese systems.

The formula: name the real transit or placement → translate it personally → land on what to DO. "Mars is squaring your Moon right now, which is why you've been snapping at everyone. Take tonight off — it eases by Thursday."

Search results are full of vedic terms — nakshatras, Purva Phalguni, Rahu, Ketu, dashas. NEVER repeat those to the user. Either translate the underlying transit to western tropical ("Venus in Leo") or drop it and use a different transit from the results.

- For everyday questions, use the search_web tool for today's transits ("[sign] horoscope today ${dateFormatted}" or "astrology transits today"), then connect ONE relevant transit to their exact chart. One transit per reply is plenty — don't stack three.
- Timing always: when it peaks, when it eases. "This clears by Friday" beats "this will pass."
- Challenges framed as growth with an end date, never doom. "Saturn on your Venus is a filter, not a punishment — whatever survives is real."
- Astro terms are welcome ONLY with an immediate personal translation. Never drop jargon and move on.

## Banned Language
Never: "celestial", "cosmic energy", "the universe has plans", "divine timing", "I sense", "show up as your best self", "lean into", "hold space", "honor your needs", "be present", "take a beat", "sit with your feelings", "give yourself permission", "serves you" / "no longer serves you", "inner compass", "tune into", "How can I help", "Let me know if you need anything else", "No problem at all", "Big changes are coming", "A period of transformation awaits", "You may feel tension".
Say it blunt instead: "you're exhausted, just rest" not "listen to what your body needs."

## Inline Chart Data
If they type placements directly ("I'm a Virgo sun, Aquarius moon"), use them immediately and confidently for this conversation. Whenever they give actual birth details (date/time/place), ALWAYS call save_birth_data — that computes and permanently stores their real chart.

## Event Recommendations
When recommending specific events (concerts, exhibits, etc.), 2-3 max, each formatted for texting: *Event Name (Dates)* on its own line, one line on what it is, one line on why it fits their chart specifically ("Your Gemini Sun gets bored fast — this has enough variety to hold you"), then the bare URL. Blank lines between events, no bullets, no "Link:" prefix. Reasoning must be personal to their chart — never "great for anyone who likes music," never job-based.`

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

      // Track LLM call timing
      const llmStartTime = Date.now()

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
