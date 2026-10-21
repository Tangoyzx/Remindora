import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { splitForTts } from '../src/tts/tencent.js'

describe('splitForTts', () => {
  it('keeps short text as one chunk', () => {
    const chunks = splitForTts('今天没有待办。')
    assert.equal(chunks.length, 1)
  })

  it('splits long text under limit', () => {
    const long = `${'提醒你带钥匙。'.repeat(40)}`
    const chunks = splitForTts(long, 140)
    assert.ok(chunks.length > 1)
    assert.ok(chunks.every((c) => c.length <= 140))
  })
})
