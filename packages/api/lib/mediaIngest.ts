// Understands photos and videos the user sends directly.
//
// Distinct from contentIngest, which handles *links* to content hosted
// elsewhere. Here we have the actual bytes, so the model sees the real thing
// rather than a cover frame - worth the extra cost because a photo of dinner
// or an outfit carries detail no caption would.

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import OpenAI, { toFile } from 'openai'
import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'
import { ExtractedPlace } from './contentIngest'

export interface ExtractedGarment {
  item: string          // "cropped leather jacket"
  category?: string     // outerwear | top | bottom | dress | shoes | accessory
  color?: string
  pattern?: string
  vibe?: string         // how it reads: "downtown", "soft", "sharp"
}

export interface MediaAnalysis {
  scene: 'outfit' | 'food' | 'place' | 'screenshot' | 'person' | 'audio' | 'other'
  description: string
  places: ExtractedPlace[]
  garments: ExtractedGarment[]
  detectedText?: string   // text visible in the image, incl. screenshots of lists
  transcript?: string     // exact speech from a voice note; treated as user-authored text
}

export interface ProcessedMediaResult {
  visualSummaries: string[]
  transcripts: string[]
  failedCount: number
}

export interface MultimodalInput {
  /** Text worth persisting/retrieving against: caption plus exact speech. */
  effectiveMessage: string
  /** Full turn sent to the reply model, including visual context/failure notes. */
  agentMessage: string
  /** Safe placeholder when a media-only turn produced no durable text. */
  historyMessage: string
}

// Inline upload ceiling. Gemini accepts larger via the Files API, but a text
// thread is not where multi-hundred-meg video shows up, and capping keeps a
// runaway download from blocking the background job.
const MAX_INLINE_BYTES = 18_000_000
const MAX_AUDIO_BYTES = 25_000_000
const MAX_TRANSCRIPTION_SECONDS = 10 * 60
const TRANSCODING_TIMEOUT_MS = 30_000

const DIRECT_TRANSCRIPTION_MIME_TYPES = new Map<string, string>([
  ['audio/mpeg', 'mp3'],
  ['audio/mp3', 'mp3'],
  ['audio/mp4', 'm4a'],
  ['audio/m4a', 'm4a'],
  ['audio/x-m4a', 'm4a'],
  ['audio/wav', 'wav'],
  ['audio/x-wav', 'wav'],
  ['audio/webm', 'webm'],
])

const MIME_BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  m4a: 'audio/mp4',
  mpeg: 'video/mpeg',
  mpga: 'audio/mpeg',
  wav: 'audio/wav',
  // When the server only says octet-stream, WebM is more commonly a browser
  // voice note here. A real video/webm Content-Type still wins above.
  webm: 'audio/webm',
  aac: 'audio/aac',
  caf: 'audio/x-caf',
  aif: 'audio/aiff',
  aiff: 'audio/aiff',
  amr: 'audio/amr',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/opus',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  mov: 'video/quicktime',
}

const analysisSchema: any = {
  type: SchemaType.OBJECT,
  properties: {
    scene: {
      type: SchemaType.STRING,
      description: 'outfit | food | place | screenshot | person | other',
    },
    description: {
      type: SchemaType.STRING,
      description: 'One concrete sentence on what this shows, including visible pose, styling, expression, and setting when a person is pictured',
    },
    detected_text: {
      type: SchemaType.STRING,
      description: 'Any text legible in the media, verbatim. Empty string if none.',
    },
    places: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING },
          city: { type: SchemaType.STRING },
          note: { type: SchemaType.STRING },
          tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['name'],
      },
    },
    garments: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          item: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING },
          color: { type: SchemaType.STRING },
          pattern: { type: SchemaType.STRING },
          vibe: { type: SchemaType.STRING },
        },
        required: ['item'],
      },
    },
  },
  required: ['scene', 'description'],
}

/**
 * Twilio media URLs sit behind HTTP Basic auth on the account credentials -
 * fetching them anonymously returns 401, which is why WhatsApp images look
 * like they "arrive empty" if you forget this.
 */
function authHeadersFor(url: string): Record<string, string> {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return {}
  }

  if (host.endsWith('twilio.com')) {
    const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
    const token = process.env.TWILIO_AUTH_TOKEN?.trim()
    if (sid && token) {
      return { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` }
    }
    console.warn('[MediaIngest] Twilio media URL but credentials missing')
  }

  return {}
}

export function isSupportedMediaMimeType(mimeType: string): boolean {
  return ['image/', 'video/', 'audio/'].some(prefix => mimeType.startsWith(prefix))
}

function inferMimeType(url: string, responseMimeType: string): string {
  if (isSupportedMediaMimeType(responseMimeType)) return responseMimeType

  try {
    const pathname = new URL(url).pathname.toLowerCase()
    const extension = pathname.split('.').pop() || ''
    return MIME_BY_EXTENSION[extension] || responseMimeType
  } catch {
    return responseMimeType
  }
}

async function download(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await fetch(url, {
      headers: authHeadersFor(url),
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) {
      console.warn(`[MediaIngest] Download failed (${response.status}): ${url}`)
      return null
    }

    const responseMimeType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const mimeType = inferMimeType(url, responseMimeType)
    if (!isSupportedMediaMimeType(mimeType)) {
      console.log(`[MediaIngest] Skipping unsupported type: ${mimeType || 'unknown'}`)
      return null
    }

    const buffer = await response.arrayBuffer()
    const byteLimit = mimeType.startsWith('audio/') ? MAX_AUDIO_BYTES : MAX_INLINE_BYTES
    if (buffer.byteLength > byteLimit) {
      console.warn(`[MediaIngest] Too large (${Math.round(buffer.byteLength / 1e6)}MB): ${url}`)
      return null
    }

    return { data: Buffer.from(buffer).toString('base64'), mimeType }
  } catch (error) {
    console.warn('[MediaIngest] Download error:', error instanceof Error ? error.message : error)
    return null
  }
}

interface TranscriptionClient {
  audio: {
    transcriptions: {
      create(params: { file: Awaited<ReturnType<typeof toFile>>; model: string }): Promise<{ text?: string }>
    }
  }
}

function convertAudioToWav(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error('ffmpeg binary is unavailable'))
      return
    }

    const child = spawn(ffmpegPath, [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-t', String(MAX_TRANSCRIPTION_SECONDS),
      '-f', 'wav',
      'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] })

    const chunks: Buffer[] = []
    const errors: Buffer[] = []
    let outputBytes = 0
    let settled = false

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve(Buffer.concat(chunks))
    }

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish(new Error('audio conversion timed out'))
    }, TRANSCODING_TIMEOUT_MS)

    child.stdout.on('data', (chunk: Buffer) => {
      outputBytes += chunk.length
      if (outputBytes > MAX_AUDIO_BYTES) {
        child.kill('SIGKILL')
        finish(new Error('converted audio exceeds the transcription size limit'))
        return
      }
      chunks.push(chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      if (errors.reduce((total, item) => total + item.length, 0) < 8_000) errors.push(chunk)
    })
    child.on('error', error => finish(error))
    child.on('close', code => {
      if (code === 0 && chunks.length > 0) finish()
      else finish(new Error(Buffer.concat(errors).toString('utf8').trim() || `ffmpeg exited ${code}`))
    })
    child.stdin.on('error', () => undefined)
    child.stdin.end(input)
  })
}

/**
 * Transcribe a completed voice note. OpenAI accepts the common web formats
 * directly; Linq can also deliver CAF/AAC/AIFF/AMR, which are normalized to a
 * small mono WAV first.
 */
export async function transcribeAudioData(
  base64Data: string,
  mimeType: string,
  options: {
    client?: TranscriptionClient
    convert?: (input: Buffer) => Promise<Buffer>
  } = {}
): Promise<string | null> {
  try {
    let bytes: Buffer<ArrayBufferLike> = Buffer.from(base64Data, 'base64')
    if (bytes.byteLength > MAX_AUDIO_BYTES) {
      console.warn(`[MediaIngest] Audio too large (${Math.round(bytes.byteLength / 1e6)}MB)`)
      return null
    }

    const normalizedMimeType = mimeType.split(';')[0].trim().toLowerCase()
    let extension = DIRECT_TRANSCRIPTION_MIME_TYPES.get(normalizedMimeType)
    let uploadMimeType = normalizedMimeType

    if (!extension) {
      bytes = await (options.convert ?? convertAudioToWav)(bytes)
      extension = 'wav'
      uploadMimeType = 'audio/wav'
    }

    if (bytes.byteLength > MAX_AUDIO_BYTES) return null

    const apiKey = process.env.OPENAI_API_KEY?.trim()
    const client = options.client ?? (apiKey ? new OpenAI({ apiKey }) : null)
    if (!client) {
      console.error('[MediaIngest] OPENAI_API_KEY not configured for voice transcription')
      return null
    }

    const file = await toFile(bytes, `voice-note.${extension}`, { type: uploadMimeType })
    const result = await client.audio.transcriptions.create({
      file,
      model: 'gpt-transcribe',
    })
    const transcript = result.text?.trim()
    return transcript || null
  } catch (error) {
    console.error('[MediaIngest] Transcription failed:', error instanceof Error ? error.message : error)
    return null
  }
}

export function composeMultimodalInput(
  text: string | undefined,
  media: ProcessedMediaResult
): MultimodalInput {
  const authoredParts = [text?.trim(), ...media.transcripts.map(item => item.trim())].filter(Boolean) as string[]
  const effectiveMessage = authoredParts.join('\n')
  const contextParts: string[] = []

  if (media.visualSummaries.length > 0) {
    contextParts.push(`[They sent a photo or video: ${media.visualSummaries.join('; ')}]`)
  }
  if (media.failedCount > 0) {
    contextParts.push(`[${media.failedCount === 1 ? 'An attachment was' : `${media.failedCount} attachments were`} not understood. Ask them to resend if it matters.]`)
  }

  const fallback = contextParts[0] || '[They sent an attachment.]'
  const agentMessage = [effectiveMessage || fallback, ...contextParts]
    .filter((value, index, all) => index === 0 || value !== all[0])
    .join('\n')
  return {
    effectiveMessage,
    // Keep the visual description in short-term history. Onboarding can insert
    // a name/birth-data turn between the photo and the actual reading; dropping
    // this context made the reveal ignore the image that prompted it.
    historyMessage: agentMessage,
    agentMessage,
  }
}

/**
 * Analyze one photo or video by URL. Returns null when the media can't be
 * fetched or understood - callers treat that as "nothing learned", never as
 * an error.
 */
export async function analyzeMedia(
  url: string,
  messageContext?: string
): Promise<MediaAnalysis | null> {
  const media = await download(url)
  if (!media) return null
  return analyzeMediaData(media.data, media.mimeType, messageContext)
}

/**
 * Same analysis for media we already hold in memory - direct uploads from the
 * test console, or anything not addressable by URL.
 */
export async function analyzeMediaData(
  base64Data: string,
  mimeType: string,
  messageContext?: string
): Promise<MediaAnalysis | null> {
  const media = { data: base64Data, mimeType }

  if (mimeType.startsWith('audio/')) {
    const transcript = await transcribeAudioData(base64Data, mimeType)
    if (!transcript) return null
    return {
      scene: 'audio',
      description: 'A voice note.',
      transcript,
      places: [],
      garments: [],
    }
  }

  const rawKey = process.env.GOOGLE_AI_API_KEY
  const apiKey = rawKey?.trim().replace(/^['"]|['"]$/g, '') || ''
  if (!apiKey) {
    console.error('[MediaIngest] GOOGLE_AI_API_KEY not configured')
    return null
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: analysisSchema,
      temperature: 0.2,
    },
  })

  const isVideo = media.mimeType.startsWith('video/')

  const prompt = `Analyze this ${isVideo ? 'video' : 'image'} someone sent to their personal assistant.
${messageContext ? `They said: "${messageContext}"` : 'They sent it with no caption.'}

Classify the scene, then extract only what is actually visible:
- outfit: list each garment - item, category, color, pattern, and how it reads
- food or place: list any named venue. Read signage, menus, and receipts.
- screenshot: transcribe the text; these are usually saved recommendations
- person: describe concrete visible styling, pose, expression, and setting that answer the caption. Do not identify them, judge attractiveness, or return only "a person."
- ${isVideo ? 'For video, cover the whole clip, not just the first frame.' : ''}

Rules:
- Never name a venue you cannot actually see evidence for. Guessing a restaurant from decor alone is wrong.
- Never guess a city unless it is legible somewhere.
- If it is a person with no notable outfit, or nothing useful, say so and return empty lists.`

  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: media.data, mimeType: media.mimeType } },
          { text: prompt },
        ],
      }],
    })

    const text = result.response.text()
    if (!text?.trim()) return null

    const parsed = JSON.parse(text)

    const analysis: MediaAnalysis = {
      scene: parsed.scene || 'other',
      description: parsed.description || '',
      detectedText: parsed.detected_text?.trim() || undefined,
      places: (parsed.places || [])
        .filter((p: any) => p?.name?.trim())
        .map((p: any) => ({
          name: p.name.trim(),
          category: p.category?.trim() || undefined,
          city: p.city?.trim() || undefined,
          note: p.note?.trim() || undefined,
          tags: Array.isArray(p.tags) ? p.tags.filter(Boolean) : undefined,
        })),
      garments: (parsed.garments || [])
        .filter((g: any) => g?.item?.trim())
        .map((g: any) => ({
          item: g.item.trim(),
          category: g.category?.trim() || undefined,
          color: g.color?.trim() || undefined,
          pattern: g.pattern?.trim() || undefined,
          vibe: g.vibe?.trim() || undefined,
        })),
    }

    console.log(
      `[MediaIngest] ${isVideo ? 'video' : 'image'} -> ${analysis.scene}, ` +
      `${analysis.places.length} place(s), ${analysis.garments.length} garment(s)`
    )
    return analysis
  } catch (error) {
    console.error('[MediaIngest] Analysis failed:', error instanceof Error ? error.message : error)
    return null
  }
}
