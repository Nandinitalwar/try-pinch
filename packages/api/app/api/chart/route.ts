import { NextRequest, NextResponse } from 'next/server'
import { UserProfileService } from '@/lib/userProfile'
import { NatalChart } from '@/lib/astrology'
import { AuraStyle, renderNatalChartSvg } from '@/lib/chartImage'

export const dynamic = 'force-dynamic'

/** Return the requested web test session's stored chart as deterministic SVG. */
export async function POST(request: NextRequest) {
  try {
    const { sessionId, view, style } = await request.json()
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 160) {
      return NextResponse.json({ error: 'Missing or invalid sessionId' }, { status: 400 })
    }
    const webTestSession = /^test-(?:\d{10,}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(sessionId)
    if (process.env.NODE_ENV === 'production' && !webTestSession) {
      return NextResponse.json({ error: 'Chart images are limited to web test sessions' }, { status: 403 })
    }

    const profile = await UserProfileService.getUserProfile(sessionId)
    if (!profile?.chart_json) {
      return NextResponse.json({ error: 'No birth chart saved for this session' }, { status: 404 })
    }

    let chart: NatalChart
    try {
      chart = JSON.parse(profile.chart_json) as NatalChart
    } catch {
      return NextResponse.json({ error: 'Stored birth chart is invalid' }, { status: 422 })
    }

    const svg = renderNatalChartSvg(chart, {
      name: profile.preferred_name,
      birthDate: profile.birth_date,
      birthTime: profile.birth_time,
      birthTimeKnown: profile.birth_time_known,
      birthTimeAccuracy: profile.birth_time_accuracy,
      birthCity: profile.birth_city,
      birthCountry: profile.birth_country,
    }, {
      layout: view === 'full' ? 'full' : 'aura',
      auraStyle: (['midnight', 'prism', 'velvet'].includes(style) ? style : 'midnight') as AuraStyle,
    })

    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline; filename="pinch-birth-chart.svg"',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[Chart] Error:', error)
    return NextResponse.json({ error: 'Could not generate chart' }, { status: 500 })
  }
}
