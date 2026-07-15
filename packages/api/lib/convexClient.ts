import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || ''

if (!convexUrl) {
  console.error('WARNING: Missing NEXT_PUBLIC_CONVEX_URL environment variable')
}

export const convex: ConvexHttpClient | null = convexUrl
  ? new ConvexHttpClient(convexUrl)
  : null

// anyApi lets server code reference convex functions without generated types
// (the api package deploys via vercel CLI, not convex codegen in CI)
export const api = anyApi
