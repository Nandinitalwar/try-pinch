// Comprehensive Exa vs Parallel search comparison for Trypinch
// Covers: daily horoscopes, transits, events, vedic, edge cases, adversarial
// Logs all results to Braintrust for observability
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

const EXA_API_KEY = process.env.EXA_API_KEY
const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY
const BRAINTRUST_API_KEY = process.env.BRAINTRUST_API_KEY

if (!EXA_API_KEY) console.error('Missing EXA_API_KEY')
if (!PARALLEL_API_KEY) console.error('Missing PARALLEL_API_KEY')

// ─── Query Categories ────────────────────────────────────────────────

const QUERIES = {
  daily_horoscope: [
    'Aries daily horoscope March 6 2026',
    'Taurus horoscope today March 6 2026',
    'Gemini daily horoscope March 6 2026',
    'Cancer horoscope today March 2026',
    'Leo daily horoscope March 6 2026',
    'Virgo horoscope today March 6 2026',
    'Libra daily horoscope March 6 2026',
    'Scorpio horoscope today March 6 2026',
    'Sagittarius daily horoscope March 6 2026',
    'Capricorn horoscope today March 6 2026',
    'Aquarius daily horoscope March 6 2026',
    'Pisces horoscope today March 6 2026',
  ],
  transits: [
    'Saturn Neptune conjunction Aries 2026 effects',
    'Mercury retrograde March 2026 dates',
    'Venus in Pisces transit March 2026 love forecast',
    'Mars square Moon effects astrology',
    'full moon Virgo March 2026 astrology meaning',
    'Jupiter direct in Cancer 2026 effects',
  ],
  event_astro_hybrid: [
    'San Francisco events tonight March 2026',
    'best restaurant for Taurus Moon comfort food',
    'things to do in NYC this weekend March 2026',
    'live music San Francisco March 6 2026',
  ],
  vedic_nonwestern: [
    'Jyotish March 2026 predictions vedic astrology',
    'Chinese zodiac Horse 2026 predictions',
    'vedic astrology Rahu Ketu transit 2026',
    'Mangal dosha effects marriage astrology',
  ],
  cusp_ambiguous: [
    'zodiac sign December 21 Sagittarius or Capricorn',
    'born February 29 leap year astrology chart',
    'zodiac sign June 21 cusp Gemini Cancer',
    'horoscope born 13/01/1990 date format',
  ],
  midnight_boundary: [
    'astrology born exactly midnight 00:00',
    'born at 11:59 PM zodiac day boundary',
    'birth time unknown astrology reading accuracy',
    'born during solar eclipse astrology meaning',
  ],
  retrograde_factual: [
    'how many planets retrograde March 2026',
    'Mercury retrograde dates 2026 complete list',
    'Saturn retrograde 2026 start date',
    'Venus retrograde 2026 when',
  ],
  adversarial: [
    'asdfjkl horoscope',
    'horoscope for zodiac sign Ophiuchus March 2026',
    'astrology prediction for year 3000',
    '',
  ],
}

// ─── Astro relevance keywords ────────────────────────────────────────

const ASTRO_KEYWORDS = [
  'horoscope', 'zodiac', 'astrology', 'aries', 'taurus', 'gemini', 'cancer',
  'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius',
  'pisces', 'transit', 'retrograde', 'conjunction', 'square', 'trine',
  'opposition', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'neptune',
  'pluto', 'moon', 'sun', 'rising', 'chart', 'natal', 'forecast', 'prediction',
  'jyotish', 'vedic', 'rahu', 'ketu', 'mangal',
]

// ─── Scoring Functions ───────────────────────────────────────────────

function computeRelevanceScore(results) {
  if (!results || results.length === 0) return 0
  let score = 0
  const topResults = results.slice(0, 3)
  for (const r of topResults) {
    const text = `${r.title || ''} ${r.snippet || ''}`.toLowerCase()
    const matches = ASTRO_KEYWORDS.filter(kw => text.includes(kw))
    score += Math.min(matches.length / 3, 1) // normalize per result
  }
  return Math.round((score / topResults.length) * 100) / 100
}

function computeFreshnessScore(results, isDailyQuery) {
  if (!isDailyQuery || !results || results.length === 0) return null
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  let fresh = 0
  for (const r of results.slice(0, 3)) {
    if (r.publishedDate) {
      const pubDate = new Date(r.publishedDate)
      if (pubDate >= sevenDaysAgo) fresh++
    }
  }
  return Math.round((fresh / Math.min(results.length, 3)) * 100) / 100
}

function computeContentDensity(results) {
  if (!results || results.length === 0) return 0
  let totalChars = 0
  for (const r of results.slice(0, 3)) {
    const snippet = (r.snippet || '').replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
    totalChars += snippet.length
  }
  return Math.round(totalChars / Math.min(results.length, 3))
}

// ─── API Calls ───────────────────────────────────────────────────────

async function searchExa(query) {
  if (!query) return { provider: 'Exa', query, error: 'empty query', latency: 0, resultCount: 0, results: [] }
  const isEventQuery = /horoscope|daily|forecast|transit|retrograde|event|tonight|weekend/i.test(query)
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
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'x-api-key': EXA_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody)
    })
    const data = await res.json()
    const latency = Date.now() - start
    if (data.error) return { provider: 'Exa', query, error: data.error, latency, resultCount: 0, results: [] }
    return {
      provider: 'Exa', query, latency,
      resultCount: data.results?.length || 0,
      results: (data.results || []).slice(0, 5).map(r => ({
        title: r.title, url: r.url,
        snippet: (r.text || '').substring(0, 300),
        highlights: r.highlights?.slice(0, 1),
        publishedDate: r.publishedDate
      }))
    }
  } catch (err) {
    return { provider: 'Exa', query, error: err.message, latency: Date.now() - start, resultCount: 0, results: [] }
  }
}

async function searchParallel(query) {
  if (!query) return { provider: 'Parallel', query, error: 'empty query', latency: 0, resultCount: 0, results: [] }
  const start = Date.now()
  try {
    const res = await fetch('https://api.parallel.ai/v1beta/search', {
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
    const data = await res.json()
    const latency = Date.now() - start
    if (data.error) return { provider: 'Parallel', query, error: JSON.stringify(data.error), latency, resultCount: 0, results: [] }
    return {
      provider: 'Parallel', query, latency,
      resultCount: data.results?.length || 0,
      results: (data.results || []).slice(0, 5).map(r => ({
        title: r.title, url: r.url,
        snippet: (r.excerpts?.[0] || '').substring(0, 300),
        publishedDate: r.publish_date
      })),
      usage: data.usage
    }
  } catch (err) {
    return { provider: 'Parallel', query, error: err.message, latency: Date.now() - start, resultCount: 0, results: [] }
  }
}

// ─── Braintrust Logging ──────────────────────────────────────────────

let braintrustLogger = null

async function initBraintrust() {
  if (!BRAINTRUST_API_KEY) {
    console.log('[Braintrust] No API key — skipping logging')
    return
  }
  try {
    const bt = require('braintrust')
    braintrustLogger = bt.initLogger({
      projectName: 'pinch-sms-astrologer',
      apiKey: BRAINTRUST_API_KEY,
    })
    console.log('[Braintrust] Logger initialized')
  } catch (err) {
    console.error('[Braintrust] Init failed:', err.message)
  }
}

function logToBraintrust(category, query, exaResult, parallelResult, scores) {
  if (!braintrustLogger) return
  try {
    const span = braintrustLogger.startSpan({
      name: 'search_comparison',
      spanAttributes: { type: 'tool' },
      event: {
        input: { category, query },
        output: {
          exa: { latency: exaResult.latency, resultCount: exaResult.resultCount, error: exaResult.error },
          parallel: { latency: parallelResult.latency, resultCount: parallelResult.resultCount, error: parallelResult.error },
        },
        metadata: {
          category,
          scores,
          exa_top_result: exaResult.results?.[0]?.title || null,
          parallel_top_result: parallelResult.results?.[0]?.title || null,
        },
        tags: ['search-comparison', category],
      },
    })
    span.end()
  } catch (err) {
    // silent
  }
}

async function flushBraintrust() {
  if (!braintrustLogger) return
  try { await braintrustLogger.flush() } catch {}
}

// ─── Runner ──────────────────────────────────────────────────────────

function printCompact(result) {
  const status = result.error ? `ERR: ${result.error}` : `${result.resultCount} results`
  console.log(`  [${result.provider}] ${result.latency}ms | ${status}`)
  if (result.results?.length > 0) {
    console.log(`    Top: ${result.results[0].title}`)
  }
}

async function runCategory(category, queries) {
  console.log(`\n── ${category.toUpperCase()} (${ queries.length} queries) ──`)
  const isDailyCategory = category === 'daily_horoscope'
  const categoryScores = { exa: 0, parallel: 0 }
  const categoryLatencies = { exa: [], parallel: [] }
  const allScores = []

  for (const query of queries) {
    if (!query) {
      console.log(`\n  Query: (empty string)`)
      const exaR = await searchExa(query)
      const parR = await searchParallel(query)
      printCompact(exaR)
      printCompact(parR)
      continue
    }

    console.log(`\n  Query: "${query.substring(0, 60)}${query.length > 60 ? '...' : ''}"`)
    const [exaR, parR] = await Promise.all([searchExa(query), searchParallel(query)])
    printCompact(exaR)
    printCompact(parR)

    // Score
    const scores = {
      exa: {
        relevance: computeRelevanceScore(exaR.results),
        freshness: computeFreshnessScore(exaR.results, isDailyCategory),
        contentDensity: computeContentDensity(exaR.results),
        latency: exaR.latency,
        resultCount: exaR.resultCount,
        hasError: !!exaR.error,
      },
      parallel: {
        relevance: computeRelevanceScore(parR.results),
        freshness: computeFreshnessScore(parR.results, isDailyCategory),
        contentDensity: computeContentDensity(parR.results),
        latency: parR.latency,
        resultCount: parR.resultCount,
        hasError: !!parR.error,
      }
    }

    // Aggregate winner per query (relevance weighted heaviest)
    let exaPts = 0, parPts = 0
    if (scores.exa.relevance > scores.parallel.relevance) exaPts += 2
    else if (scores.parallel.relevance > scores.exa.relevance) parPts += 2
    if (scores.exa.resultCount > scores.parallel.resultCount) exaPts++
    else if (scores.parallel.resultCount > scores.exa.resultCount) parPts++
    if (scores.exa.latency < scores.parallel.latency) exaPts++
    else if (scores.parallel.latency < scores.exa.latency) parPts++
    if (scores.exa.contentDensity > scores.parallel.contentDensity) exaPts++
    else if (scores.parallel.contentDensity > scores.exa.contentDensity) parPts++
    if (scores.exa.hasError && !scores.parallel.hasError) parPts += 2
    if (scores.parallel.hasError && !scores.exa.hasError) exaPts += 2

    categoryScores.exa += exaPts
    categoryScores.parallel += parPts
    if (!exaR.error) categoryLatencies.exa.push(exaR.latency)
    if (!parR.error) categoryLatencies.parallel.push(parR.latency)
    allScores.push(scores)

    logToBraintrust(category, query, exaR, parR, scores)

    await new Promise(r => setTimeout(r, 400))
  }

  const avgExa = categoryLatencies.exa.length ? Math.round(categoryLatencies.exa.reduce((a, b) => a + b, 0) / categoryLatencies.exa.length) : 'N/A'
  const avgPar = categoryLatencies.parallel.length ? Math.round(categoryLatencies.parallel.reduce((a, b) => a + b, 0) / categoryLatencies.parallel.length) : 'N/A'

  console.log(`\n  Summary: Exa ${categoryScores.exa} pts (avg ${avgExa}ms) | Parallel ${categoryScores.parallel} pts (avg ${avgPar}ms)`)
  return { category, scores: categoryScores, latencies: { exa: avgExa, parallel: avgPar }, details: allScores }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  Exa vs Parallel: Comprehensive Search Comparison (Trypinch)')
  console.log(`  ${new Date().toISOString()}`)
  console.log('═══════════════════════════════════════════════════════════════')

  await initBraintrust()

  const results = []
  for (const [category, queries] of Object.entries(QUERIES)) {
    const result = await runCategory(category, queries)
    results.push(result)
  }

  // Final summary
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  FINAL RESULTS')
  console.log('═══════════════════════════════════════════════════════════════')

  let totalExa = 0, totalPar = 0
  for (const r of results) {
    const winner = r.scores.exa > r.scores.parallel ? 'EXA' : r.scores.parallel > r.scores.exa ? 'PARALLEL' : 'TIE'
    console.log(`  ${r.category.padEnd(22)} Exa: ${String(r.scores.exa).padStart(3)} | Par: ${String(r.scores.parallel).padStart(3)} | Latency: ${String(r.latencies.exa).padStart(5)}ms / ${String(r.latencies.parallel).padStart(5)}ms | ${winner}`)
    totalExa += r.scores.exa
    totalPar += r.scores.parallel
  }

  const overallWinner = totalExa > totalPar ? 'EXA' : totalPar > totalExa ? 'PARALLEL' : 'TIE'
  console.log(`  ${'─'.repeat(55)}`)
  console.log(`  TOTAL                  Exa: ${String(totalExa).padStart(3)} | Par: ${String(totalPar).padStart(3)} | Winner: ${overallWinner}`)

  await flushBraintrust()
  console.log('\nDone. Check Braintrust dashboard for detailed logs.')
}

main().catch(console.error)
