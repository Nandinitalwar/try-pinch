import { NextRequest, NextResponse } from 'next/server'
import { Vault } from '@/lib/vault'

/**
 * Read the user's vault - saved places and wardrobe.
 * GET /api/vault?sessionId=...
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
  }

  try {
    const [places, garments] = await Promise.all([
      Vault.getPlaces(sessionId, 200),
      Vault.getGarments(sessionId, 100),
    ])

    return NextResponse.json({ places, garments })
  } catch (error) {
    console.error('[Vault API] Error:', error)
    return NextResponse.json({ error: 'Failed to load vault' }, { status: 500 })
  }
}
