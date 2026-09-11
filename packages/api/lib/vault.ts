// The vault: raw event logging plus the saved-places graph built on top of it.
//
// Everything inbound is logged first and interpreted second, so extraction can
// be rerun or improved later against history we already hold.

import { convex, api } from './convexClient'
import { extractIngestableLinks, DetectedLink } from './linkExtractor'
import { ingestLink, normalizePlaceName, ExtractedPlace } from './contentIngest'
import {
  analyzeMedia,
  analyzeMediaData,
  MediaAnalysis,
  ProcessedMediaResult,
} from './mediaIngest'

export interface VaultPlace {
  _id: string
  name: string
  category?: string
  city?: string
  region?: string
  note?: string
  tags?: string[]
  sourceUrls: string[]
  mentionCount: number
  visited?: boolean
  lastSeen: number
}

export interface VaultGarment {
  _id: string
  item: string
  category?: string
  color?: string
  pattern?: string
  vibe?: string
  wornCount: number
  lastSeen: number
}

export class Vault {
  /**
   * Record an inbound message verbatim, including any media and links.
   * Returns the event id so extracted entities can point back at their source.
   */
  static async logInbound(params: {
    phoneNumber: string
    source: string
    text?: string
    mediaUrls?: string[]
  }): Promise<string | null> {
    if (!convex) return null

    const links = params.text ? extractIngestableLinks(params.text).map(l => l.url) : []

    try {
      const eventId = await convex.mutation(api.events.log, {
        phoneNumber: params.phoneNumber,
        source: params.source,
        kind: params.mediaUrls?.length ? 'attachment' : links.length ? 'link' : 'message',
        text: params.text,
        mediaUrls: params.mediaUrls?.length ? params.mediaUrls : undefined,
        links: links.length ? links : undefined,
        occurredAt: Date.now(),
      })
      return eventId as unknown as string
    } catch (error) {
      console.error('[Vault] Failed to log event:', error)
      return null
    }
  }

  /**
   * Run link extraction for a message and fold the results into the vault.
   * Safe to call in the background - it never throws into the reply path.
   */
  static async processLinks(params: {
    phoneNumber: string
    text: string
    eventId?: string | null
  }): Promise<number> {
    const links = extractIngestableLinks(params.text)
    if (links.length === 0) return 0
    if (!convex) return 0

    console.log(`[Vault] Processing ${links.length} link(s) for ${params.phoneNumber}`)

    // Strip the URLs out before passing the rest as context, so the model sees
    // what the person actually said about the video rather than the link itself.
    let context = params.text
    for (const link of links) context = context.replace(link.url, '')
    context = context.trim()

    let saved = 0

    for (const link of links) {
      try {
        const { places } = await ingestLink(link, context || undefined)

        for (const place of places) {
          await this.savePlace(params.phoneNumber, place, link.url, params.eventId)
          saved++
        }
      } catch (error) {
        console.error(`[Vault] Failed to process ${link.url}:`, error)
      }
    }

    if (params.eventId) {
      try {
        await convex.mutation(api.events.markProcessed, { eventId: params.eventId })
      } catch {
        // Non-fatal: the event stays queued and gets picked up on a later pass.
      }
    }

    console.log(`[Vault] Saved ${saved} place(s) for ${params.phoneNumber}`)
    return saved
  }

  /**
   * Analyze photos, videos, and voice notes. Visual discoveries are folded
   * into the vault/wardrobe; exact voice transcripts return to the caller so
   * they can participate in chat history, retrieval, and memory extraction.
   */
  static async processMedia(params: {
    phoneNumber: string
    mediaUrls?: string[]
    inlineMedia?: Array<{ data: string; mimeType: string }>
    text?: string
    eventId?: string | null
  }): Promise<ProcessedMediaResult> {
    const urls = params.mediaUrls ?? []
    const inline = params.inlineMedia ?? []
    const output: ProcessedMediaResult = { visualSummaries: [], transcripts: [], failedCount: 0 }
    if (urls.length + inline.length === 0) return output

    console.log(`[Vault] Analyzing ${urls.length + inline.length} media item(s) for ${params.phoneNumber}`)

    const jobs: Array<{ sourceUrl?: string; run: () => Promise<MediaAnalysis | null> }> = [
      ...urls.map(url => ({ sourceUrl: url, run: () => analyzeMedia(url, params.text) })),
      ...inline.map(m => ({ run: () => analyzeMediaData(m.data, m.mimeType, params.text) })),
    ]

    for (const job of jobs) {
      try {
        const analysis = await job.run()
        if (!analysis) {
          output.failedCount++
          continue
        }

        if (analysis.transcript) output.transcripts.push(analysis.transcript)
        else if (analysis.description) output.visualSummaries.push(analysis.description)

        for (const place of analysis.places) {
          await this.savePlace(params.phoneNumber, place, job.sourceUrl, params.eventId)
        }

        for (const garment of analysis.garments) {
          if (!convex) break
          await convex.mutation(api.garments.upsert, {
            phoneNumber: params.phoneNumber,
            item: garment.item,
            itemNormalized: normalizePlaceName(garment.item),
            category: garment.category,
            color: garment.color,
            pattern: garment.pattern,
            vibe: garment.vibe,
            eventId: params.eventId ?? undefined,
          })
        }

        // Screenshots of saved lists are links in disguise - a shared story or
        // a friend's recommendation text. Run the detected text back through
        // link extraction so those get ingested too.
        if (analysis.detectedText) {
          const nested = extractIngestableLinks(analysis.detectedText)
          if (nested.length > 0) {
            await this.processLinks({
              phoneNumber: params.phoneNumber,
              text: analysis.detectedText,
              eventId: params.eventId,
            })
          }
        }
      } catch (error) {
        output.failedCount++
        console.error(`[Vault] Failed to analyze ${job.sourceUrl ?? 'upload'}:`, error)
      }
    }

    return output
  }

  private static async savePlace(
    phoneNumber: string,
    place: ExtractedPlace,
    sourceUrl?: string,
    eventId?: string | null
  ): Promise<void> {
    if (!convex) return
    await convex.mutation(api.places.upsert, {
      phoneNumber,
      name: place.name,
      nameNormalized: normalizePlaceName(place.name),
      category: place.category,
      city: place.city,
      region: place.region,
      note: place.note,
      tags: place.tags,
      sourceUrl,
      eventId: eventId ?? undefined,
    })
  }

  static async getGarments(phoneNumber: string, limit = 100): Promise<VaultGarment[]> {
    if (!convex) return []
    try {
      return (await convex.query(api.garments.listByPhone, { phoneNumber, limit })) || []
    } catch (error) {
      console.error('[Vault] Failed to load garments:', error)
      return []
    }
  }

  static async getPlaces(phoneNumber: string, limit = 100): Promise<VaultPlace[]> {
    if (!convex) return []
    try {
      return (await convex.query(api.places.listByPhone, { phoneNumber, limit })) || []
    } catch (error) {
      console.error('[Vault] Failed to load places:', error)
      return []
    }
  }

  /**
   * City match is done in memory rather than via the city index because
   * extracted cities are free text ("Mystic" vs "Mystic, CT") and an exact
   * index lookup would miss most of them.
   */
  static async getPlacesByCity(phoneNumber: string, city: string, limit = 50): Promise<VaultPlace[]> {
    const all = await this.getPlaces(phoneNumber, 200)
    const needle = city.toLowerCase().trim()
    return all
      .filter(p => p.city?.toLowerCase().includes(needle) || p.region?.toLowerCase().includes(needle))
      .slice(0, limit)
  }

  /** Compact vault summary for the agent prompt. */
  static formatForAgent(places: VaultPlace[]): string {
    if (places.length === 0) return 'No saved places yet.'

    const byCity = new Map<string, VaultPlace[]>()
    for (const place of places) {
      const key = place.city || 'Unsorted'
      if (!byCity.has(key)) byCity.set(key, [])
      byCity.get(key)!.push(place)
    }

    let out = `Saved places (${places.length} total):\n`
    for (const [city, cityPlaces] of Array.from(byCity.entries())) {
      out += `\n${city}:\n`
      for (const p of cityPlaces.slice(0, 15)) {
        const repeats = p.mentionCount > 1 ? ` [saved ${p.mentionCount}x]` : ''
        const been = p.visited ? ' [already been]' : ''
        out += `- ${p.name}${p.category ? ` (${p.category})` : ''}${repeats}${been}${p.note ? ` - ${p.note}` : ''}\n`
      }
    }
    return out
  }

  /** Compact wardrobe summary for the agent prompt. */
  static formatGarmentsForAgent(garments: VaultGarment[]): string {
    if (garments.length === 0) return 'No wardrobe photos yet.'

    let out = `Wardrobe seen in their photos (${garments.length} item${garments.length === 1 ? '' : 's'}):\n`
    for (const g of garments.slice(0, 25)) {
      const details = [g.color, g.pattern, g.category].filter(Boolean).join(', ')
      const worn = g.wornCount > 1 ? ` [worn ${g.wornCount}x]` : ''
      out += `- ${g.item}${details ? ` (${details})` : ''}${worn}${g.vibe ? ` - reads ${g.vibe}` : ''}\n`
    }
    return out
  }
}
