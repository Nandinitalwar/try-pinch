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
  sun_sign?: string
  moon_sign?: string
  rising_sign?: string
  chart_json?: string
  chart_introduced_at?: string
  updated_at?: string
  created_at?: string
}

function normalizedNameText(value: string): string {
  return Array.from(value.normalize('NFKC').toLowerCase())
    .map(character => {
      const isAsciiWord = /[a-z0-9]/.test(character)
      const isLetter = character.toLocaleUpperCase() !== character.toLocaleLowerCase()
      return isAsciiWord || isLetter || /[' -]/.test(character) ? character : ' '
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasLetterOrNumber(value: string): boolean {
  return Array.from(value).some(character =>
    /[a-z0-9]/i.test(character) ||
    character.toLocaleUpperCase() !== character.toLocaleLowerCase()
  )
}

/** Accept a name only when the newest user message actually claims it. */
export function isExplicitPreferredName(latestMessage: string, proposedName: string): boolean {
  const message = normalizedNameText(latestMessage)
  const name = normalizedNameText(proposedName)
  if (!message || !name || name.length > 80) return false
  if (message === name) return true

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(
    `(?:^|\\b)(?:i(?:'m| am)|my name is|call me|you can call me|it(?:'s| is))\\s+${escapedName}(?:\\b|$)|(?:^|\\b)${escapedName}\\s+(?:is fine|works|please)(?:\\b|$)`,
    'i',
  ).test(message)
}

export class UserProfileService {
  static async savePreferredName(phoneNumber: string, name: string): Promise<boolean> {
    if (!convex) return false

    const preferredName = name.trim().replace(/\s+/g, ' ')
    if (!preferredName || preferredName.length > 80 || !hasLetterOrNumber(preferredName)) {
      return false
    }

    try {
      await convex.mutation(api.profiles.upsert, { phoneNumber, preferredName })
      return true
    } catch (error) {
      console.error('Error saving preferred name:', error)
      return false
    }
  }

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
        sun_sign: doc.sunSign,
        moon_sign: doc.moonSign,
        rising_sign: doc.risingSign,
        chart_json: doc.chartJson,
        chart_introduced_at: doc.chartIntroducedAt
          ? new Date(doc.chartIntroducedAt).toISOString()
          : undefined,
        updated_at: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
        created_at: new Date(doc._creationTime).toISOString(),
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }

  static async markChartIntroduced(phoneNumber: string): Promise<boolean> {
    if (!convex) return false

    try {
      return await convex.mutation(api.profiles.markChartIntroduced, {
        phoneNumber,
        introducedAt: Date.now(),
      })
    } catch (error) {
      console.error('Error marking chart introduced:', error)
      return false
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

    // Real computed chart - these placements are from an ephemeris, not guesses
    if (profile.chart_json) {
      try {
        const chart = JSON.parse(profile.chart_json)
        const moonAccuracy = chart.accuracy?.moon
        const lines = (chart.placements || []).map((p: any) => {
          if (p.body === 'Moon' && moonAccuracy?.certainty === 'sign-change-possible') {
            return `  Moon: uncertain without a birth time; possible signs are ${moonAccuracy.possibleSigns.join(' or ')} (noon position: ${p.sign} ${p.degree}°)`
          }
          if (p.body === 'Moon' && moonAccuracy?.certainty === 'ambiguous-local-time') {
            return `  Moon: local birth time is DST-ambiguous; sign possibilities are ${moonAccuracy.possibleSigns.join(' or ')} (first occurrence: ${p.sign} ${p.degree}°)`
          }
          return `  ${p.body}: ${p.sign} ${p.degree}°`
        })
        if (chart.ascendant) {
          lines.push(`  Ascendant (Rising): ${chart.ascendant.sign} ${chart.ascendant.degree}°`)
        } else if (chart.accuracy?.ascendant === 'ambiguous-local-time') {
          const possible = (chart.accuracy.possibleAscendants || []).map(
            (placement: any) => `${placement.sign} ${placement.degree}°`
          )
          lines.push(`  Ascendant: uncertain because the local birth time occurred twice during a DST change${possible.length ? `; possible positions are ${possible.join(' or ')}` : ''}`)
        } else {
          lines.push('  Ascendant: unknown (no birth time)')
        }
        const accuracyLabel = ['sign-change-possible', 'ambiguous-local-time'].includes(moonAccuracy?.certainty)
          ? 'computed from ephemeris; time-sensitive placements are explicitly uncertain'
          : 'computed from ephemeris'
        parts.push(`EXACT natal chart (${accuracyLabel} - use ONLY these placements, never guess):\n${lines.join('\n')}`)
      } catch {
        // fall through to sign summary
      }
    } else if (profile.sun_sign) {
      parts.push(`Sun: ${profile.sun_sign}${profile.moon_sign ? `, Moon: ${profile.moon_sign}` : ''}${profile.rising_sign ? `, Rising: ${profile.rising_sign}` : ''}`)
    }

    return parts.join('\n')
  }
}
