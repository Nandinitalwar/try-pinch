import { NextRequest, NextResponse } from 'next/server'
import { verifyChartDeliveryToken } from '@/lib/chartDelivery'
import { UserProfileService } from '@/lib/userProfile'
import { NatalChart } from '@/lib/astrology'
import { AuraStyle, renderNatalChartPng } from '@/lib/chartImage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Serve a short-lived PNG URL that Linq can download before sending iMessage media. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const claims = token ? verifyChartDeliveryToken(token) : null
  if (!claims) {
    return NextResponse.json({ error: 'Invalid or expired chart link' }, { status: 401 })
  }

  try {
    const profile = await UserProfileService.getUserProfile(claims.subject)
    if (!profile?.chart_json) {
      return NextResponse.json({ error: 'No birth chart saved' }, { status: 404 })
    }

    let chart: NatalChart
    try {
      chart = JSON.parse(profile.chart_json) as NatalChart
    } catch {
      return NextResponse.json({ error: 'Stored birth chart is invalid' }, { status: 422 })
    }

    const png = await renderNatalChartPng(chart, {
      name: profile.preferred_name,
      birthDate: profile.birth_date,
      birthTime: profile.birth_time,
      birthTimeKnown: profile.birth_time_known,
      birthTimeAccuracy: profile.birth_time_accuracy,
      birthCity: profile.birth_city,
      birthCountry: profile.birth_country,
    }, {
      layout: request.nextUrl.searchParams.get('view') === 'full' ? 'full' : 'aura',
      auraStyle: ((style => ['midnight', 'prism', 'velvet'].includes(style) ? style : 'midnight')(
        request.nextUrl.searchParams.get('style') || '',
      )) as AuraStyle,
    })

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(png.byteLength),
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline; filename="pinch-birth-chart.png"',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[iMessage Chart] Error:', error)
    return NextResponse.json({ error: 'Could not generate chart image' }, { status: 500 })
  }
}
