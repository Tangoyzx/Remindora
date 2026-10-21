import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { TodoStore } from '../src/store.js'

describe('TodoStore', () => {
  it('persists and expands for a date', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'remindora-'))
    try {
      const store = new TodoStore(dir)
      await store.init()
      await store.add({
        kind: 'once',
        title: '穿礼服',
        rawText: '明天提醒我穿礼服',
        source: 'text',
        dueDate: '2026-10-21',
      })
      await store.add({
        kind: 'weekly',
        title: '穿运动服',
        rawText: '每周五提醒我穿运动服',
        source: 'text',
        weekdays: [5],
      })
      const day = await store.listForDate('2026-10-21')
      // 2026-10-21 is Wednesday — only the once item
      assert.equal(day.length, 1)
      assert.equal(day[0]?.title, '穿礼服')

      const friday = await store.listForDate('2026-10-23')
      assert.equal(friday.some((t) => t.title === '穿运动服'), true)

      const again = new TodoStore(dir)
      await again.init()
      const all = await again.listAll()
      assert.equal(all.length, 2)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
