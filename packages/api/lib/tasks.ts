import crypto from 'crypto'
import { convex, api } from './convexClient'
import { normalizeIdempotencyKey, normalizeTaskTitle, parseOptionalTimestamp, TASK_STATUSES } from './taskState'

export async function createTask(input: {
  phoneNumber: string
  title: unknown
  dueAt?: unknown
  recurrence?: string
  source?: string
}) {
  if (!convex) throw new Error('task storage is not configured')
  const title = normalizeTaskTitle(input.title)
  const dueAt = parseOptionalTimestamp(input.dueAt, 'dueAt')
  const fingerprint = crypto.createHash('sha256')
    .update(`${input.phoneNumber}\0${title.toLowerCase()}\0${dueAt || ''}\0${input.recurrence || ''}`)
    .digest('hex').slice(0, 24)
  return convex.mutation((api as any).tasks.create, {
    phoneNumber: input.phoneNumber,
    title,
    dueAt,
    recurrence: input.recurrence?.trim() || undefined,
    idempotencyKey: normalizeIdempotencyKey(fingerprint, title),
    source: input.source || 'imessage',
  })
}

export async function listTasks(phoneNumber: string) {
  if (!convex) return []
  return convex.query((api as any).tasks.listByPhone, { phoneNumber })
}

export async function transitionTask(input: {
  phoneNumber: string
  id: string
  status: unknown
  snoozeUntil?: unknown
}) {
  if (!convex) throw new Error('task storage is not configured')
  if (typeof input.status !== 'string' || !TASK_STATUSES.includes(input.status as any)) {
    throw new Error('invalid task status')
  }
  return convex.mutation((api as any).tasks.transition, {
    id: input.id,
    phoneNumber: input.phoneNumber,
    status: input.status,
    snoozeUntil: parseOptionalTimestamp(input.snoozeUntil, 'snoozeUntil'),
  })
}
