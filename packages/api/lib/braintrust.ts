// Braintrust AI Observability Integration
import { initLogger, Logger, Span } from 'braintrust'

let braintrustLogger: Logger<true> | null = null
let isInitialized = false

/**
 * Initialize Braintrust logger with environment configuration
 */
export function getBraintrustLogger(): Logger<true> | null {
  // Return existing logger if already initialized
  if (braintrustLogger) {
    return braintrustLogger
  }

  // Don't retry if we already failed to initialize
  if (isInitialized) {
    return null
  }

  // Check if Braintrust is configured
  const apiKey = process.env.BRAINTRUST_API_KEY
  const parent = process.env.BRAINTRUST_PARENT

  if (!apiKey || !parent) {
    console.log('[Braintrust] Not configured - skipping observability (set BRAINTRUST_API_KEY and BRAINTRUST_PARENT)')
    isInitialized = true
    return null
  }

  try {
    // Extract project name from parent (format: "project_name:my-project")
    const projectName = parent.split(':')[1] || 'pinch-sms-astrologer'

    braintrustLogger = initLogger({
      projectName: projectName,
      apiKey: apiKey,
    })

    console.log(`[Braintrust] Logger initialized for project: ${projectName}`)
    isInitialized = true
    return braintrustLogger
  } catch (error) {
    console.error('[Braintrust] Failed to initialize logger:', error)
    isInitialized = true
    return null
  }
}

/**
 * Log an LLM interaction to Braintrust
 */
export function logLLMCall(params: {
  name: string
  input: any
  output: any
  model: string
  metadata?: Record<string, any>
  metrics?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    latency_ms?: number
  }
  error?: string
  tags?: string[]
}): Span | null {
  const logger = getBraintrustLogger()
  if (!logger) return null

  try {
    const span = logger.startSpan({
      name: params.name,
      spanAttributes: {
        type: 'llm',
      },
      event: {
        input: params.input,
        output: params.output,
        metadata: {
          model: params.model,
          ...params.metadata,
        },
        metrics: params.metrics,
        error: params.error,
        tags: params.tags,
      },
    })

    span.end()
    logger.flush().catch(err => console.error('[Braintrust] Flush error:', err))
    return span
  } catch (error) {
    console.error('[Braintrust] Failed to log LLM call:', error)
    return null
  }
}

/**
 * Log a tool call to Braintrust
 */
export function logToolCall(params: {
  name: string
  input: any
  output: any
  metadata?: Record<string, any>
  error?: string
}): Span | null {
  const logger = getBraintrustLogger()
  if (!logger) return null

  try {
    const span = logger.startSpan({
      name: params.name,
      spanAttributes: {
        type: 'tool',
      },
      event: {
        input: params.input,
        output: params.output,
        metadata: params.metadata,
        error: params.error,
      },
    })

    span.end()
    logger.flush().catch(err => console.error('[Braintrust] Flush error:', err))
    return span
  } catch (error) {
    console.error('[Braintrust] Failed to log tool call:', error)
    return null
  }
}

/**
 * Create a parent span for tracking a conversation or task
 */
export function startConversationSpan(params: {
  name: string
  phoneNumber: string
  userId: string
  metadata?: Record<string, any>
}): Span | null {
  const logger = getBraintrustLogger()
  if (!logger) return null

  try {
    return logger.startSpan({
      name: params.name,
      spanAttributes: {
        type: 'task',
      },
      event: {
        metadata: {
          phone_number: params.phoneNumber,
          user_id: params.userId,
          ...params.metadata,
        },
      },
    })
  } catch (error) {
    console.error('[Braintrust] Failed to start conversation span:', error)
    return null
  }
}

/**
 * Flush all pending logs to Braintrust
 */
export async function flushBraintrust(): Promise<void> {
  const logger = getBraintrustLogger()
  if (!logger) return

  try {
    await logger.flush()
  } catch (error) {
    console.error('[Braintrust] Failed to flush logs:', error)
  }
}

