// Exercises the link -> vault pipeline without needing a webhook delivery.
// Usage: npx tsx scripts/test-vault.ts [url]
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { extractLinks, extractIngestableLinks } from '../lib/linkExtractor'
import { ingestLink, normalizePlaceName } from '../lib/contentIngest'

async function main() {
  console.log('=== link detection ===')
  const samples = [
    'omg look at this https://www.tiktok.com/@user/video/7311111111111111111 we have to go',
    'https://www.instagram.com/reel/Cabc123/ saving this for the trip',
    'check https://youtu.be/dQw4w9WgXcQ',
    'https://maps.app.goo.gl/abc123',
    'just a normal text with no links',
    'read this https://nytimes.com/article (not ingestable)',
  ]

  for (const s of samples) {
    const all = extractLinks(s)
    const ingestable = extractIngestableLinks(s)
    console.log(`\n"${s.substring(0, 60)}${s.length > 60 ? '...' : ''}"`)
    console.log(`  all: ${all.map(l => l.platform).join(', ') || '(none)'}`)
    console.log(`  ingestable: ${ingestable.map(l => l.platform).join(', ') || '(none)'}`)
  }

  console.log('\n=== name normalization ===')
  for (const n of ["Haring's", 'HARINGS', 'Port of Call!', 'The Oyster Club']) {
    console.log(`  "${n}" -> "${normalizePlaceName(n)}"`)
  }

  const url = process.argv[2]
  if (!url) {
    console.log('\n(pass a real URL as an argument to test live extraction)')
    return
  }

  console.log(`\n=== live ingest: ${url} ===`)
  const links = extractIngestableLinks(url)
  if (links.length === 0) {
    console.log('Not an ingestable link.')
    return
  }

  const start = Date.now()
  const { places, metadata } = await ingestLink(links[0])
  console.log(`\nmetadata:`, metadata)
  console.log(`\nextracted ${places.length} place(s) in ${Date.now() - start}ms:`)
  for (const p of places) {
    console.log(`  - ${p.name}${p.category ? ` (${p.category})` : ''}${p.city ? ` [${p.city}]` : ''}`)
    if (p.note) console.log(`      ${p.note}`)
    if (p.tags?.length) console.log(`      tags: ${p.tags.join(', ')}`)
  }
}

main().catch(console.error)
