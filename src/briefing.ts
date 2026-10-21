import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ChatClient } from './chat.js'
import { formatLocalDate } from './dates.js'
import { writeBriefingScript } from './parse.js'
import type { TodoStore } from './store.js'
import { synthesizeMp3 } from './tts/tencent.js'
import type { RemindoraConfig } from './types.js'

export interface BriefingFile {
  date: string
  path: string
  buffer: Buffer
  etag: string
}

function etagOf(buf: Buffer): string {
  return `"${createHash('sha1').update(buf).digest('hex')}"`
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

export class BriefingService {
  private readonly cacheDir: string

  constructor(
    private readonly store: TodoStore,
    private readonly config: RemindoraConfig,
    private readonly chat: ChatClient,
  ) {
    this.cacheDir = path.join(config.dataDir, 'briefings')
  }

  async init(): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true })
  }

  cachePathFor(localDate: string): string {
    return path.join(this.cacheDir, `${localDate}.mp3`)
  }

  /**
   * Return today's briefing MP3. Creates it once per local date.
   * Later todos do not invalidate the cache.
   */
  async getToday(now: Date = new Date()): Promise<BriefingFile> {
    const localDate = formatLocalDate(now, this.config.timezone)
    const filePath = this.cachePathFor(localDate)

    if (await exists(filePath)) {
      const buffer = await readFile(filePath)
      return { date: localDate, path: filePath, buffer, etag: etagOf(buffer) }
    }

    const todos = await this.store.listForDate(localDate)
    const titles = todos.map((t) => t.title)
    const script = await writeBriefingScript(titles, this.config, this.chat, localDate)
    const buffer = await synthesizeMp3(script, this.config)
    await writeFile(filePath, buffer)
    await writeFile(path.join(this.cacheDir, `${localDate}.txt`), `${script}\n`, 'utf8')
    return { date: localDate, path: filePath, buffer, etag: etagOf(buffer) }
  }
}
