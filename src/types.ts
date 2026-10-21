export type TodoKind = 'once' | 'weekly' | 'daily'
export type TodoStatus = 'active' | 'done' | 'cancelled'

export interface TodoItem {
  id: string
  kind: TodoKind
  title: string
  rawText: string
  source: string
  status: TodoStatus
  createdAt: string
  /** YYYY-MM-DD for kind=once */
  dueDate?: string
  /** ISO weekdays 1=Mon ... 7=Sun for kind=weekly */
  weekdays?: number[]
}

export interface TodoStoreFile {
  version: 1
  todos: TodoItem[]
}

export interface ParsedTodo {
  kind: TodoKind
  title: string
  dueDate?: string
  weekdays?: number[]
}

export interface IngestResult {
  ok: true
  transcript: string
  todo: TodoItem
}

export interface IngestError {
  ok: false
  error: string
  transcript?: string
}

export type IngestResponse = IngestResult | IngestError

export interface RemindoraConfig {
  host: string
  port: number
  token: string
  dataDir: string
  timezone: string
  deepseekApiKey: string
  deepseekBaseUrl: string
  deepseekModel: string
  tencentSecretId: string
  tencentSecretKey: string
  tencentTtsVoiceType: number
  maxWavSeconds: number
}
