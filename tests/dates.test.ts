import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addLocalDays,
  formatLocalDate,
  hitsDate,
  isoWeekdayOf,
  isValidDateString,
  resolveRelativeDueDate,
} from '../src/dates.js'
import type { TodoItem } from '../src/types.js'

function todo(partial: Partial<TodoItem> & Pick<TodoItem, 'kind' | 'title'>): TodoItem {
  return {
    id: 't1',
    rawText: partial.title,
    source: 'text',
    status: 'active',
    createdAt: new Date().toISOString(),
    ...partial,
  }
}

describe('dates', () => {
  it('formats Asia/Shanghai local date', () => {
    // 2026-10-20 16:00 UTC = 2026-10-21 00:00 CST
    const d = new Date('2026-10-20T16:00:00.000Z')
    assert.equal(formatLocalDate(d, 'Asia/Shanghai'), '2026-10-21')
  })

  it('resolves tomorrow relative to today', () => {
    assert.equal(resolveRelativeDueDate('明天', '2026-10-20'), '2026-10-21')
    assert.equal(resolveRelativeDueDate('tomorrow', '2026-10-20'), '2026-10-21')
    assert.equal(addLocalDays('2026-10-31', 1), '2026-11-01')
  })

  it('computes ISO weekdays', () => {
    // 2026-10-23 is Friday
    assert.equal(isoWeekdayOf('2026-10-23'), 5)
    assert.equal(isoWeekdayOf('2026-10-19'), 1)
  })

  it('hits once / weekly / daily', () => {
    const once = todo({ kind: 'once', title: '穿礼服', dueDate: '2026-10-21' })
    const weekly = todo({ kind: 'weekly', title: '穿运动服', weekdays: [5] })
    const daily = todo({ kind: 'daily', title: '带钥匙' })
    assert.equal(hitsDate(once, '2026-10-21'), true)
    assert.equal(hitsDate(once, '2026-10-20'), false)
    assert.equal(hitsDate(weekly, '2026-10-23'), true)
    assert.equal(hitsDate(weekly, '2026-10-22'), false)
    assert.equal(hitsDate(daily, '2026-10-20'), true)
  })

  it('validates date strings', () => {
    assert.equal(isValidDateString('2026-02-28'), true)
    assert.equal(isValidDateString('2026-02-30'), false)
  })
})
