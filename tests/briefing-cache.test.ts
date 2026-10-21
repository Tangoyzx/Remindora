import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { BriefingService } from '../src/briefing.js'
import { createEnvChatClient } from '../src/chat.js'
import { loadConfig } from '../src/config.js'
import { TodoStore } from '../src/store.js'
import { formatLocalDate } from '../src/dates.js'

describe('BriefingService cache', () => {
  it('returns the same file without regenerating when cache exists', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'remindora-brief-'))
    try {
      const config = loadConfig({
        dataDir: dir,
        timezone: 'Asia/Shanghai',
        deepseekApiKey: '',
        tencentSecretId: '',
        tencentSecretKey: '',
      })
      const store = new TodoStore(dir)
      await store.init()
      const briefing = new BriefingService(store, config, createEnvChatClient(config))
      await briefing.init()

      const today = formatLocalDate(new Date(), config.timezone)
      const cachePath = briefing.cachePathFor(today)
      const payload = Buffer.from('fake-mp3-bytes')
      await writeFile(cachePath, payload)

      const first = await briefing.getToday()
      const second = await briefing.getToday()
      assert.equal(first.etag, second.etag)
      assert.deepEqual(first.buffer, payload)
      assert.deepEqual(second.buffer, payload)

      await store.add({
        kind: 'daily',
        title: '事后新增',
        rawText: '每天提醒我事后新增',
        source: 'text',
      })
      const third = await briefing.getToday()
      assert.equal(third.etag, first.etag)
      const onDisk = await readFile(cachePath)
      assert.deepEqual(onDisk, payload)
      await access(cachePath)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
