// Generates Pinch's own delineation table.
//
// A delineation is what a given transit MEANS for a person: not the geometry,
// which the ephemeris already gives us, but the lived read. Right now that
// comes from the model improvising per message, which is why the same aspect
// produces different advice on different runs.
//
// The public domain corpus can't supply this (it's method books and Victorian
// doom, measured, not guessed) and the good modern reference is copyrighted.
// So we write our own, once, under Pinch's voice rules, and look it up.
//
// Output is deliberately NOT prose to recite. Each entry is three short fields
// the agent turns into its own sentence: what it feels like, what to do, what
// to avoid. Prose would get read aloud; fields get used.
//
// Usage: npx tsx scripts/generate-delineations.ts [limit]

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { checkVoice } from '../lib/voiceCheck'

// Same weights the transit ranker uses, so the combinations generated first
// are the ones that actually surface in conversation.
const TRANSIT_WEIGHT: Record<string, number> = {
  Pluto: 10, Neptune: 9, Uranus: 9, Saturn: 8, Jupiter: 7, Mars: 5,
}
const NATAL_WEIGHT: Record<string, number> = {
  Sun: 10, Moon: 10, Ascendant: 10, Venus: 7, Mars: 7, Mercury: 6,
}
const ASPECTS = ['conjunction', 'square', 'trine', 'opposition', 'sextile']

const NATAL_MEANING: Record<string, string> = {
  Sun: 'identity, confidence, what they want to be known for',
  Moon: 'emotions, comfort, what they need to feel safe',
  Ascendant: 'how they come across, first impressions, self-presentation',
  Venus: 'love, money, pleasure, what they find beautiful',
  Mars: 'drive, anger, sex, how they go after what they want',
  Mercury: 'how they think, talk, and make decisions',
}

const ASPECT_NATURE: Record<string, string> = {
  conjunction: 'fused and intensified, impossible to ignore',
  square: 'friction, pressure, something forcing a change',
  trine: 'easy flow, the door is open, low resistance',
  opposition: 'pulled two ways, or it shows up through other people',
  sextile: 'an opportunity that needs them to actually take it',
}

interface Delineation {
  transit: string
  aspect: string
  natal: string
  feels: string
  do: string
  avoid: string
}

const schema: any = {
  type: SchemaType.OBJECT,
  properties: {
    feels: { type: SchemaType.STRING, description: 'What the person is actually experiencing, in plain language, second person. One sentence.' },
    do: { type: SchemaType.STRING, description: 'The concrete thing to do about it. Actionable within days. One sentence.' },
    avoid: { type: SchemaType.STRING, description: 'The specific trap people fall into under this transit. One sentence.' },
  },
  required: ['feels', 'do', 'avoid'],
}

const VOICE_RULES = `You are writing internal reference notes for an astrologer named Pinch.

These notes are NEVER shown to a user. They are what Pinch reads privately before
answering, so they must be blunt and usable, not pretty.

THE ONE THING THAT MATTERS: be concrete about BEHAVIOUR. Describe what a person
actually catches themselves doing. Abstractions about identity, growth, truth or
transformation are worthless, because every transit sounds identical once you
write it that way.

BAD (abstract, could be any transit):
  feels: "You feel an intense pressure to fundamentally change who you are."
  do:    "Align your daily actions with your deepest personal truths."
  avoid: "Do not cling to what no longer serves you."

GOOD (behavioural, could only be this transit):
  feels: "You keep catching yourself rehearsing an argument with someone who
          has not actually said anything yet."
  do:    "Say the thing out loud to them this week, badly, before you have
          polished it into a speech."
  avoid: "Rewriting the message a sixth time and then not sending it."

HARD RULES:
- No astrology vocabulary: no "malefic", "afflicted", "native", "energies",
  "the universe", "cosmic", "divine", "manifest", "transformation".
- No therapy-speak: no "lean into", "hold space", "sit with", "honour your needs",
  "give yourself permission", "trust the process", "be present", "serves you",
  "no longer serves you", "personal truth", "authentic self", "step into your power".
- Never fatalistic. No illness, death, disaster. Hard transits are pressure with an
  end date, never punishment.
- No em-dashes or en-dashes. Ever.
- Second person, present tense.
- The "do" must be a specific action a real person could take this week. Not
  "reflect on", not "identify", not "consciously decide". A thing you DO.
- The "avoid" is the specific trap, described as a behaviour someone would
  recognise themselves in.

DIFFERENTIATE THE ASPECTS. The square and the trine of the same two planets must
read as genuinely different situations, not the same sentence with the mood
adjusted. If your note would work equally well for a different aspect, it is wrong.`

async function main() {
  const limit = parseInt(process.argv[2] || '60', 10)

  // Rank the full space, generate the most consequential combinations first.
  const combos: Array<{ transit: string; aspect: string; natal: string; weight: number }> = []
  for (const [transit, tw] of Object.entries(TRANSIT_WEIGHT)) {
    for (const [natal, nw] of Object.entries(NATAL_WEIGHT)) {
      for (const aspect of ASPECTS) {
        combos.push({ transit, aspect, natal, weight: tw * nw })
      }
    }
  }
  combos.sort((a, b) => b.weight - a.weight)
  const selected = combos.slice(0, limit)

  console.log(`Generating ${selected.length} of ${combos.length} possible delineations\n`)

  const apiKey = process.env.GOOGLE_AI_API_KEY?.trim().replace(/^['"]|['"]$/g, '') || ''
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured')

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0.8,
    },
  })

  const out: Delineation[] = []
  let lastViolations: string[] = []

  for (let i = 0; i < selected.length; i++) {
    const c = selected[i]
    const prompt = `${VOICE_RULES}

Write the note for: transiting ${c.transit} ${c.aspect} natal ${c.natal}.

${c.transit} is the slow pressure at work here.
Their natal ${c.natal} governs ${NATAL_MEANING[c.natal]}.
The ${c.aspect} means this arrives ${ASPECT_NATURE[c.aspect]}.

Give the three fields. Keep each to one sentence.`

    // Reuse the same checker the live agent uses. The generator drifts into
    // therapy-speak exactly like the agent does, and there is no reason to
    // trust it here when we do not trust it there.
    try {
      let parsed: any = null
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await model.generateContent(
          attempt === 0
            ? prompt
            : `${prompt}\n\nYour previous attempt used banned language: ${lastViolations.join(', ')}. Rewrite without it, and be more concrete about behaviour.`
        )
        const candidate = JSON.parse(res.response.text())
        const combined = `${candidate.feels} ${candidate.do} ${candidate.avoid}`
        const violations = checkVoice(combined)
          .filter(v => v.kind !== 'too_long' && v.kind !== 'preamble')
        if (violations.length === 0) {
          parsed = candidate
          break
        }
        lastViolations = violations.map(v => v.detail)
        parsed = candidate // keep the best-so-far in case all attempts fail
      }

      if (parsed) {
        out.push({ transit: c.transit, aspect: c.aspect, natal: c.natal, ...parsed })
      }
      if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${selected.length}`)
    } catch (error) {
      console.error(`  failed ${c.transit} ${c.aspect} ${c.natal}:`, error instanceof Error ? error.message : error)
    }
  }

  const target = path.resolve(__dirname, '../delineations.json')
  fs.writeFileSync(target, JSON.stringify(out, null, 2))
  console.log(`\nWrote ${out.length} delineations to ${target}`)
}

main().catch(console.error)
