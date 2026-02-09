import { supabase } from './supabase'

export interface UserProfile {
  phone_number: string
  preferred_name?: string
  birth_date?: string
  birth_time?: string
  birth_time_known?: boolean
  birth_time_accuracy?: 'exact' | 'approximate' | 'unknown'
  birth_timezone?: string
  birth_city?: string
  birth_country?: string
  birth_latitude?: number
  birth_longitude?: number
  updated_at?: string
  created_at?: string
}

export class UserProfileService {
  static async getUserProfile(phoneNumber: string): Promise<UserProfile | null> {
    if (!supabase) {
      console.error('Supabase not configured')
      return null
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile found - this is expected for new users
          console.log(`No profile found for phone number: ${phoneNumber}`)
          return null
        }
        console.error('Error fetching user profile:', error)
        return null
      }

      return data as UserProfile
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }

  static formatProfileForAgent(profile: UserProfile | null): string {
    if (!profile) {
      return "No birth data or profile information available for this user."
    }

    const parts = []
    
    if (profile.preferred_name) {
      parts.push(`User's name: ${profile.preferred_name}`)
    }
    
    if (profile.birth_date) {
      parts.push(`Birth date: ${profile.birth_date}`)
    }
    
    if (profile.birth_time && profile.birth_time_known) {
      const accuracy = profile.birth_time_accuracy || 'unknown'
      parts.push(`Birth time: ${profile.birth_time} (${accuracy})`)
    } else {
      parts.push(`Birth time: Not provided or unknown`)
    }
    
    if (profile.birth_city || profile.birth_country) {
      const location = [profile.birth_city, profile.birth_country].filter(Boolean).join(', ')
      parts.push(`Birth location: ${location}`)
    }
    
    if (profile.birth_timezone) {
      parts.push(`Timezone: ${profile.birth_timezone}`)
    }

    return parts.join('\n')
  }
}