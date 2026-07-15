import { convex, api } from './convexClient'
import { computeNatalChart } from './astrology'
import { GoogleGenerativeAI } from '@google/generative-ai'

export interface BirthData {
  name?: string
  birth_date: string // YYYY-MM-DD format
  birth_time: string // HH:MM:SS format
  birth_time_known: boolean
  birth_time_accuracy: 'exact' | 'approximate' | 'unknown'
  birth_timezone: string
  birth_city: string
  birth_country: string
  birth_latitude?: number
  birth_longitude?: number
}

export class BirthDataParser {
  private static genAI: GoogleGenerativeAI | null = null
  private static model: any = null

  private static initializeAI() {
    if (!this.genAI) {
      const rawKey = process.env.GOOGLE_AI_API_KEY
      const apiKey = rawKey?.trim().replace(/^['"]|['"]$/g, '') || ''
      if (!apiKey) {
        console.error('GOOGLE_AI_API_KEY is not configured for BirthDataParser')
        return false
      }
      this.genAI = new GoogleGenerativeAI(apiKey)
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    }
    return true
  }

  static async extractBirthData(message: string, conversationHistory?: Array<{role: string, content: string}>): Promise<BirthData | null> {
    const text = message.toLowerCase()
    
    // Check if message contains birth-related keywords or date patterns
    const birthKeywords = ['birth', 'born', 'birthdate', 'dob', 'date of birth', 'place of birth', 'birthday']
    const hasbirthKeywords = birthKeywords.some(keyword => text.includes(keyword))
    
    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
      /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i,
      /\b\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i,
    ]
    const hasDatePattern = datePatterns.some(pattern => pattern.test(text))
    
    if (!hasbirthKeywords && !hasDatePattern) {
      return null
    }

    // Initialize AI
    if (!this.initializeAI()) {
      console.error('[BirthDataParser] Failed to initialize AI, falling back to basic parsing')
      return this.extractBirthDataBasic(message)
    }

    try {
      // Build context from conversation history
      let conversationContext = ''
      if (conversationHistory && conversationHistory.length > 0) {
        const recentHistory = conversationHistory.slice(-10) // Last 10 messages
        conversationContext = recentHistory.map(m => `${m.role}: ${m.content}`).join('\n')
      }

      const prompt = `Extract birth information from this user message. The user may be providing their birth details.

${conversationContext ? `Recent conversation context:\n${conversationContext}\n\n` : ''}Current message: "${message}"

Extract any of the following information if present:
- name: The user's name or preferred name
- birth_date: Date of birth in YYYY-MM-DD format. Parse dates intelligently - if user says "July 6, 1995" or "7/6/1995" (American format MM/DD/YYYY) or "6/7/1995" (European format DD/MM/YYYY), determine the most likely format based on context. American users typically use MM/DD/YYYY.
- birth_time: Time of birth in HH:MM:SS format (24-hour). If not provided, use null.
- birth_time_known: true if they provided a specific time, false otherwise
- birth_time_accuracy: "exact" if they gave a specific time, "approximate" if they said "around" or "about", "unknown" if no time given
- birth_city: City where they were born
- birth_country: Country where they were born
- birth_timezone: The IANA timezone for the birth location (e.g., "America/Los_Angeles" for California, "America/New_York" for New York, "Europe/London" for UK, "Asia/Kolkata" for India). Determine this based on the birth city/country.
- birth_latitude: Approximate latitude of the birth city in decimal degrees (e.g., 28.61 for New Delhi). City-center precision is fine.
- birth_longitude: Approximate longitude of the birth city in decimal degrees, negative for west (e.g., -122.42 for San Francisco).

IMPORTANT timezone mappings:
- California, PST, Pacific: America/Los_Angeles
- New York, EST, Eastern: America/New_York
- Chicago, CST, Central: America/Chicago
- Denver, MST, Mountain: America/Denver
- London, UK: Europe/London
- India: Asia/Kolkata
- If location is in USA and no specific city, try to infer from context or default to America/New_York

Return ONLY a valid JSON object with these fields. Use null for any field you cannot determine.
Example: {"name": "John", "birth_date": "1995-07-06", "birth_time": "14:30:00", "birth_time_known": true, "birth_time_accuracy": "exact", "birth_city": "San Francisco", "birth_country": "USA", "birth_timezone": "America/Los_Angeles", "birth_latitude": 37.77, "birth_longitude": -122.42}

If no birth information is found, return: {"no_birth_data": true}`

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.1, // Low temperature for accurate extraction
        }
      })

      const responseText = result.response.text()
      console.log('[BirthDataParser] AI extraction response:', responseText)

      // Parse JSON from response - handle markdown code blocks
      let jsonText = responseText
      // Remove markdown code blocks if present
      const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1].trim()
      }
      
      // Extract JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('[BirthDataParser] No JSON found in AI response')
        return this.extractBirthDataBasic(message)
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      if (parsed.no_birth_data) {
        return null
      }

      // Validate we have at least a birth date
      if (!parsed.birth_date) {
        console.log('[BirthDataParser] No birth date extracted')
        return null
      }

      // Build BirthData object
      const birthData: BirthData = {
        name: parsed.name || undefined,
        birth_date: parsed.birth_date,
        birth_time: parsed.birth_time || '12:00:00',
        birth_time_known: parsed.birth_time_known || false,
        birth_time_accuracy: parsed.birth_time_accuracy || 'unknown',
        birth_timezone: parsed.birth_timezone || 'UTC',
        birth_city: parsed.birth_city || 'Unknown',
        birth_country: parsed.birth_country || 'Unknown',
        birth_latitude: typeof parsed.birth_latitude === 'number' ? parsed.birth_latitude : undefined,
        birth_longitude: typeof parsed.birth_longitude === 'number' ? parsed.birth_longitude : undefined,
      }

      console.log('[BirthDataParser] Extracted birth data:', birthData)
      return birthData

    } catch (error) {
      console.error('[BirthDataParser] AI extraction error:', error)
      return this.extractBirthDataBasic(message)
    }
  }

  // Fallback basic regex-based extraction
  private static extractBirthDataBasic(message: string): BirthData | null {
    try {
      const dateMatch = message.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/)
      if (!dateMatch) {
        return null
      }

      const [_, part1, part2, year] = dateMatch
      let month = parseInt(part1)
      let day = parseInt(part2)

      // Assume MM/DD/YYYY for American users
      if (day > 12 && month <= 12) {
        // Already correct MM/DD format
      } else if (month > 12) {
        [day, month] = [month, day]
      }

      const birthDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

      return {
        birth_date: birthDate,
        birth_time: '12:00:00',
        birth_time_known: false,
        birth_time_accuracy: 'unknown',
        birth_timezone: 'UTC',
        birth_city: 'Unknown',
        birth_country: 'Unknown',
      }
    } catch (error) {
      console.error('[BirthDataParser] Basic extraction error:', error)
      return null
    }
  }
  
  static async saveBirthData(phoneNumber: string, birthData: BirthData): Promise<boolean> {
    if (!convex) {
      console.error('Convex not configured')
      return false
    }

    try {
      // Compute the real natal chart from ephemeris - never LLM-guessed
      let chartFields: {
        sunSign?: string
        moonSign?: string
        risingSign?: string
        chartJson?: string
      } = {}
      try {
        const chart = computeNatalChart({
          birthDate: birthData.birth_date,
          birthTime: birthData.birth_time,
          timezone: birthData.birth_timezone,
          latitude: birthData.birth_latitude,
          longitude: birthData.birth_longitude,
          birthTimeKnown: birthData.birth_time_known,
        })
        chartFields = {
          sunSign: chart.placements.find(p => p.body === 'Sun')?.sign,
          moonSign: chart.placements.find(p => p.body === 'Moon')?.sign,
          risingSign: chart.ascendant?.sign,
          chartJson: JSON.stringify(chart),
        }
        console.log('[BirthDataParser] Computed chart:', chartFields.sunSign, 'Sun,', chartFields.moonSign, 'Moon,', chartFields.risingSign || 'unknown', 'rising')
      } catch (chartError) {
        console.error('[BirthDataParser] Chart computation failed:', chartError)
      }

      await convex.mutation(api.profiles.upsert, {
        phoneNumber,
        preferredName: birthData.name,
        birthDate: birthData.birth_date,
        birthTime: birthData.birth_time,
        birthTimeKnown: birthData.birth_time_known,
        birthTimeAccuracy: birthData.birth_time_accuracy,
        birthTimezone: birthData.birth_timezone,
        birthCity: birthData.birth_city,
        birthCountry: birthData.birth_country,
        birthLatitude: birthData.birth_latitude,
        birthLongitude: birthData.birth_longitude,
        ...chartFields,
      })

      console.log('Birth data saved successfully for', phoneNumber)
      return true
    } catch (error) {
      console.error('Error saving birth data:', error)
      return false
    }
  }
}