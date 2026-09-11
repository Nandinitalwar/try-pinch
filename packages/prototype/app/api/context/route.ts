import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function cleanHeader(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value).replace(/\+/g, ' ').trim().slice(0, 80) || null;
  } catch {
    return value.trim().slice(0, 80) || null;
  }
}

/**
 * Vercel derives these coarse fields at the edge from the incoming request.
 * The raw IP and precise coordinates never reach the client or get stored.
 * Localhost has no edge geography, so the client falls back to its timezone.
 */
export function GET(request: NextRequest) {
  const city = cleanHeader(request.headers.get('x-vercel-ip-city'));
  const region = cleanHeader(request.headers.get('x-vercel-ip-country-region'));
  const country = cleanHeader(request.headers.get('x-vercel-ip-country'));

  return NextResponse.json(
    {
      city,
      region,
      country,
      source: city ? 'edge' : 'none',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  );
}
