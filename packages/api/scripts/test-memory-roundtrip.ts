import assert from 'node:assert/strict'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

async function main() {
  const [{ SimpleMemorySystem }, { Vault }] = await Promise.all([
    import('../lib/simpleMemory'),
    import('../lib/vault'),
  ])
  const phoneNumber = `memory-roundtrip-${Date.now()}`
  const memory = new SimpleMemorySystem()

  const firstMessage = 'I always order iced coffee, it is my favorite drink'
  const firstEvent = await Vault.logInbound({
    phoneNumber,
    source: 'test',
    text: firstMessage,
  })
  const first = await memory.extractMemories(firstMessage, '', phoneNumber, firstEvent)
  assert.ok(first.length > 0, 'initial preference was not extracted')
  assert.equal(await memory.storeMemories(phoneNumber, first), true)

  const recalled = await memory.getMemories(phoneNumber, 10, 'what should I drink this morning?')
  assert.ok(recalled.some(item => /coffee/i.test(item.memory_content)), 'semantic recall missed coffee')
  assert.ok(recalled.some(item => item.source_event_ids?.includes(firstEvent || '')), 'source event was not retained')

  const correctionMessage = "I don't drink coffee anymore, I prefer hot tea now"
  const correctionEvent = await Vault.logInbound({
    phoneNumber,
    source: 'test',
    text: correctionMessage,
  })
  const correction = await memory.extractMemories(
    correctionMessage,
    '',
    phoneNumber,
    correctionEvent
  )
  assert.ok(correction.length > 0, 'correction was not extracted')
  assert.equal(await memory.storeMemories(phoneNumber, correction), true)

  const active = await memory.listMemories(phoneNumber)
  assert.ok(active.some(item => /tea/i.test(item.memory_content)), 'corrected tea preference is not active')
  assert.equal(
    active.filter(item => item.memory_key === first[0].memory_key).length,
    1,
    'old and corrected preferences are both active'
  )

  const audit = await memory.listMemories(phoneNumber, true)
  assert.ok(audit.some(item => item.status === 'superseded'), 'correction did not preserve a superseded audit record')

  const forgetMessage = 'forget what I told you about what I drink'
  const forgetEvent = await Vault.logInbound({
    phoneNumber,
    source: 'test',
    text: forgetMessage,
  })
  const forget = await memory.extractMemories(forgetMessage, '', phoneNumber, forgetEvent)
  assert.ok(forget.some(item => item.operation === 'delete'), 'forget request did not produce a deletion')
  assert.equal(await memory.storeMemories(phoneNumber, forget), true)
  assert.equal((await memory.listMemories(phoneNumber)).length, 0, 'forgotten preference is still active')

  console.log(JSON.stringify({
    ok: true,
    first: first.map(item => ({ key: item.memory_key, content: item.memory_content })),
    recalled: recalled.map(item => item.memory_content),
    correction: correction.map(item => ({ key: item.memory_key, content: item.memory_content })),
    auditStatuses: audit.map(item => item.status),
    forget: forget.map(item => ({ operation: item.operation, key: item.target_key })),
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
