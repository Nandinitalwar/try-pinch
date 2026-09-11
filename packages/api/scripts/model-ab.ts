// A/B the reply model, holding everything else constant.
//
// The question this answers: when a reply is weak, is that the prompt or the
// model? Fine-tuning a small model on its own output can only make it more
// consistently itself. If a stronger model writes noticeably better replies
// under the identical prompt, there is headroom, and the move is to generate
// the training corpus with the strong model and distil that into the small
// one. If it writes the same, the ceiling is the prompt and tuning buys only
// cost and consistency.
//
// Usage: npx tsx scripts/model-ab.ts <promptFile> <questionsFile>

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { GoogleGenerativeAI } from '@google/generative-ai'
import { checkVoice } from '../lib/voiceCheck'

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro']

async function main() {
  const [, , promptFile, questionsFile] = process.argv
  if (!promptFile || !questionsFile) {
    console.error('Usage: npx tsx scripts/model-ab.ts <promptFile> <questionsFile>')
    process.exit(1)
  }

  const systemPrompt = fs.readFileSync(promptFile, 'utf8')
  const questions = fs.readFileSync(questionsFile, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)

  const apiKey = process.env.GOOGLE_AI_API_KEY?.trim().replace(/^['"]|['"]$/g, '') || ''
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured')
  const genAI = new GoogleGenerativeAI(apiKey)

  const stats: Record<string, { violations: number; chars: number; n: number }> = {}

  for (const q of questions) {
    console.log(`\n${'='.repeat(70)}\nQ: ${q}\n`)

    for (const modelName of MODELS) {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.85, maxOutputTokens: 800 },
      })

      try {
        const res = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: q }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] } as any,
        })
        const text = (res.response.text() || '').trim()
        const v = checkVoice(text)

        stats[modelName] ??= { violations: 0, chars: 0, n: 0 }
        stats[modelName].violations += v.length
        stats[modelName].chars += text.length
        stats[modelName].n += 1

        console.log(`[${modelName}]`)
        console.log(text)
        console.log(`   ${text.length} chars${v.length ? ', flags: ' + v.map(x => x.kind).join(', ') : ', clean'}\n`)
      } catch (error) {
        console.log(`[${modelName}] FAILED: ${error instanceof Error ? error.message : error}\n`)
      }
    }
  }

  console.log(`\n${'='.repeat(70)}\nSUMMARY\n`)
  for (const [m, s] of Object.entries(stats)) {
    console.log(`${m}: ${(s.violations / s.n).toFixed(2)} flags/reply, ${Math.round(s.chars / s.n)} chars/reply`)
  }
}

main().catch(console.error)
