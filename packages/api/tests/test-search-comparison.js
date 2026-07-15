// Compare Exa vs Parallel search API responses for astrological queries
// Tests both normal astrology queries and edge cases with new/unusual numbers
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

const EXA_API_KEY = process.env.EXA_API_KEY
const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY

if (!EXA_API_KEY) console.error('Missing EXA_API_KEY')
if (!PARALLEL_API_KEY) console.error('Missing PARALLEL_API_KEY')

// --- Test Queries ---

const ASTRO_QUERIES = [
  // Standard horoscope queries
  'Scorpio daily horoscope March 6 2026',
  'Aries horoscope today March 2026',
  // Transit-specific queries
  'Saturn Neptune conjunction Aries 2026 effects',
  'Mercury retrograde March 2026 dates',
  // Niche / long-tail astrology
  'Venus in Pisces transit March 2026 love forecast',
  'full moon Virgo March 2026 astrology meaning',
]

const EDGE_CASE_QUERIES = [
  // New/unusual phone numbers or numeric edge cases
  'astrology reading for someone born 02/29/2000',        // leap year birthday
  'horoscope born 13/01/1990',                             // ambiguous date format
  'astrology forecast born at 00:00 midnight exact',       // midnight birth time
  'zodiac sign December 21 cusp Sagittarius Capricorn',    // cusp date
  'Chinese zodiac 2026 year of the Horse predictions',     // non-western astrology
  'vedic astrology Jyotish March 2026 predictions',        // vedic astrology
  'numerology life path number 33 master number meaning',  // numerology (adjacent)
  'retrograde planets March 2026 how many',                // factual astro query
]

async function searchExa(query) {
  const isEventQuery = /horoscope|daily astrology|forecast|transit|retrograde/i.test(query)
  
  const searchBody = {
    query,
    numResults: 5,
    type: 'auto',
    contents: {
      text: { maxCharacters: 800, includeHtmlTags: false },
      highlights: { numSentences: 2, highlightsPerUrl: 1 }
    }
  }

  if (isEventQuery) {
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    searchBody.startPublishedDate = twoWeeksAgo.toISOString()
    searchBody.category = 'news'
  }

  const start = Date.now()
  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'x-api-key': EXA_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody)
    })
    const data = await response.json()
    const latency = Date.now() - start

    if (data.error) return { provider: 'Exa', query, error: data.error, latency }

    return {
      provider: 'Exa',
      query,
      latency,
      resultCount: data.results?.length || 0,
      results: (data.results || []).slice(0, 3).map(r => ({
        title: r.title,
        url: r.url,
        snippet: (r.text || '').substring(0, 200),
        highlights: r.highlights?.slice(0, 1),
        publishedDate: r.publishedDate
      }))
    }
  } catch (err) {
    return { provider: 'Exa', query, error: err.message, latency: Date.now() - start }
  }
}

async function searchParallel(query) {
  const start = Date.now()
  try {
    const response = await fetch('https://api.parallel.ai/v1beta/search', {
      method: 'POST',
      headers: {
        'x-api-key': PARALLEL_API_KEY,
        'Content-Type': 'application/json',
        'parallel-beta': 'search-extract-2025-10-10'
      },
      body: JSON.stringify({
        objective: query,
        search_queries: [query],
        mode: 'fast',
        max_results: 5,
        excerpts: { max_chars_per_result: 800 }
      })
    })
    const data = await response.json()
    const latency = Date.now() - start

    if (data.error) return { provider: 'Parallel', query, error: data.error, latency }

    return {
      provider: 'Parallel',
      query,
      latency,
      resultCount: data.results?.length || 0,
      results: (data.results || []).slice(0, 3).map(r => ({
        title: r.title,
        url: r.url,
        snippet: (r.excerpts?.[0] || '').substring(0, 200),
        publishedDate: r.publish_date
      })),
      usage: data.usage
    }
  } catch (err) {
    return { provider: 'Parallel', query, error: err.message, latency: Date.now() - start }
  }
}

function printResult(result) {
  const status = result.error ? `ERROR: ${result.error}` : `${result.resultCount} results`
  console.log(`  [${result.provider}] ${result.latency}ms | ${status}`)
  if (result.results) {
    result.results.forEach((r, i) => {
      console.log(`    ${i + 1}. ${r.title}`)
      console.log(`       ${r.url}`)
      if (r.snippet) console.log(`       "${r.snippet.substring(0, 120)}..."`)
    })
  }
  if (result.usage) console.log(`    Usage: ${JSON.stringify(result.usage)}`)
}

function scoreSummary(exaResult, parallelResult) {
  const scores = { exa: 0, parallel: 0 }

  // Result count
  if ((exaResult.resultCount || 0) > (parallelResult.resultCount || 0)) scores.exa++
  else if ((parallelResult.resultCount || 0) > (exaResult.resultCount || 0)) scores.parallel++

  // Latency (lower is better)
  if (!exaResult.error && !parallelResult.error) {
    if (exaResult.latency < parallelResult.latency) scores.exa++
    else if (parallelResult.latency < exaResult.latency) scores.parallel++
  }

  // Errors
  if (exaResult.error && !parallelResult.error) scores.parallel++
  if (parallelResult.error && !exaResult.error) scores.exa++

  return scores
}

async function runComparison(queries, label) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`  ${label}`)
  console.log(`${'='.repeat(70)}`)

  const totals = { exa: 0, parallel: 0 }
  const latencies = { exa: [], parallel: [] }

  for (const query of queries) {
    console.log(`\n--- Query: "${query}" ---`)

    const [exaResult, parallelResult] = await Promise.all([
      searchExa(query),
      searchParallel(query)
    ])

    printResult(exaResult)
    printResult(parallelResult)

    if (!exaResult.error) latencies.exa.push(exaResult.latency)
    if (!parallelResult.error) latencies.parallel.push(parallelResult.latency)

    const scores = scoreSummary(exaResult, parallelResult)
    totals.exa += scores.exa
    totals.parallel += scores.parallel

    // Rate limit cushion
    await new Promise(r => setTimeout(r, 500))
  }

  const avgExa = latencies.exa.length ? Math.round(latencies.exa.reduce((a, b) => a + b, 0) / latencies.exa.length) : 'N/A'
  const avgParallel = latencies.parallel.length ? Math.round(latencies.parallel.reduce((a, b) => a + b, 0) / latencies.parallel.length) : 'N/A'

  console.log(`\n--- ${label} Summary ---`)
  console.log(`  Exa score: ${totals.exa} | Avg latency: ${avgExa}ms`)
  console.log(`  Parallel score: ${totals.parallel} | Avg latency: ${avgParallel}ms`)

  return { totals, latencies: { exa: avgExa, parallel: avgParallel } }
}

async function main() {
  console.log('Exa vs Parallel Search API Comparison for Trypinch (Astrology)')
  console.log(`Date: ${new Date().toISOString()}\n`)

  const astroResults = await runComparison(ASTRO_QUERIES, 'ASTROLOGICAL QUERIES')
  const edgeResults = await runComparison(EDGE_CASE_QUERIES, 'EDGE CASES (new numbers, unusual inputs)')

  console.log(`\n${'='.repeat(70)}`)
  console.log('  FINAL SUMMARY')
  console.log(`${'='.repeat(70)}`)
  console.log(`  Astro queries  -> Exa: ${astroResults.totals.exa} | Parallel: ${astroResults.totals.parallel}`)
  console.log(`  Edge cases     -> Exa: ${edgeResults.totals.exa} | Parallel: ${edgeResults.totals.parallel}`)
  console.log(`  Total          -> Exa: ${astroResults.totals.exa + edgeResults.totals.exa} | Parallel: ${astroResults.totals.parallel + edgeResults.totals.parallel}`)
  console.log(`  Avg latency    -> Exa: ${astroResults.latencies.exa}ms / ${edgeResults.latencies.exa}ms | Parallel: ${astroResults.latencies.parallel}ms / ${edgeResults.latencies.parallel}ms`)
}

main().catch(console.error)
