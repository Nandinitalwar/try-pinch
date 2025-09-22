import { NextRequest, NextResponse } from 'next/server'

const GEONAMES_USERNAME = process.env.GEONAMES_USERNAME || 'nandinitalwar'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const maxRows = searchParams.get('maxRows') || '15'
    const country = searchParams.get('country') || ''

    if (!query || query.length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters long' }, { status: 400 })
    }

    // Build GeoNames API URL
    let geonamesUrl = `http://api.geonames.org/searchJSON?q=${encodeURIComponent(query)}&maxRows=${maxRows}&username=${GEONAMES_USERNAME}&orderby=relevance`

    if (country) {
      geonamesUrl += `&country=${country}`
    }

    const response = await fetch(geonamesUrl)
    
    if (!response.ok) {
      throw new Error(`GeoNames API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Check if we hit the API limit
    if (data.status && data.status.value === 18) {
      return NextResponse.json({ 
        error: 'GeoNames API limit exceeded. Please try again later or use a custom location.',
        limitExceeded: true 
      }, { status: 429 })
    }
    
    // Transform GeoNames data to our format
    const locations = data.geonames?.map((place: any) => ({
      id: place.geonameId.toString(),
      name: place.name,
      type: getLocationType(place.featureClass, place.fcode),
      fullPath: buildFullPath(place),
      city: place.featureClass === 'P' ? place.name : undefined,
      state: place.fcode?.startsWith('ADM1') ? place.name : undefined,
      country: place.countryName,
      latitude: place.lat,
      longitude: place.lng,
      population: place.population
    })) || []

    return NextResponse.json({ locations })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch location data' },
      { status: 500 }
    )
  }
}

function getLocationType(featureClass: string, fcode: string): 'city' | 'state' | 'country' {
  if (featureClass === 'P') return 'city'
  if (fcode?.startsWith('ADM1')) return 'state'
  if (featureClass === 'A') return 'country'
  return 'city' // Default fallback
}

function buildFullPath(place: any): string {
  const parts = []
  
  if (place.name) parts.push(place.name)
  if (place.adminName1 && place.adminName1 !== place.name) parts.push(place.adminName1)
  if (place.countryName) parts.push(place.countryName)
  
  return parts.join(', ')
}