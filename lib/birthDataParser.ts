import { supabase } from './supabase'

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
  static extractBirthData(message: string): BirthData | null {
    const text = message.toLowerCase()
    
    // Check if message contains birth-related keywords
    const birthKeywords = ['birth', 'born', 'birthdate', 'dob', 'date of birth', 'place of birth']
    const hasbirthKeywords = birthKeywords.some(keyword => text.includes(keyword))
    
    // Also check for date patterns
    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, // DD/MM/YYYY or MM/DD/YYYY
      /\b\d{1,2}-\d{1,2}-\d{4}\b/g,   // DD-MM-YYYY or MM-DD-YYYY
    ]
    const hasDatePattern = datePatterns.some(pattern => pattern.test(text))
    
    if (!hasbirthKeywords && !hasDatePattern) {
      return null
    }
    
    try {
      // Extract name (look for "i'm [name]" or "my name is [name]")
      let name: string | undefined
      const namePatterns = [
        /(?:i'?m|i am)\s+([a-zA-Z]+)/i,
        /my\s+name\s+is\s+([a-zA-Z]+)/i,
        /hi\s+i'?m\s+([a-zA-Z]+)/i
      ]
      for (const pattern of namePatterns) {
        const match = message.match(pattern)
        if (match) {
          name = match[1].trim()
          break
        }
      }
      
      // Extract date
      const dateMatch = message.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/)
      if (!dateMatch) {
        return null
      }
      
      const [_, part1, part2, year] = dateMatch
      
      // Assume DD/MM/YYYY format (Indian style) for now
      // In production, you'd use locale detection or ask user to clarify
      let day = parseInt(part1)
      let month = parseInt(part2)
      
      // Basic validation and format conversion
      if (month > 12) {
        // Month is invalid, likely in DD/MM format, so swap
        [day, month] = [month, day]
      }
      
      const birthDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
      
      // Extract time
      let birthTime = '12:00:00' // default noon
      let timeKnown = false
      let timeAccuracy: 'exact' | 'approximate' | 'unknown' = 'unknown'
      
      const timePatterns = [
        /\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i, // 3:30 PM
        /\b(\d{1,2})\s*(am|pm)\b/i,         // 3 PM
        /\b(\d{1,2}):(\d{2})\b/             // 15:30 (24hr)
      ]
      
      for (const pattern of timePatterns) {
        const timeMatch = message.match(pattern)
        if (timeMatch) {
          timeKnown = true
          timeAccuracy = 'exact'
          
          let hour = parseInt(timeMatch[1])
          const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0
          const ampm = timeMatch[3]?.toLowerCase()
          
          if (ampm) {
            if (ampm === 'pm' && hour !== 12) hour += 12
            if (ampm === 'am' && hour === 12) hour = 0
          }
          
          // Ensure minute is valid
          const validMinute = isNaN(minute) ? 0 : minute
          birthTime = `${hour.toString().padStart(2, '0')}:${validMinute.toString().padStart(2, '0')}:00`
          break
        }
      }
      
      // Extract location
      let city = 'Unknown'
      let country = 'Unknown'
      
      const locationPatterns = [
        /(?:place of birth|born in|from)\s+([a-zA-Z\s]+)/i,
        /(?:in|at)\s+([a-zA-Z]+)(?:\s*,?\s*([a-zA-Z]+))?/i
      ]
      
      for (const pattern of locationPatterns) {
        const locationMatch = message.match(pattern)
        if (locationMatch) {
          const parts = locationMatch[1].trim().split(/\s*,\s*/)
          city = parts[0] || 'Unknown'
          country = parts[1] || 'Unknown'
          break
        }
      }
      
      // Specific handling for common cities
      if (text.includes('mumbai') || text.includes('bombay')) {
        city = 'Mumbai'
        country = 'India'
      }
      
      return {
        name,
        birth_date: birthDate,
        birth_time: birthTime,
        birth_time_known: timeKnown,
        birth_time_accuracy: timeAccuracy,
        birth_timezone: 'Asia/Kolkata', // Default for Indian cities, should be dynamic
        birth_city: city,
        birth_country: country
      }
    } catch (error) {
      console.error('Error parsing birth data:', error)
      return null
    }
  }
  
  static async saveBirthData(phoneNumber: string, birthData: BirthData): Promise<boolean> {
    if (!supabase) {
      console.error('Supabase not configured')
      return false
    }
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          phone_number: phoneNumber,
          preferred_name: birthData.name,
          birth_date: birthData.birth_date,
          birth_time: birthData.birth_time,
          birth_time_known: birthData.birth_time_known,
          birth_time_accuracy: birthData.birth_time_accuracy,
          birth_timezone: birthData.birth_timezone,
          birth_city: birthData.birth_city,
          birth_country: birthData.birth_country,
          birth_latitude: birthData.birth_latitude,
          birth_longitude: birthData.birth_longitude,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'phone_number'
        })
      
      if (error) {
        console.error('Error saving birth data to Supabase:', error)
        return false
      }
      
      console.log('Birth data saved successfully:', data)
      return true
    } catch (error) {
      console.error('Error saving birth data:', error)
      return false
    }
  }
}