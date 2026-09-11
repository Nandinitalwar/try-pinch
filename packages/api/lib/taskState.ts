export const TASK_STATUSES = ['pending', 'snoozed', 'completed', 'cancelled'] as const
export type TaskStatus = typeof TASK_STATUSES[number]

const transitions: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ['snoozed', 'completed', 'cancelled'],
  snoozed: ['pending', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export function normalizeTaskTitle(value: unknown): string {
  if (typeof value !== 'string') throw new Error('title must be a string')
  const title = value.replace(/\s+/g, ' ').trim()
  if (!title) throw new Error('title is required')
  if (title.length > 240) throw new Error('title must be 240 characters or fewer')
  return title
}

export function normalizeIdempotencyKey(value: unknown, title: string): string {
  const supplied = typeof value === 'string' ? value.trim() : ''
  const key = supplied || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!key) throw new Error('idempotency key is required')
  if (key.length > 160) throw new Error('idempotency key must be 160 characters or fewer')
  return key
}

export function assertTransition(from: string, to: unknown): asserts to is TaskStatus {
  if (!TASK_STATUSES.includes(from as TaskStatus)) throw new Error(`unknown task status: ${from}`)
  if (typeof to !== 'string' || !TASK_STATUSES.includes(to as TaskStatus)) {
    throw new Error('invalid task status')
  }
  if (!transitions[from as TaskStatus].includes(to as TaskStatus)) {
    throw new Error(`cannot transition task from ${from} to ${to}`)
  }
}

export function parseOptionalTimestamp(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const timestamp = typeof value === 'number' ? value : Date.parse(String(value))
  if (!Number.isFinite(timestamp)) throw new Error(`${field} must be a valid date`)
  return timestamp
}
