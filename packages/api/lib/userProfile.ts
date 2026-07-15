import { convex, api } from './convexClient'

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
    if (!convex) {
      console.error('Convex not configured')
      return null
    }

    try {
      const doc = await convex.query(api.profiles.getByPhone, { phoneNumber })

      if (!doc) {
        // No profile found - this is expected for new users
        console.log(`No profile found for phone number: ${phoneNumber}`)
        return null
      }

      return {
        phone_number: doc.phoneNumber,
        preferred_name: doc.preferredName,
        birth_date: doc.birthDate,
        birth_time: doc.birthTime,
        birth_time_known: doc.birthTimeKnown,
        birth_time_accuracy: doc.birthTimeAccuracy,
        birth_timezone: doc.birthTimezone,
        birth_city: doc.birthCity,
        birth_country: doc.birthCountry,
        birth_latitude: doc.birthLatitude,
        birth_longitude: doc.birthLongitude,
        updated_at: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
        created_at: new Date(doc._creationTime).toISOString(),
      }
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
