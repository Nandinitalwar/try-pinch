// Convert captured examples into a fine-tuning dataset.
//
// Usage:
//   npx tsx scripts/export-training.ts <input.jsonl> [--format gemini|openai] [--all]
//
// By default only clean-first-try responses are exported, since those show the
// target voice with no correction involved. --all includes rewritten ones too.

import fs from 'fs'
import { TrainingExample } from '../lib/trainingData'
import { checkVoice, matchCasing } from '../lib/voiceCheck'

const [, , inputPath, ...flags] = process.argv

if (!inputPath) {
  console.error('Usage: npx tsx scripts/export-training.ts <input.jsonl> [--format gemini|openai] [--all]')
  process.exit(1)
}

const format = flags.includes('--format')
  ? flags[flags.indexOf('--format') + 1]
  : 'gemini'
const includeRewritten = flags.includes('--all')

const minimalPrompt = flags.includes('--minimal-prompt')

// Everything from this heading down is static voice instruction, identical in
// every example. Everything above it is per-user context: date, their chart,
// memories, saved places, today's transits.
//
// Training WITH the full prompt teaches the model to obey a prompt it already
// obeys, and buys nothing. Training with only the context teaches it the voice
// directly, so production can drop ~8k characters from every request. That is
// the actual point of tuning here.
const STATIC_SECTION_MARKER = '## CHART INTEGRITY'

function trimPrompt(prompt: string): string {
  if (!minimalPrompt) return prompt
  const idx = prompt.indexOf(STATIC_SECTION_MARKER)
  const context = idx === -1 ? prompt : prompt.slice(0, idx).trimEnd()
  return `${context}\n\nYou are Pinch, an astrologer texting a friend. Reply as yourself.`
}

const lines = fs.readFileSync(inputPath, 'utf8').split('\n').filter(Boolean)
// Casing mirroring is a deterministic transform, so apply it at export too.
// Examples captured before that fix landed carry the model's random casing,
// and re-deriving it here means the whole corpus is consistent rather than
// only the turns collected after a particular moment.
const examples: TrainingExample[] = lines
  .map(l => JSON.parse(l))
  .map((e: TrainingExample) => ({
    ...e,
    systemPrompt: trimPrompt(e.systemPrompt),
    chosen: matchCasing(e.chosen, e.userMessage),
  }))

// What matters for training is whether the response that SHIPPED is clean, not
// whether the first draft was. A turn that needed a rewrite and ended clean is
// a perfectly good example of the target voice, and excluding those was
// discarding roughly half the corpus for no reason.
// Error fallbacks got recorded before the capture learned to skip them. An
// apology is not an example of the voice and training on it teaches the model
// to apologise.
const FAILURE_RESPONSES = /trouble processing that|having trouble right now|something went wrong/i
const failures = examples.filter(e => FAILURE_RESPONSES.test(e.chosen))
if (failures.length > 0) {
  console.error(`dropping ${failures.length} error fallback(s) recorded as examples`)
}

const usable = examples.filter(e => !FAILURE_RESPONSES.test(e.chosen))
const shippedClean = usable.filter(e => checkVoice(e.chosen).length === 0)
const shippedDirty = usable.filter(e => checkVoice(e.chosen).length > 0)
const cleanFirstTry = usable.filter(e => e.violations.length === 0)
const selected = includeRewritten ? usable : shippedClean

console.error(`Read ${examples.length} examples`)
console.error(`  shipped clean:      ${shippedClean.length}  <- exported`)
console.error(`  shipped w/ issues:  ${shippedDirty.length}  <- dropped, rewrite never fully landed`)
console.error(`  (clean first try:   ${cleanFirstTry.length})`)
console.error(`Exporting ${selected.length} as ${format}`)

const neededRewrite = examples.filter(e => e.violations.length > 0)
if (neededRewrite.length > 0) {
  const counts = new Map<string, number>()
  for (const e of neededRewrite) {
    for (const v of e.violations) {
      const kind = v.split(':')[0]
      counts.set(kind, (counts.get(kind) || 0) + 1)
    }
  }
  console.error('\nMost common violations, worth knowing before you train:')
  for (const [kind, n] of Array.from(counts.entries()).sort((a, b) => b[1] - a[1])) {
    console.error(`  ${kind}: ${n}`)
  }
  console.error('')
}

for (const example of selected) {
  if (format === 'chatml' || format === 'sharegpt') {
    // Format for open-weights SFT (axolotl, TRL, LLaMA-Factory all read this).
    console.log(JSON.stringify({
      messages: [
        { role: 'system', content: example.systemPrompt },
        { role: 'user', content: example.userMessage },
        { role: 'assistant', content: example.chosen },
      ],
    }))
  } else if (format === 'dpo') {
    // Preference pairs. Only rewritten turns have a rejected side, so this
    // format silently drops clean-first-try examples.
    if (!example.rejected) continue
    console.log(JSON.stringify({
      system: example.systemPrompt,
      prompt: example.userMessage,
      chosen: example.chosen,
      rejected: example.rejected,
    }))
  } else if (format === 'openai') {
    console.log(JSON.stringify({
      messages: [
        { role: 'system', content: example.systemPrompt },
        { role: 'user', content: example.userMessage },
        { role: 'assistant', content: example.chosen },
      ],
    }))
  } else {
    console.log(JSON.stringify({
      systemInstruction: { role: 'system', parts: [{ text: example.systemPrompt }] },
      contents: [
        { role: 'user', parts: [{ text: example.userMessage }] },
        { role: 'model', parts: [{ text: example.chosen }] },
      ],
    }))
  }
}
