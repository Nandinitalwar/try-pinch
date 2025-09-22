import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Indian Astrology Data Sources and APIs
const ASTROLOGY_SOURCES = {
  // Panchang and Muhurta
  panchang: 'https://api.vedicrishiastro.com/v1/panchang',
  // Horoscope and Planetary Positions
  horoscope: 'https://api.vedicrishiastro.com/v1/horoscope',
  // Nakshatra Information
  nakshatra: 'https://api.vedicrishiastro.com/v1/nakshatra',
  // Planetary Positions
  planetary: 'https://api.vedicrishiastro.com/v1/planets',
}

// Indian Astrology Knowledge Base
const INDIAN_ASTROLOGY_KB = {
  nakshatras: [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
    'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
    'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta',
    'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
  ],
  rashis: [
    'Mesha (Aries)', 'Vrishabha (Taurus)', 'Mithuna (Gemini)', 'Karka (Cancer)',
    'Simha (Leo)', 'Kanya (Virgo)', 'Tula (Libra)', 'Vrishchika (Scorpio)',
    'Dhanu (Sagittarius)', 'Makara (Capricorn)', 'Kumbha (Aquarius)', 'Meena (Pisces)'
  ],
  grahas: [
    'Surya (Sun)', 'Chandra (Moon)', 'Mangal (Mars)', 'Budh (Mercury)',
    'Guru (Jupiter)', 'Shukra (Venus)', 'Shani (Saturn)', 'Rahu (North Node)', 'Ketu (South Node)'
  ],
  gemstones: {
    'Surya': 'Ruby (Manik)',
    'Chandra': 'Pearl (Moti)',
    'Mangal': 'Red Coral (Moonga)',
    'Budh': 'Emerald (Panna)',
    'Guru': 'Yellow Sapphire (Pukhraj)',
    'Shukra': 'Diamond (Heera)',
    'Shani': 'Blue Sapphire (Neelam)',
    'Rahu': 'Hessonite Garnet (Gomed)',
    'Ketu': 'Cat\'s Eye (Lehsunia)'
  },
  festivals: [
    'Makar Sankranti', 'Vasant Panchami', 'Maha Shivratri', 'Holi',
    'Ram Navami', 'Hanuman Jayanti', 'Akshaya Tritiya', 'Guru Purnima',
    'Raksha Bandhan', 'Krishna Janmashtami', 'Ganesh Chaturthi', 'Navratri',
    'Dussehra', 'Diwali', 'Kartik Purnima'
  ]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    switch (type) {
      case 'nakshatras':
        return NextResponse.json({
          nakshatras: INDIAN_ASTROLOGY_KB.nakshatras,
          description: 'The 27 Nakshatras (lunar mansions) in Vedic Astrology'
        })

      case 'rashis':
        return NextResponse.json({
          rashis: INDIAN_ASTROLOGY_KB.rashis,
          description: 'The 12 Rashi (zodiac signs) in Vedic Astrology'
        })

      case 'grahas':
        return NextResponse.json({
          grahas: INDIAN_ASTROLOGY_KB.grahas,
          description: 'The 9 Grahas (planets) in Vedic Astrology'
        })

      case 'gemstones':
        return NextResponse.json({
          gemstones: INDIAN_ASTROLOGY_KB.gemstones,
          description: 'Traditional gemstones associated with each planet'
        })

      case 'festivals':
        return NextResponse.json({
          festivals: INDIAN_ASTROLOGY_KB.festivals,
          description: 'Major Indian festivals and their astrological significance'
        })

      case 'today':
        // Simulate today's astrological data
        const today = new Date()
        const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
        const nakshatraIndex = dayOfYear % 27
        const rashiIndex = dayOfYear % 12

        return NextResponse.json({
          date: date,
          nakshatra: INDIAN_ASTROLOGY_KB.nakshatras[nakshatraIndex],
          rashi: INDIAN_ASTROLOGY_KB.rashis[rashiIndex],
          message: `Today's cosmic energy is influenced by ${INDIAN_ASTROLOGY_KB.nakshatras[nakshatraIndex]} Nakshatra and ${INDIAN_ASTROLOGY_KB.rashis[rashiIndex]} Rashi.`,
          recommendations: [
            'Perform morning prayers during Brahma Muhurta (4:00-6:00 AM)',
            'Chant mantras associated with today\'s ruling planet',
            'Wear colors that align with today\'s Nakshatra energy',
            'Practice meditation during auspicious planetary hours'
          ]
        })

      default:
        return NextResponse.json({
          available_types: Object.keys(INDIAN_ASTROLOGY_KB),
          message: 'Specify a type parameter to get specific astrological data'
        })
    }

  } catch (error) {
    console.error('Error in astrology data API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch astrological data' },
      { status: 500 }
    )
  }
} 