import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { hitsDate } from './dates.js'
import type { TodoItem, TodoKind, TodoStatus, TodoStoreFile } from './types.js'

const EMPTY: TodoStoreFile = { version: 1, todos: [] }

export class TodoStore {
  private readonly filePath: string
  private cache: TodoStoreFile | null = null

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'todos.json')
  }

  async init(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    try {
      await this.load()
    } catch {
      await this.save(EMPTY)
    }
  }

  async listAll(): Promise<TodoItem[]> {
    const data = await this.load()
    return [...data.todos]
  }

  async listForDate(localDate: string): Promise<TodoItem[]> {
    const data = await this.load()
    return data.todos.filter((t) => hitsDate(t, localDate))
  }

  async add(input: {
    kind: TodoKind
    title: string
    rawText: string
    source: string
    dueDate?: string
    weekdays?: number[]
  }): Promise<TodoItem> {
    const data = await this.load()
    const item: TodoItem = {
      id: randomUUID(),
      kind: input.kind,
      title: input.title.trim(),
      rawText: input.rawText,
      source: input.source,
      status: 'active',
      createdAt: new Date().toISOString(),
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      ...(input.weekdays ? { weekdays: [...input.weekdays].sort((a, b) => a - b) } : {}),
    }
    data.todos.push(item)
    await this.save(data)
    return item
  }

  async update(
    id: string,
    patch: {
      title?: string
      status?: TodoStatus
      dueDate?: string | null
      weekdays?: number[] | null
      kind?: TodoKind
    },
  ): Promise<TodoItem | null> {
    const data = await this.load()
    const item = data.todos.find((t) => t.id === id)
    if (!item) return null
    if (patch.title !== undefined) item.title = patch.title.trim()
    if (patch.status !== undefined) item.status = patch.status
    if (patch.kind !== undefined) item.kind = patch.kind
    if (patch.dueDate === null) delete item.dueDate
    else if (patch.dueDate !== undefined) item.dueDate = patch.dueDate
    if (patch.weekdays === null) delete item.weekdays
    else if (patch.weekdays !== undefined) {
      item.weekdays = [...patch.weekdays].sort((a, b) => a - b)
    }
    await this.save(data)
    return item
  }

  private async load(): Promise<TodoStoreFile> {
    if (this.cache) return this.cache
    const raw = await readFile(this.filePath, 'utf8')
    const parsed = JSON.parse(raw) as TodoStoreFile
    if (parsed.version !== 1 || !Array.isArray(parsed.todos)) {
      throw new Error('invalid todos.json')
    }
    this.cache = parsed
    return parsed
  }

  private async save(data: TodoStoreFile): Promise<void> {
    const tmp = `${this.filePath}.${process.pid}.tmp`
    await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    await rename(tmp, this.filePath)
    this.cache = data
  }
}
