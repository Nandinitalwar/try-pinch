// Drives realistic conversations through the live pipeline to build a
// fine-tuning corpus.
//
// Two things matter for the dataset to be worth training on:
//
// 1. Varied charts. If every example comes from one birth chart, the tune
//    learns that chart's placements rather than the voice.
// 2. Varied message types. Greetings, venting, decisions, good news and small
//    talk all get different treatment, and a corpus of only "should I..."
//    questions would teach the model to give advice to everything, which is
//    the exact failure mode being designed out.
//
// Usage: npx tsx scripts/collect-training.ts [messagesPerPersona]
// Requires the dev server running with PINCH_TRAINING_LOG set.

const BASE = 'http://localhost:3000/api/chat'

// Spread across hemispheres, decades and timezones so charts genuinely differ.
const PERSONAS = [
  'born march 3 1996, 4:15am, new delhi',
  'born july 22 1991, 11:40pm, brooklyn new york',
  'born december 9 1988, 6:05am, london',
  'born may 17 2000, 2:30pm, sao paulo brazil',
  'born october 30 1985, 9:15am, tokyo',
  'born february 14 1993, 7:50pm, lagos nigeria',
  'born august 8 1997, 12:20am, melbourne australia',
  'born april 25 1990, 3:45pm, mexico city',
]

// Deliberately weighted toward things that are NOT advice requests.
const MESSAGES = [
  // greetings and small talk
  'hey', 'hi', 'yo', 'morning', 'you up?', 'hey whats up',
  'random but hi', 'ok im back', 'sup',

  // venting, wants agreement not a plan
  'ugh im so tired', 'today was awful', 'i hate my job',
  'my roommate is driving me insane', 'i cant do this anymore',
  'everyone is annoying me today', 'i feel so behind',
  'i had a fight with my mom', 'work is crushing me',
  'i think i messed up', 'im so burnt out', 'nothing is going right',

  // good news, wants enthusiasm
  'i got the job!!', 'i got promoted!!', 'i finally did it',
  'guess who has a date friday', 'i finished the thing',
  'my sister had her baby', 'i booked the trip',

  // real decisions
  'should i text my ex', 'should i quit my job', 'should i go out tonight',
  'should i take the offer', 'should i move cities', 'should i cut my hair',
  'should i go to the wedding', 'should i confront her',
  'should i rest or push through this week', 'should i apply',
  'i cant decide if i should stay or go',

  // everyday practical
  'what should i eat', 'what should i do tonight', 'what should i wear',
  'where should i go this weekend', 'give me something fun to do',
  'im bored', 'plans for tonight?',

  // astrology-adjacent
  'whats going on with me lately', 'anything i should know today',
  'hows my week looking', 'why do i feel so off', 'am i in a weird phase',
  'is this a bad time for me', 'whats coming up for me',

  // pushback and follow-ups, tests holding a line
  'are you sure', 'but i really want to', 'idk that feels wrong',
  'ok but what if i did anyway', 'you said that last time',

  // curveballs
  'do you think people can change', 'whats your favorite sign',
  'do you actually believe in this', 'tell me something true',
  'im scared', 'i miss him', 'do you think ill be ok',
]

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

async function send(sessionId: string, message: string): Promise<string> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data.response || ''
}

async function main() {
  const perPersona = parseInt(process.argv[2] || '25', 10)
  const total = PERSONAS.length * perPersona
  console.log(`Collecting ~${total} examples across ${PERSONAS.length} charts\n`)

  let done = 0
  let failed = 0

  for (let i = 0; i < PERSONAS.length; i++) {
    const birth = PERSONAS[i]
    const sessionId = `collect-${Date.now()}-${i}`
    try {
      await send(sessionId, birth)
    } catch (error) {
      console.error(`  persona ${i + 1} setup failed:`, error instanceof Error ? error.message : error)
      continue
    }
    // Let the profile write land before the next turn reads it.
    await new Promise(r => setTimeout(r, 1500))

    // Fresh order per persona so message N isn't always the same question,
    // which would bake conversation position into the corpus.
    for (const message of shuffle(MESSAGES).slice(0, perPersona)) {
      try {
        await send(sessionId, message)
        done++
      } catch (error) {
        failed++
      }
      if (done % 10 === 0 && done > 0) {
        console.log(`  ${done}/${total} collected${failed ? `, ${failed} failed` : ''}`)
      }
    }
    console.log(`persona ${i + 1}/${PERSONAS.length} done (${birth.slice(6, 30)}...)`)
  }

  console.log(`\nCollected ${done}, failed ${failed}`)
  console.log('Export with: npx tsx scripts/export-training.ts training-data.jsonl')
}

main().catch(console.error)
