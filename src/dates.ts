import type { TodoItem } from './types.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Local calendar parts in a timezone (Gregorian YYYY-MM-DD). */
export function localParts(date: Date, timeZone: string): {
  year: number
  month: number
  day: number
} {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  // en-CA yields YYYY-MM-DD
  const [year, month, day] = fmt.format(date).split('-').map(Number)
  return { year, month, day }
}

export function formatLocalDate(date: Date, timeZone: string): string {
  const { year, month, day } = localParts(date, timeZone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** ISO weekday for a civil date: 1=Mon ... 7=Sun. */
export function isoWeekdayOf(yyyyMmDd: string): number {
  if (!DATE_RE.test(yyyyMmDd)) {
    throw new Error(`invalid date: ${yyyyMmDd}`)
  }
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  const day = utc.getUTCDay() // 0=Sun
  return day === 0 ? 7 : day
}

export function addLocalDays(yyyyMmDd: string, days: number): string {
  if (!DATE_RE.test(yyyyMmDd)) {
    throw new Error(`invalid date: ${yyyyMmDd}`)
  }
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  utc.setUTCDate(utc.getUTCDate() + days)
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`
}

export function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  return (
    utc.getUTCFullYear() === y
    && utc.getUTCMonth() === m - 1
    && utc.getUTCDate() === d
  )
}

export function isValidWeekdays(weekdays: number[] | undefined): boolean {
  if (!weekdays || weekdays.length === 0) return false
  const set = new Set(weekdays)
  if (set.size !== weekdays.length) return false
  return weekdays.every((w) => Number.isInteger(w) && w >= 1 && w <= 7)
}

/** Whether an active todo hits a local calendar date. */
export function hitsDate(todo: TodoItem, localDate: string): boolean {
  if (todo.status !== 'active') return false
  if (todo.kind === 'once') {
    return todo.dueDate === localDate
  }
  if (todo.kind === 'daily') {
    return true
  }
  if (todo.kind === 'weekly') {
    if (!todo.weekdays?.length) return false
    return todo.weekdays.includes(isoWeekdayOf(localDate))
  }
  return false
}

export function resolveRelativeDueDate(
  relative: string | undefined,
  todayLocal: string,
): string | undefined {
  if (!relative) return undefined
  const key = relative.trim().toLowerCase()
  if (key === 'today' || key === '今天') return todayLocal
  if (key === 'tomorrow' || key === '明天') return addLocalDays(todayLocal, 1)
  if (key === 'day_after_tomorrow' || key === '后天') return addLocalDays(todayLocal, 2)
  if (DATE_RE.test(relative) && isValidDateString(relative)) return relative
  return undefined
}
