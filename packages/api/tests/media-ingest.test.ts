import test from 'node:test'
import assert from 'node:assert/strict'
import {
  composeMultimodalInput,
  isSupportedMediaMimeType,
  transcribeAudioData,
} from '../lib/mediaIngest'

test('recognizes visual and audio attachments', () => {
  assert.equal(isSupportedMediaMimeType('image/jpeg'), true)
  assert.equal(isSupportedMediaMimeType('video/mp4'), true)
  assert.equal(isSupportedMediaMimeType('audio/x-caf'), true)
  assert.equal(isSupportedMediaMimeType('application/pdf'), false)
})

test('sends an M4A voice note directly to gpt-transcribe', async () => {
  let uploadName = ''
  let uploadType = ''
  let model = ''
  let converted = false

  const transcript = await transcribeAudioData(
    Buffer.from('fake m4a').toString('base64'),
    'audio/mp4',
    {
      client: {
        audio: {
          transcriptions: {
            create: async params => {
              uploadName = (params.file as any).name
              uploadType = (params.file as any).type
              model = params.model
              return { text: '  My sister Maya lives in Brooklyn.  ' }
            },
          },
        },
      },
      convert: async bytes => {
        converted = true
        return bytes
      },
    }
  )

  assert.equal(transcript, 'My sister Maya lives in Brooklyn.')
  assert.equal(converted, false)
  assert.equal(uploadName, 'voice-note.m4a')
  assert.equal(uploadType, 'audio/mp4')
  assert.equal(model, 'gpt-transcribe')
})

test('normalizes a Linq CAF voice memo to WAV before transcription', async () => {
  let converterInput = ''
  let uploadName = ''

  const transcript = await transcribeAudioData(
    Buffer.from('fake caf').toString('base64'),
    'audio/x-caf',
    {
      convert: async bytes => {
        converterInput = bytes.toString()
        return Buffer.from('converted wav')
      },
      client: {
        audio: {
          transcriptions: {
            create: async params => {
              uploadName = (params.file as any).name
              return { text: 'Remind me to call Mom tomorrow.' }
            },
          },
        },
      },
    }
  )

  assert.equal(converterInput, 'fake caf')
  assert.equal(uploadName, 'voice-note.wav')
  assert.equal(transcript, 'Remind me to call Mom tomorrow.')
})

test('voice transcripts stay durable and visual analysis survives short-term onboarding', () => {
  const input = composeMultimodalInput('look at this', {
    visualSummaries: ['A black leather jacket over a white shirt.'],
    transcripts: ['I want to wear it to dinner Friday.'],
    failedCount: 0,
  })

  assert.equal(input.effectiveMessage, 'look at this\nI want to wear it to dinner Friday.')
  assert.match(input.historyMessage, /photo or video/)
  assert.match(input.historyMessage, /black leather jacket/)
  assert.match(input.agentMessage, /photo or video/)
  assert.match(input.agentMessage, /black leather jacket/)
})

test('an unreadable attachment gives the agent a useful recovery instruction', () => {
  const input = composeMultimodalInput('', {
    visualSummaries: [],
    transcripts: [],
    failedCount: 1,
  })

  assert.equal(input.effectiveMessage, '')
  assert.match(input.historyMessage, /not understood/)
  assert.match(input.agentMessage, /Ask them to resend/)
})
