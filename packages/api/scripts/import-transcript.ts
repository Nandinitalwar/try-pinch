// Turns a real human-astrologer consultation into training material.
//
// Two things come out of a transcript, and neither is the astrologer's prose:
//
// 1. THE QUESTIONS. What people actually ask an astrologer, in their own words.
//    The collector's message list was invented, so it reflects assumptions about
//    what users ask rather than evidence. Real questions replace guesses.
//
// 2. THE VAGUENESS, as preference data. Paid consultation astrologers are
//    optimised for volume and unfalsifiable claims, so their answers are a
//    clean example of the failure mode Pinch is defined against. As the
//    "rejected" side of a DPO pair against Pinch's answer to the same question,
//    that is worth more than anything synthesised.
//
// Input is a plain text file, one turn per line, prefixed "Q:" for the client
// and "A:" for the astrologer. Paste and tidy by hand; consultation UIs all
// export differently and a parser for each is not worth writing.
//
// Usage: npx tsx scripts/import-transcript.ts <transcript.txt> [--generate]

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

interface Turn { role: 'client' | 'astrologer'; text: string }

interface Pair {
  question: string
  astrologerAnswer: string
  /** Why this answer is weak, so the contrast is legible later. */
  weaknesses: string[]
}

// The moves that make consultation astrology feel useless. Each is something
// Pinch's rules explicitly forbid.
const WEAKNESS_TESTS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(good time|bad time|new opportunities|responsibilit(y|ies)) (will )?(come|start)/i, label: 'unfalsifiable forecast' },
  { re: /\bwill come to you\b/i, label: 'passive prediction, nothing to act on' },
  { re: /\b(madam|sir|ma'?am)\b/i, label: 'servile address' },
  { re: /\b(we can'?t tell|not possible to say|cannot say)\b/i, label: 'refuses to answer' },
  { re: /\b(if you are interested|if you want|you can utilise)\b/i, label: 'hands the decision back' },
  { re: /[\u0900-\u097F]|aap |kar sakte|hindi mein/i, label: 'unprompted code-switch' },
  { re: /\b(near|around) [a-z ]*(centre|center|area|place)\b/i, label: 'fake specificity, unverifiable' },
  { re: /\b\d+ years? \d+ month/i, label: 'recites data back instead of answering' },
]

function parse(raw: string): Turn[] {
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .filter(l => /^[QA]:/i.test(l))
    .map(l => ({
      role: /^Q:/i.test(l) ? 'client' as const : 'astrologer' as const,
      text: l.slice(2).trim(),
    }))
}

/**
 * Pair each client question with the astrologer's reply. Consecutive
 * astrologer turns are joined, because these chats arrive as bursts of short
 * messages that are really one answer.
 */
function pair(turns: Turn[]): Pair[] {
  const pairs: Pair[] = []
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].role !== 'client') continue
    const answer: string[] = []
    for (let j = i + 1; j < turns.length && turns[j].role === 'astrologer'; j++) {
      answer.push(turns[j].text)
    }
    if (answer.length === 0) continue
    const joined = answer.join(' ')
    pairs.push({
      question: turns[i].text,
      astrologerAnswer: joined,
      weaknesses: WEAKNESS_TESTS.filter(t => t.re.test(joined)).map(t => t.label),
    })
  }
  return pairs
}

async function main() {
  const input = process.argv[2]
  if (!input) {
    console.error('Usage: npx tsx scripts/import-transcript.ts <transcript.txt> [--generate]')
    process.exit(1)
  }

  const turns = parse(fs.readFileSync(input, 'utf8'))
  const pairs = pair(turns)

  console.log(`Parsed ${turns.length} turns into ${pairs.length} question/answer pairs\n`)

  const counts = new Map<string, number>()
  for (const p of pairs) {
    for (const w of p.weaknesses) counts.set(w, (counts.get(w) || 0) + 1)
  }

  console.log('What the astrologer did, by failure mode:')
  for (const [label, n] of Array.from(counts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n}x  ${label}`)
  }

  const clean = pairs.filter(p => p.weaknesses.length === 0)
  console.log(`\nanswers with no detected weakness: ${clean.length}/${pairs.length}`)

  // The question bank. This is the durable output: real phrasings to feed the
  // collector instead of invented ones.
  const questions = pairs.map(p => p.question)
  const qPath = path.resolve(__dirname, '../real-questions.json')
  const existing = fs.existsSync(qPath) ? JSON.parse(fs.readFileSync(qPath, 'utf8')) : []
  const merged = Array.from(new Set([...existing, ...questions]))
  fs.writeFileSync(qPath, JSON.stringify(merged, null, 2))
  console.log(`\nquestion bank: +${merged.length - existing.length} new, ${merged.length} total`)
  console.log(`  -> ${qPath}`)

  // Preference pairs, missing the chosen side until Pinch answers the same
  // questions. Kept separate so the two halves can be built independently.
  const prefPath = path.resolve(__dirname, '../preference-pairs.jsonl')
  const lines = pairs.map(p => JSON.stringify({
    prompt: p.question,
    rejected: p.astrologerAnswer,
    rejected_source: 'human consultation astrologer',
    rejected_weaknesses: p.weaknesses,
  }))
  fs.appendFileSync(prefPath, lines.join('\n') + '\n')
  console.log(`\npreference pairs (rejected side): +${lines.length}`)
  console.log(`  -> ${prefPath}`)
  console.log(`\nRun the question bank through the collector to fill in the chosen side.`)
}

main().catch(console.error)
