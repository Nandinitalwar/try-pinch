import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'
import OpenAI from 'openai'
import {
  analyzeRawReply,
  buildMinimalQualityPrompt,
  estimateTokens,
  findMinimalQualityCase,
  MINIMAL_PINCH_PROMPT,
  MINIMAL_QUALITY_CASES,
  MINIMAL_QUALITY_MODEL,
  MINIMAL_QUALITY_REASONING,
  MinimalQualityCase,
} from '../lib/minimalQualityHarness'
import { createReplyClient, GROQ_OPENAI_BASE_URL } from '../lib/replyProvider'

config({ path: '.env.local', quiet: true })

interface HarnessOptions {
  caseId?: string
  dryRun: boolean
  list: boolean
  model: string
  out?: string
  delayMs: number
}

interface CaseResult {
  testCase: MinimalQualityCase
  reply: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  reasoningTokens: number
  responseId: string
  responseStatus: string
}

function clean(value: string | undefined): string {
  return value?.trim().replace(/^['"]|['"]$/g, '') || ''
}

function parseOptions(argv: string[]): HarnessOptions {
  const options: HarnessOptions = {
    dryRun: false,
    list: false,
    model: MINIMAL_QUALITY_MODEL,
    delayMs: 1500,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--list') options.list = true
    else if (arg === '--case') options.caseId = argv[++index]
    else if (arg === '--model') options.model = argv[++index]
    else if (arg === '--out') options.out = argv[++index]
    else if (arg === '--delay-ms') options.delayMs = Number(argv[++index])
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: npm run test:quality:groq -- [options]

Options:
  --dry-run          Print cases and token estimates without an API call
  --list             List case IDs
  --case <id>        Run one case instead of the full set
  --model <id>       Override openai/gpt-oss-120b
  --delay-ms <n>     Delay between free-plan calls (default: 1500)
  --out <path>       Also save the markdown report to a chosen path`)
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  assert(Number.isFinite(options.delayMs) && options.delayMs >= 0, '--delay-ms must be a non-negative number')
  return options
}

function selectCases(options: HarnessOptions): MinimalQualityCase[] {
  if (!options.caseId) return MINIMAL_QUALITY_CASES
  const testCase = findMinimalQualityCase(options.caseId)
  if (!testCase) {
    throw new Error(`Unknown case "${options.caseId}". Use --list to see valid IDs.`)
  }
  return [testCase]
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function runCase(
  client: OpenAI,
  model: string,
  testCase: MinimalQualityCase,
): Promise<CaseResult> {
  const prompt = buildMinimalQualityPrompt(testCase)
  const startedAt = Date.now()
  const response = await client.responses.create({
    model,
    instructions: prompt,
    input: testCase.userMessage,
    reasoning: { effort: MINIMAL_QUALITY_REASONING },
    max_output_tokens: 700,
  })
  const reply = response.output_text?.trim() || ''
  if (!reply) {
    throw new Error(`${testCase.id}: Groq returned no output text (status ${response.status})`)
  }

  return {
    testCase,
    reply,
    latencyMs: Date.now() - startedAt,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    totalTokens: response.usage?.total_tokens || 0,
    reasoningTokens: response.usage?.output_tokens_details?.reasoning_tokens || 0,
    responseId: response.id,
    responseStatus: response.status || 'unknown',
  }
}

function formatReport(model: string, results: CaseResult[]): string {
  const total = results.reduce((sum, result) => sum + result.totalTokens, 0)
  const input = results.reduce((sum, result) => sum + result.inputTokens, 0)
  const output = results.reduce((sum, result) => sum + result.outputTokens, 0)
  const reasoning = results.reduce((sum, result) => sum + result.reasoningTokens, 0)
  const latency = results.reduce((sum, result) => sum + result.latencyMs, 0)
  const lines = [
    '# Pinch minimal raw-quality harness',
    '',
    `- Provider: Groq`,
    `- Model: \`${model}\``,
    `- Reasoning: \`${MINIMAL_QUALITY_REASONING}\``,
    `- Calls: ${results.length}`,
    `- Tokens: ${total} total (${input} input, ${output} output, ${reasoning} reasoning)`,
    `- Mean latency: ${results.length ? Math.round(latency / results.length) : 0} ms`,
    '- Production components bypassed: Next.js route, Convex, memory, tools, onboarding, voice rewrites',
    '- Evaluation: raw replies are mechanically flagged, but product quality requires human review',
    '',
  ]

  for (const result of results) {
    const analysis = analyzeRawReply(result.testCase, result.reply)
    lines.push(
      `## ${result.testCase.id}`,
      '',
      `**User:** ${result.testCase.userMessage}`,
      '',
      `**Raw reply:** ${result.reply}`,
      '',
      `**Telemetry:** ${result.latencyMs} ms · ${result.totalTokens} tokens · ${analysis.words} words · ${analysis.sentences} sentences`,
      '',
      `**Mechanical flags:** ${analysis.violations.length ? analysis.violations.map(item => `${item.kind}: ${item.detail}`).join('; ') : 'none'}`,
      '',
      '**Review for:**',
      ...result.testCase.reviewFor.map(item => `- ${item}`),
      '',
    )
  }

  return `${lines.join('\n')}\n`
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  const cases = selectCases(options)

  if (options.list) {
    for (const testCase of MINIMAL_QUALITY_CASES) console.log(testCase.id)
    return
  }

  const promptWords = MINIMAL_PINCH_PROMPT.trim().split(/\s+/).length
  const estimatedInputTokens = cases.reduce(
    (sum, testCase) => sum + estimateTokens(`${buildMinimalQualityPrompt(testCase)}\n${testCase.userMessage}`),
    0,
  )

  console.log(`Pinch minimal quality harness`)
  console.log(`model: ${options.model}`)
  console.log(`compact prompt: ${promptWords} words`)
  console.log(`cases: ${cases.map(testCase => testCase.id).join(', ')}`)
  console.log(`estimated input: ~${estimatedInputTokens} tokens before provider tokenization`)

  if (options.dryRun) {
    console.log('\nNo API calls made (--dry-run).')
    return
  }

  const apiKey = clean(process.env.GROQ_API_KEY)
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is missing from packages/api/.env.local. Create a free key at https://console.groq.com/keys, then run with --dry-run first.')
  }

  const client = createReplyClient({
    provider: 'groq',
    model: options.model,
    reasoningEffort: MINIMAL_QUALITY_REASONING,
    apiKey,
    baseURL: GROQ_OPENAI_BASE_URL,
  })
  const results: CaseResult[] = []

  for (let index = 0; index < cases.length; index += 1) {
    const testCase = cases[index]
    console.log(`\n[${index + 1}/${cases.length}] ${testCase.id}`)
    try {
      const result = await runCase(client, options.model, testCase)
      results.push(result)
      console.log(result.reply)
      console.log(`${result.latencyMs} ms · ${result.totalTokens} tokens`)
    } catch (error) {
      if (error instanceof OpenAI.APIError && error.status === 429) {
        throw new Error(`Groq free-plan rate limit reached during ${testCase.id}. Wait for the token window to reset or rerun only this case with --case ${testCase.id}. ${error.message}`)
      }
      throw error
    }
    if (index < cases.length - 1 && options.delayMs > 0) await sleep(options.delayMs)
  }

  const report = formatReport(options.model, results)
  console.log(`\n${report}`)

  if (options.out) {
    const target = path.resolve(options.out)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, report)
    console.log(`saved: ${target}`)
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
