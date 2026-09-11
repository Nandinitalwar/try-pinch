// Captures fine-tuning examples from live traffic.
//
// The voice checker already produces exactly what supervised fine-tuning wants:
// a prompt, a first draft that broke the rules, and a corrected version that
// didn't. Those pairs were being discarded. Every message Pinch answers is a
// free labelled example, and the labelling is deterministic rather than a
// human sitting there rating outputs.
//
// Written as JSONL to a local file rather than Convex because the consumer is
// a training job, not the app. Disabled unless PINCH_TRAINING_LOG is set.

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export interface TrainingExample {
  timestamp: string
  systemPrompt: string
  userMessage: string
  /** What the model produced unaided. Absent when it was clean first try. */
  rejected?: string
  /** The response actually sent, and the one to train toward. */
  chosen: string
  /** Which rules the first draft broke. Empty means it was clean immediately. */
  violations: string[]
  /** One-way conversation/profile fingerprint for leakage-safe dataset splits. */
  groupId?: string
}

export function trainingGroupId(identifier: string): string {
  return crypto.createHash('sha256').update(identifier).digest('hex').slice(0, 20)
}

function logPath(): string | null {
  const configured = process.env.PINCH_TRAINING_LOG?.trim()
  return configured || null
}

/**
 * Append one example. Never throws: a training-capture failure must not break
 * a user's reply.
 */
export function recordExample(example: TrainingExample): void {
  const target = logPath()
  if (!target) return

  try {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.appendFileSync(target, JSON.stringify(example) + '\n', 'utf8')
  } catch (error) {
    console.error('[TrainingData] Failed to record example:', error)
  }
}

/**
 * Clean-first-try responses are the most valuable examples, since they show
 * the target voice with no correction involved. Rewritten ones are useful too
 * but carry whatever the rewrite pass settled for.
 */
export function isHighQuality(example: TrainingExample): boolean {
  return example.violations.length === 0
}
