import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create Supabase client with service role key for server-side operations
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// User Profile Types
export interface UserProfile {
  id?: string
  phone_number: string
  name?: string
  date_of_birth?: string
  time_of_birth?: string
  place_of_birth?: string
  star_sign?: string
  created_at?: string
  updated_at?: string
}

// User Profile Service
export class UserProfileService {
  // Get user profile by phone number
  static async getProfile(phoneNumber: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - user doesn't exist yet
          return null
        }
        console.error('Error fetching user profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in getProfile:', error)
      return null
    }
  }

  // Create or update user profile
  static async upsertProfile(profile: UserProfile): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert(profile, {
          onConflict: 'phone_number',
          ignoreDuplicates: false
        })
        .select()
        .single()

      if (error) {
        console.error('Error upserting user profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in upsertProfile:', error)
      return null
    }
  }

  // Update specific fields of a user profile
  static async updateProfile(phoneNumber: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('phone_number', phoneNumber)
        .select()
        .single()

      if (error) {
        console.error('Error updating user profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in updateProfile:', error)
      return null
    }
  }

  // Check if user has complete profile
  static hasCompleteProfile(profile: UserProfile | null): boolean {
    if (!profile) return false
    
    return !!(
      profile.name &&
      profile.date_of_birth &&
      profile.time_of_birth &&
      profile.place_of_birth
    )
  }

  // Extract birth details from user message
  static extractBirthDetails(message: string): Partial<UserProfile> {
    const details: Partial<UserProfile> = {}
    
    // Simple regex patterns - can be enhanced
    const namePattern = /(?:name is|i'm|i am|call me)\s+([a-zA-Z\s]+)/i
    const datePattern = /(?:born|birth|dob).*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i
    const timePattern = /(?:time|born at|birth time).*?(\d{1,2}:\d{2}(?:\s*[ap]m)?)/i
    const placePattern = /(?:place|born in|from)\s+([a-zA-Z\s,]+)/i

    const nameMatch = message.match(namePattern)
    if (nameMatch) {
      details.name = nameMatch[1].trim()
    }

    const dateMatch = message.match(datePattern)
    if (dateMatch) {
      details.date_of_birth = dateMatch[1]
    }

    const timeMatch = message.match(timePattern)
    if (timeMatch) {
      details.time_of_birth = timeMatch[1]
    }

    const placeMatch = message.match(placePattern)
    if (placeMatch) {
      details.place_of_birth = placeMatch[1].trim()
    }

    return details
  }
}