import {
  formatLocalDate,
  isValidDateString,
  isValidWeekdays,
  resolveRelativeDueDate,
} from './dates.js'
import { ChatError, type ChatClient } from './chat.js'
import type { ParsedTodo, RemindoraConfig } from './types.js'

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

interface ModelPayload {
  kind?: string
  title?: string
  dueDate?: string
  relativeDue?: string
  weekdays?: number[]
  error?: string
}

const SYSTEM = `You extract a single personal reminder from Chinese or English user text.
Return ONLY a JSON object (no markdown) with one of these shapes:

1) One-shot:
{"kind":"once","title":"...","dueDate":"YYYY-MM-DD"}
or {"kind":"once","title":"...","relativeDue":"tomorrow"|"today"|"day_after_tomorrow"|"明天"|"今天"|"后天"}

2) Weekly:
{"kind":"weekly","title":"...","weekdays":[1-7]}
ISO weekdays: 1=Monday ... 7=Sunday. Example 周五 => [5].

3) Daily:
{"kind":"daily","title":"..."}

4) If the text is not a reminder or the date/weekday is unclear:
{"error":"brief reason in Chinese"}

Rules:
- title is a short imperative without the date words (e.g. "穿运动服", "带英语书").
- Prefer absolute dueDate when the user names a calendar day.
- Do not invent a date when unclear — return error.
- Only one reminder per request.`

export async function parseTodoText(
  text: string,
  config: RemindoraConfig,
  chat: ChatClient,
  now: Date = new Date(),
): Promise<ParsedTodo> {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new ParseError('文本为空')
  }

  const today = formatLocalDate(now, config.timezone)
  const user = [
    `Timezone: ${config.timezone}`,
    `Today (local): ${today}`,
    `User text: ${trimmed}`,
  ].join('\n')

  let raw: string
  try {
    raw = await chat.complete({ system: SYSTEM, user, temperature: 0 })
  } catch (err) {
    if (err instanceof ChatError) {
      throw new ParseError(err.message)
    }
    throw err
  }

  let payload: ModelPayload
  try {
    payload = JSON.parse(stripFences(raw)) as ModelPayload
  } catch {
    throw new ParseError('模型返回的不是合法 JSON')
  }

  if (payload.error) {
    throw new ParseError(String(payload.error))
  }

  const kind = payload.kind
  const title = (payload.title ?? '').trim()
  if (!title) {
    throw new ParseError('未能解析出待办标题')
  }

  if (kind === 'once') {
    const due =
      (payload.dueDate && isValidDateString(payload.dueDate) ? payload.dueDate : undefined)
      ?? resolveRelativeDueDate(payload.relativeDue ?? payload.dueDate, today)
    if (!due) {
      throw new ParseError('一次性待办缺少明确日期')
    }
    return { kind: 'once', title, dueDate: due }
  }

  if (kind === 'weekly') {
    if (!isValidWeekdays(payload.weekdays)) {
      throw new ParseError('每周待办缺少合法的星期列表')
    }
    return { kind: 'weekly', title, weekdays: payload.weekdays }
  }

  if (kind === 'daily') {
    return { kind: 'daily', title }
  }

  throw new ParseError('无法识别待办类型')
}

function stripFences(text: string): string {
  const trimmed = text.trim()
  const m = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  return (m?.[1] ?? trimmed).trim()
}

export async function writeBriefingScript(
  titles: string[],
  config: RemindoraConfig,
  chat: ChatClient,
  localDate: string,
): Promise<string> {
  if (titles.length === 0) {
    return '今天没有待办。'
  }
  const fallback = `今天有${titles.length}项待办：${titles.join('；')}。`
  const system = `You write a short spoken Chinese briefing for a personal reminder device.
Return ONLY plain Chinese text (no JSON, no markdown). Keep it under 140 Chinese characters when possible.
Start by saying how many items there are, then list each briefly.`
  const user = `Date: ${localDate}\nItems:\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
  try {
    const content = await chat.complete({ system, user, temperature: 0.3 })
    return content.trim() || fallback
  } catch {
    return fallback
  }
}
