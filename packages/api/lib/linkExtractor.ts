// Detects shareable content links in inbound messages.
// When someone shares a TikTok from the iOS share sheet it arrives as a bare
// URL in the message body (often with a trailing caption), so URL detection is
// the whole ingest trigger - no integration required.

export type LinkPlatform = 'tiktok' | 'instagram' | 'youtube' | 'maps' | 'other'

export interface DetectedLink {
  url: string
  platform: LinkPlatform
}

const URL_PATTERN = /https?:\/\/[^\s<>"'\]]+/gi

function classify(url: string): LinkPlatform {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return 'other'
  }

  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok'
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram'
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return 'youtube'
  if (host === 'maps.app.goo.gl' || host === 'goo.gl' || host.endsWith('google.com')) {
    return url.includes('/maps') || host === 'maps.app.goo.gl' ? 'maps' : 'other'
  }
  return 'other'
}

/**
 * Pull content links out of a message body. Trailing punctuation is stripped
 * because share-sheet text routinely ends a URL with a period or paren.
 */
export function extractLinks(text: string): DetectedLink[] {
  if (!text) return []

  const matches = text.match(URL_PATTERN) || []
  const seen = new Set<string>()
  const links: DetectedLink[] = []

  for (const raw of matches) {
    const url = raw.replace(/[.,;:!?)\]}>]+$/, '')
    if (!url || seen.has(url)) continue
    seen.add(url)
    links.push({ url, platform: classify(url) })
  }

  return links
}

/**
 * Links worth running the extraction pipeline on. A link to a news article
 * isn't a saved place, so we only spend a model call on the platforms people
 * actually save recommendations from.
 */
export function extractIngestableLinks(text: string): DetectedLink[] {
  return extractLinks(text).filter(l => l.platform !== 'other')
}
