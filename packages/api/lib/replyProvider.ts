import OpenAI from 'openai'

export type ReplyProvider = 'openai' | 'groq' | 'glm'
export type ReplyReasoningEffort = 'low' | 'medium'

export const GROQ_OPENAI_BASE_URL = 'https://api.groq.com/openai/v1'
export const GLM_OPENAI_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'
export const DEFAULT_OPENAI_REPLY_MODEL = 'gpt-5.6-sol'
export const DEFAULT_GROQ_REPLY_MODEL = 'openai/gpt-oss-120b'
export const DEFAULT_GLM_REPLY_MODEL = 'glm-5.2'

type ReplyEnvironment = Record<string, string | undefined>

export interface ReplyProviderConfig {
  provider: ReplyProvider
  model: string
  reasoningEffort: ReplyReasoningEffort
  apiKey: string
  baseURL?: string
}

function cleanEnvironmentValue(value: string | undefined): string {
  return value?.trim().replace(/^['"]|['"]$/g, '') || ''
}

export function resolveReplyProviderConfig(
  environment: ReplyEnvironment = process.env
): ReplyProviderConfig {
  const requestedProvider = cleanEnvironmentValue(environment.PINCH_REPLY_PROVIDER).toLowerCase() || 'openai'
  if (requestedProvider !== 'openai' && requestedProvider !== 'groq' && requestedProvider !== 'glm') {
    throw new Error(`PINCH_REPLY_PROVIDER must be "openai", "groq", or "glm", received "${requestedProvider}"`)
  }

  const provider: ReplyProvider = requestedProvider
  const keyName = provider === 'groq' ? 'GROQ_API_KEY' : provider === 'glm' ? 'GLM_API_KEY' : 'OPENAI_API_KEY'
  const apiKey = cleanEnvironmentValue(environment[keyName])
  if (!apiKey) {
    throw new Error(`${keyName} is not configured for PINCH_REPLY_PROVIDER=${provider}`)
  }

  const model = cleanEnvironmentValue(environment.PINCH_REPLY_MODEL)
    || (provider === 'groq' ? DEFAULT_GROQ_REPLY_MODEL : provider === 'glm' ? DEFAULT_GLM_REPLY_MODEL : DEFAULT_OPENAI_REPLY_MODEL)
  const configuredEffort = cleanEnvironmentValue(environment.PINCH_REPLY_REASONING_EFFORT).toLowerCase()
  const reasoningEffort: ReplyReasoningEffort = configuredEffort === 'low'
    ? 'low'
    : configuredEffort === 'medium'
      ? 'medium'
      : provider === 'groq' || provider === 'glm'
        ? 'low'
        : 'medium'

  return {
    provider,
    model,
    reasoningEffort,
    apiKey,
    baseURL: provider === 'groq' ? GROQ_OPENAI_BASE_URL : provider === 'glm' ? GLM_OPENAI_BASE_URL : undefined,
  }
}

export function createReplyClient(config: ReplyProviderConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  })
}

export function getReplyProviderRequestOptions(
  provider: ReplyProvider,
  reasoningEffort: ReplyReasoningEffort,
  safetyIdentifier: string
): Partial<OpenAI.Responses.ResponseCreateParamsNonStreaming> {
  if (provider === 'groq' || provider === 'glm') {
    return {
      // Groq supports effort but not OpenAI's persisted reasoning context.
      reasoning: { effort: reasoningEffort },
    }
  }

  return {
    reasoning: { effort: reasoningEffort, context: 'current_turn' },
    text: { verbosity: 'low' },
    store: false,
    include: ['reasoning.encrypted_content'],
    safety_identifier: safetyIdentifier,
    prompt_cache_key: safetyIdentifier,
  }
}
