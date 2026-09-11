// Turns a shared video link into structured places for the user's vault.
//
// Deliberately does NOT download video. Downloading TikTok media is the most
// fragile link in this chain (terms restrict it, endpoints move, and it's slow
// inside a serverless function). Caption + cover image carries most of the
// signal anyway - creators put venue names in the caption and burn them into
// on-screen text, which the vision model reads off the cover frame.

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { DetectedLink } from './linkExtractor'

export interface ExtractedPlace {
  name: string
  category?: string
  city?: string
  region?: string
  note?: string
  tags?: string[]
}

interface LinkMetadata {
  title?: string
  authorName?: string
  thumbnailUrl?: string
}

/**
 * Fetch public oEmbed metadata. TikTok and YouTube both serve this unauthenticated;
 * Instagram requires an app token and will simply fail, which is fine - the
 * pipeline degrades to whatever caption text came in the message itself.
 */
async function fetchMetadata(link: DetectedLink): Promise<LinkMetadata | null> {
  let endpoint: string | null = null

  if (link.platform === 'tiktok') {
    endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(link.url)}`
  } else if (link.platform === 'youtube') {
    endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(link.url)}&format=json`
  }

  if (!endpoint) return null

  try {
    const response = await fetch(endpoint, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pinch/1.0)' },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      console.warn(`[ContentIngest] oEmbed ${link.platform} returned ${response.status}`)
      return null
    }

    const data = await response.json()
    return {
      title: data.title,
      authorName: data.author_name,
      thumbnailUrl: data.thumbnail_url,
    }
  } catch (error) {
    console.warn('[ContentIngest] oEmbed fetch failed:', error instanceof Error ? error.message : error)
    return null
  }
}

/** Download the cover frame so the vision model can read burned-in text. */
async function fetchThumbnail(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) return null

    const mimeType = response.headers.get('content-type') || 'image/jpeg'
    if (!mimeType.startsWith('image/')) return null

    const buffer = await response.arrayBuffer()
    // Cover frames are small; anything huge is a sign we fetched the wrong thing.
    if (buffer.byteLength > 8_000_000) return null

    return { data: Buffer.from(buffer).toString('base64'), mimeType }
  } catch {
    return null
  }
}

const extractionSchema: any = {
  type: SchemaType.OBJECT,
  properties: {
    places: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, description: 'Venue name exactly as written' },
          category: { type: SchemaType.STRING, description: 'restaurant | bar | cafe | hotel | activity | shop | neighborhood' },
          city: { type: SchemaType.STRING, description: 'City, if stated or clearly implied' },
          region: { type: SchemaType.STRING, description: 'State/country, if stated' },
          note: { type: SchemaType.STRING, description: 'One short line on why it is worth going, in the creator\'s framing' },
          tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['name'],
      },
    },
  },
  required: ['places'],
}

/**
 * Extract every venue a shared video is recommending. Returns [] rather than
 * guessing when the content isn't about places - a saved dance video should
 * quietly produce nothing, not a hallucinated restaurant.
 */
export async function ingestLink(
  link: DetectedLink,
  messageContext?: string
): Promise<{ places: ExtractedPlace[]; metadata: LinkMetadata | null }> {
  const metadata = await fetchMetadata(link)

  const caption = metadata?.title?.trim()
  const hasSignal = Boolean(caption || messageContext?.trim())
  if (!hasSignal && !metadata?.thumbnailUrl) {
    console.log('[ContentIngest] No usable signal for', link.url)
    return { places: [], metadata }
  }

  const rawKey = process.env.GOOGLE_AI_API_KEY
  const apiKey = rawKey?.trim().replace(/^['"]|['"]$/g, '') || ''
  if (!apiKey) {
    console.error('[ContentIngest] GOOGLE_AI_API_KEY not configured')
    return { places: [], metadata }
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: extractionSchema,
      temperature: 0.2,
    },
  })

  const parts: any[] = []

  const thumbnail = metadata?.thumbnailUrl ? await fetchThumbnail(metadata.thumbnailUrl) : null
  if (thumbnail) {
    parts.push({ inlineData: { data: thumbnail.data, mimeType: thumbnail.mimeType } })
  }

  parts.push({
    text: `Extract every specific venue or place this ${link.platform} post recommends.

Caption: ${caption || '(none available)'}
Creator: ${metadata?.authorName || '(unknown)'}
${messageContext ? `The person saving it said: ${messageContext}` : ''}
${thumbnail ? 'The attached image is the cover frame - read any text burned into it, that is usually where venue names appear.' : ''}

Rules:
- Only real, named venues. No generic categories like "a cute cafe".
- If the post is not recommending places at all, return an empty list.
- Never invent a city. Leave it out unless it is stated or unmistakable.
- Keep notes to one short line, in the creator's framing, not your own.`,
  })

  try {
    const result = await model.generateContent({ contents: [{ role: 'user', parts }] })
    const text = result.response.text()
    if (!text?.trim()) return { places: [], metadata }

    const parsed = JSON.parse(text)
    const places: ExtractedPlace[] = (parsed.places || [])
      .filter((p: any) => p?.name?.trim())
      .map((p: any) => ({
        name: p.name.trim(),
        category: p.category?.trim() || undefined,
        city: p.city?.trim() || undefined,
        region: p.region?.trim() || undefined,
        note: p.note?.trim() || undefined,
        tags: Array.isArray(p.tags) ? p.tags.filter(Boolean) : undefined,
      }))

    console.log(`[ContentIngest] ${link.url} -> ${places.length} place(s)`)
    return { places, metadata }
  } catch (error) {
    console.error('[ContentIngest] Extraction failed:', error instanceof Error ? error.message : error)
    return { places: [], metadata }
  }
}

/** Stable key for deduping the same venue arriving from several videos. */
export function normalizePlaceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
