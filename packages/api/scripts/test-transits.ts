// Sanity-check the transit engine against known sky positions.
// Usage: npx tsx scripts/test-transits.ts
import { computeCurrentPositions, computeNatalChart, computeTransits, formatTransitsForAgent } from '../lib/astrology'

const today = new Date()

console.log(`=== where the planets actually are (${today.toISOString().slice(0, 10)}) ===`)
for (const p of computeCurrentPositions(today)) {
  console.log(`  ${p.body.padEnd(9)} ${p.sign} ${p.degree.toFixed(1)}°${p.retrograde ? '  (retrograde)' : ''}`)
}

// The test user used throughout development.
const chart = computeNatalChart({
  birthDate: '1996-03-03',
  birthTime: '04:15:00',
  timezone: 'Asia/Kolkata',
  latitude: 28.61,
  longitude: 77.21,
  birthTimeKnown: true,
})

console.log('\n=== their natal chart ===')
for (const p of chart.placements) {
  console.log(`  ${p.body.padEnd(9)} ${p.sign} ${p.degree.toFixed(1)}°`)
}
if (chart.ascendant) console.log(`  Ascendant ${chart.ascendant.sign} ${chart.ascendant.degree.toFixed(1)}°`)

const transits = computeTransits(chart, today)

console.log(`\n=== ${transits.length} aspects in orb, top 8 by significance ===`)
for (const t of transits.slice(0, 8)) {
  console.log(
    `  [${String(t.weight).padStart(3)}] ${t.transitBody} ${t.aspect} natal ${t.natalBody} ` +
    `— orb ${t.orb}°, ${t.applying ? 'applying' : 'separating'}` +
    `${t.exactDate ? `, exact ${t.exactDate}` : ''}${t.endDate ? `, out of orb ${t.endDate}` : ''}`
  )
}

console.log('\n=== what the agent receives ===')
console.log(formatTransitsForAgent(transits))
