import crypto from 'node:crypto'
import type { UserProfile } from './userProfile'
import { isPersonalHoroscopeRequest } from './horoscopeIntent'

const DEFAULT_TOKEN_TTL_MS = 15 * 60 * 1000

interface ChartTokenClaims {
  version: 1
  subject: string
  expiresAt: number
}

interface TokenOptions {
  nowMs?: number
  ttlMs?: number
  secret?: string
}

type ChartProfile = Pick<UserProfile, 'preferred_name' | 'chart_json' | 'chart_introduced_at'> | null | undefined

export type ChartDeliveryReason = 'new-chart' | 'requested-chart' | 'first-horoscope' | 'completed-onboarding'

const EXPLICIT_CHART_REQUEST =
  /\b(?:birth|natal)\s+chart\b|\bchart\s+(?:wheel|image|picture)\b|\b(?:show|see|send|make|generate|view|open)\s+(?:me\s+)?(?:my\s+)?(?:birth\s+|natal\s+)?chart\b/i

function chartSigningSecret(explicit?: string): string {
  const secret = explicit || process.env.CHART_URL_SIGNING_SECRET || process.env.LINQ_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('CHART_URL_SIGNING_SECRET or LINQ_WEBHOOK_SECRET is required')
  }
  return secret
}

export function createChartDeliveryToken(subject: string, options: TokenOptions = {}): string {
  if (!subject || subject.length > 160) throw new Error('Invalid chart token subject')

  const nowMs = options.nowMs ?? Date.now()
  const ttlMs = options.ttlMs ?? DEFAULT_TOKEN_TTL_MS
  const claims: ChartTokenClaims = {
    version: 1,
    subject,
    expiresAt: Math.floor((nowMs + ttlMs) / 1000),
  }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', chartSigningSecret(options.secret))
    .update(payload)
    .digest('base64url')

  return `${payload}.${signature}`
}

export function verifyChartDeliveryToken(
  token: string,
  options: Pick<TokenOptions, 'nowMs' | 'secret'> = {},
): ChartTokenClaims | null {
  try {
    const [payload, providedSignature, extra] = token.split('.')
    if (!payload || !providedSignature || extra) return null

    const expectedSignature = crypto
      .createHmac('sha256', chartSigningSecret(options.secret))
      .update(payload)
      .digest()
    const provided = Buffer.from(providedSignature, 'base64url')
    if (
      provided.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(provided, expectedSignature)
    ) {
      return null
    }

    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as ChartTokenClaims
    const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000)
    if (
      claims.version !== 1 ||
      typeof claims.subject !== 'string' ||
      !claims.subject ||
      claims.subject.length > 160 ||
      !Number.isInteger(claims.expiresAt) ||
      claims.expiresAt <= nowSeconds
    ) {
      return null
    }

    return claims
  } catch {
    return null
  }
}

export function getChartDeliveryReason(
  before: ChartProfile,
  after: ChartProfile,
  message: string,
): ChartDeliveryReason | null {
  // Compute-and-hold is allowed, but an unnamed personal chart is never
  // attached. Learning their name completes the pending reveal.
  if (!after?.chart_json || !after.preferred_name) return null
  if (after.chart_json !== before?.chart_json) return 'new-chart'
  if (!before?.preferred_name && !after.chart_introduced_at) return 'completed-onboarding'
  if (EXPLICIT_CHART_REQUEST.test(message)) return 'requested-chart'
  if (!after.chart_introduced_at && isPersonalHoroscopeRequest(message)) {
    return 'first-horoscope'
  }
  return null
}

export function createChartDeliveryUrl(
  requestOrigin: string,
  subject: string,
  options: TokenOptions = {},
): string {
  const configuredOrigin = process.env.PINCH_PUBLIC_BASE_URL?.trim()
  const origin = configuredOrigin || requestOrigin
  const url = new URL('/api/chart/imessage', origin)
  url.searchParams.set('token', createChartDeliveryToken(subject, options))
  return url.toString()
}
