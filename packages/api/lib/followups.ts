// Spots things the user says are coming up, and schedules Pinch to ask how
// they went.
//
// This is the better use of memory. Weaving a remembered fact into an unrelated
// reply reads as a system showing off its context window; being asked "how was
// the date" the next morning reads as someone who was actually listening.
//
// Extraction runs after the reply, never in the response path.

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { convex, api } from './convexClient'
import { zonedTimeToUtc } from './astrology'

export interface DetectedEvent {
  subject: string       // "her date with Sam"
  askText: string       // "how'd the date go"
  eventAt: string       // ISO
  category: string      // date | interview | social | travel | medical | other
}

// How long to wait after the thing before asking. Tuned to when a person
// would actually have an answer: a date is over by the next morning, a trip
// isn't done for days, and asking about an interview an hour later is asking
// someone to relive their own anxiety.
const DELAY_HOURS: Record<string, number> = {
  date: 14,        // next morning
  social: 14,
  interview: 20,   // next day, once they've stopped replaying it
  medical: 4,
  travel: 24,
  other: 16,
}

const schema: any = {
  type: SchemaType.OBJECT,
  properties: {
    events: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          subject: { type: SchemaType.STRING, description: 'Short noun phrase, third person: "her date with Sam", "the Vellum interview"' },
          askText: { type: SchemaType.STRING, description: 'The actual text to send afterwards. Lowercase, casual, under 10 words. "how was the date" not "I hope your date went well!"' },
          eventAt: { type: SchemaType.STRING, description: 'ISO 8601 datetime of when the thing happens. Resolve relative dates against the reference time given.' },
          category: { type: SchemaType.STRING, description: 'date | interview | social | travel | medical | other' },
        },
        required: ['subject', 'askText', 'eventAt', 'category'],
      },
    },
  },
  required: ['events'],
}

/**
 * Find future events worth asking about. Returns [] aggressively: a false
 * positive here becomes an unprompted text about something that never
 * happened, which is much worse than staying quiet.
 */
export async function detectEvents(
  userMessage: string,
  now: Date = new Date(),
  timeZone: string = 'America/Los_Angeles'
): Promise<DetectedEvent[]> {
  const rawKey = process.env.GOOGLE_AI_API_KEY
  const apiKey = rawKey?.trim().replace(/^['"]|['"]$/g, '') || ''
  if (!apiKey) return []

  // Everything below is expressed in the user's local time and nothing else.
  // Passing both an ISO timestamp (UTC) and a date string (local) gave the
  // model two references that disagreed across the dateline: at 8pm Thursday
  // in California the ISO already says Friday, so "today" and "tonight"
  // resolved to the wrong day, and "tonight" often failed to resolve at all.
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { timeZone, ...opts }).format(now)

  const localDate = fmt({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const localTime = fmt({ hour: 'numeric', minute: '2-digit', hour12: true })
  const localISODate = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.1 },
  })

  const prompt = `RIGHT NOW, in the user's local time: ${localDate}, ${localTime}.
Today's date is ${localISODate}. Every date you return is LOCAL time. Ignore UTC entirely.

Message from the user: "${userMessage}"

Resolving what they said:
- "tonight" = today, ${localISODate}, in the evening. If it is already evening, that is
  a few hours from now, not tomorrow.
- "today" = ${localISODate}. If the time they name has already passed today, they are
  telling you about something imminent, keep today's date.
- "tomorrow" = the day after ${localISODate}.
- A weekday name means the NEXT occurrence of that weekday.
- "in N hours" = now plus N hours.

If they gave no time of day, use a sensible one for the kind of event rather than
midnight: dates and drinks and parties in the evening (19:00), interviews and
appointments mid-morning (10:00), exams and flights early (09:00). A follow-up scheduled
off a midnight default lands in the middle of the night.

Return eventAt as a local datetime with no timezone suffix: YYYY-MM-DDTHH:MM:SS

Find things they said are HAPPENING IN THE FUTURE that a friend would follow up on.

Include: dates, interviews, parties, trips, appointments, exams, performances, anything
with an outcome someone would ask about afterwards.

Something earlier TODAY still counts. If they mention a 3pm interview and it is now 8pm,
that is exactly what a friend follows up on. Keep today's date and time.

Exclude, and this matters more than finding things:
- Anything on a PREVIOUS day, or told in the past tense ("I had a date last night").
  They have already had the conversation.
- Vague intentions with no time ("I should really call my mum", "I want to move").
- Ongoing states, not events ("I hate my job", "my roommate is annoying").
- Anything you'd have to guess the date of. No date, no event.
- Recurring routine ("gym tomorrow"). Nobody wants to be asked how the gym was.

Return an empty list if nothing qualifies. That is the common case and it is fine.`

  try {
    const res = await model.generateContent(prompt)
    const parsed = JSON.parse(res.response.text())
    return (parsed.events || [])
      .filter((e: any) => e?.subject && e?.eventAt)
      .map((e: any) => {
        // The model returns a local wall-clock time. Convert through the
        // user's zone rather than letting Date parse it as UTC.
        const [datePart, timePart] = String(e.eventAt).split('T')
        const utc = zonedTimeToUtc(datePart, (timePart || '19:00:00').slice(0, 8), timeZone)
        return { ...e, eventAt: utc.toISOString() }
      })
      .filter((e: any) => {
        const at = new Date(e.eventAt).getTime()
        // Earlier today still counts. Someone saying at 8pm that they had a 3pm
        // interview is the strongest case for a follow-up there is, and the ask
        // still lands in the future because the delay runs from the event. The
        // window is same-day rather than strictly future for exactly that.
        return !Number.isNaN(at)
          && at > now.getTime() - 18 * 3600000
          && at < now.getTime() + 180 * 86400000
      })
  } catch (error) {
    console.error('[Followups] Detection failed:', error instanceof Error ? error.message : error)
    return []
  }
}

/** Detect and schedule in one call. Safe to run in the background. */
export async function scheduleFromMessage(params: {
  phoneNumber: string
  message: string
  eventId?: string | null
  timeZone?: string
}): Promise<number> {
  if (!convex) return 0

  const events = await detectEvents(params.message, new Date(), params.timeZone)
  if (events.length === 0) return 0

  let scheduled = 0
  for (const e of events) {
    const eventAt = new Date(e.eventAt).getTime()
    const delay = (DELAY_HOURS[e.category] ?? DELAY_HOURS.other) * 3600000

    try {
      await convex.mutation(api.followups.create, {
        phoneNumber: params.phoneNumber,
        subject: e.subject,
        askText: e.askText,
        eventAt,
        dueAt: eventAt + delay,
        eventId: params.eventId ?? undefined,
      })
      scheduled++
      console.log(`[Followups] scheduled "${e.askText}" for ${new Date(eventAt + delay).toISOString()}`)
    } catch (error) {
      console.error('[Followups] Failed to store:', error)
    }
  }
  return scheduled
}

/** Everything due right now, for the scheduler to send. */
export async function getDue(now: number = Date.now()): Promise<any[]> {
  if (!convex) return []
  try {
    return (await convex.query(api.followups.due, { now })) || []
  } catch (error) {
    console.error('[Followups] Failed to load due:', error)
    return []
  }
}

export async function markSent(id: string): Promise<void> {
  if (!convex) return
  try {
    await convex.mutation(api.followups.markSent, { id })
  } catch (error) {
    console.error('[Followups] Failed to mark sent:', error)
  }
}
