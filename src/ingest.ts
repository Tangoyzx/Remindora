import { ParseError, parseTodoText } from './parse.js'
import type { ChatClient } from './chat.js'
import type { TodoStore } from './store.js'
import type { IngestResponse, RemindoraConfig } from './types.js'

export async function ingestText(
  store: TodoStore,
  config: RemindoraConfig,
  chat: ChatClient,
  text: string,
  source: string,
): Promise<IngestResponse> {
  try {
    const parsed = await parseTodoText(text, config, chat)
    const todo = await store.add({
      kind: parsed.kind,
      title: parsed.title,
      rawText: text.trim(),
      source,
      dueDate: parsed.dueDate,
      weekdays: parsed.weekdays,
    })
    return { ok: true, transcript: text.trim(), todo }
  } catch (err) {
    const message = err instanceof ParseError
      ? err.message
      : err instanceof Error
        ? err.message
        : '未知错误'
    return { ok: false, error: message, transcript: text.trim() }
  }
}
