import { NextRequest, NextResponse } from 'next/server'
import { convex, api } from '@/lib/convexClient'
import { TASK_STATUSES, normalizeIdempotencyKey, normalizeTaskTitle, parseOptionalTimestamp } from '@/lib/taskState'

function owner(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('sessionId is required')
  return value.trim()
}

export async function GET(request: NextRequest) {
  try {
    if (!convex) return NextResponse.json({ tasks: [] })
    const phoneNumber = owner(request.nextUrl.searchParams.get('sessionId'))
    const tasks = await convex.query((api as any).tasks.listByPhone, { phoneNumber })
    return NextResponse.json({ tasks })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'invalid request' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!convex) return NextResponse.json({ error: 'Convex is not configured' }, { status: 503 })
    const body = await request.json()
    const phoneNumber = owner(body.sessionId)
    const title = normalizeTaskTitle(body.title)
    const dueAt = parseOptionalTimestamp(body.dueAt, 'dueAt')
    const task = await convex.mutation((api as any).tasks.create, {
      phoneNumber, title, dueAt, recurrence: body.recurrence || undefined,
      idempotencyKey: normalizeIdempotencyKey(body.idempotencyKey, title), source: 'web',
    })
    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'invalid request' }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!convex) return NextResponse.json({ error: 'Convex is not configured' }, { status: 503 })
    const body = await request.json()
    const phoneNumber = owner(body.sessionId)
    if (typeof body.id !== 'string' || !body.id) throw new Error('id is required')
    // Validate the destination here; Convex validates the source transition atomically.
    if (!TASK_STATUSES.includes(body.status)) throw new Error('invalid task status')
    const snoozeUntil = parseOptionalTimestamp(body.snoozeUntil, 'snoozeUntil')
    const task = await convex.mutation((api as any).tasks.transition, {
      id: body.id, phoneNumber, status: body.status, snoozeUntil,
    })
    return NextResponse.json({ task })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'invalid request' }, { status: 400 })
  }
}
