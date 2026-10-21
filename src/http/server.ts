import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { formatLocalDate } from '../dates.js'
import { ingestText } from '../ingest.js'
import { transcribeWav } from '../asr/tencent.js'
import type { BriefingService } from '../briefing.js'
import type { ChatClient } from '../chat.js'
import type { TodoStore } from '../store.js'
import type { RemindoraConfig } from '../types.js'

const MAX_BODY = 3 * 1024 * 1024

export interface RemindoraApp {
  config: RemindoraConfig
  store: TodoStore
  briefing: BriefingService
  chat: ChatClient
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const data = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': data.length,
  })
  res.end(data)
}

function unauthorized(res: ServerResponse): void {
  sendJson(res, 401, { ok: false, error: 'unauthorized' })
}

function checkAuth(req: IncomingMessage, config: RemindoraConfig): boolean {
  const header = req.headers.authorization ?? ''
  const expected = `Bearer ${config.token}`
  return header === expected
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > limit) {
      throw new Error('payload too large')
    }
    chunks.push(buf)
  }
  return Buffer.concat(chunks)
}

function estimateWavSeconds(buf: Buffer): number {
  // PCM 16kHz 16-bit mono ≈ 32000 bytes/sec after 44-byte header
  const payload = Math.max(0, buf.length - 44)
  return payload / 32000
}

export function createHttpServer(app: RemindoraApp): Server {
  const { config, store, briefing, chat } = app

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
      const method = req.method ?? 'GET'

      if (method === 'GET' && url.pathname === '/v1/health') {
        sendJson(res, 200, {
          ok: true,
          service: 'remindora',
          timezone: config.timezone,
          today: formatLocalDate(new Date(), config.timezone),
        })
        return
      }

      if (!checkAuth(req, config)) {
        unauthorized(res)
        return
      }

      if (method === 'POST' && url.pathname === '/v1/ingest/text') {
        const raw = await readBody(req, 64 * 1024)
        let body: { text?: string; source?: string }
        try {
          body = JSON.parse(raw.toString('utf8')) as { text?: string; source?: string }
        } catch {
          sendJson(res, 400, { ok: false, error: 'invalid json' })
          return
        }
        const text = (body.text ?? '').trim()
        if (!text) {
          sendJson(res, 400, { ok: false, error: 'text required' })
          return
        }
        const source = (body.source ?? 'text').trim() || 'text'
        const result = await ingestText(store, config, chat, text, source)
        sendJson(res, result.ok ? 200 : 422, result)
        return
      }

      if (method === 'POST' && url.pathname === '/v1/ingest') {
        const wav = await readBody(req, MAX_BODY)
        if (wav.length < 44) {
          sendJson(res, 400, { ok: false, error: 'invalid wav' })
          return
        }
        const seconds = estimateWavSeconds(wav)
        if (seconds > config.maxWavSeconds + 0.5) {
          sendJson(res, 400, { ok: false, error: `audio longer than ${config.maxWavSeconds}s` })
          return
        }
        let transcript: string
        try {
          transcript = await transcribeWav(wav, config)
        } catch (err) {
          sendJson(res, 502, {
            ok: false,
            error: err instanceof Error ? err.message : 'asr failed',
          })
          return
        }
        const result = await ingestText(store, config, chat, transcript, 'audio')
        sendJson(res, result.ok ? 200 : 422, result)
        return
      }

      if (method === 'GET' && url.pathname === '/v1/briefing/today') {
        const file = await briefing.getToday()
        const inm = req.headers['if-none-match']
        if (inm && inm === file.etag) {
          res.writeHead(304, {
            etag: file.etag,
            'x-briefing-date': file.date,
          })
          res.end()
          return
        }
        res.writeHead(200, {
          'content-type': 'audio/mpeg',
          'content-length': file.buffer.length,
          etag: file.etag,
          'x-briefing-date': file.date,
          'cache-control': 'private, max-age=0, must-revalidate',
        })
        res.end(file.buffer)
        return
      }

      if (method === 'GET' && url.pathname === '/v1/todos') {
        const date = url.searchParams.get('date')
          ?? formatLocalDate(new Date(), config.timezone)
        const todos = await store.listForDate(date)
        sendJson(res, 200, { ok: true, date, todos })
        return
      }

      if (method === 'PATCH' && url.pathname.startsWith('/v1/todos/')) {
        const id = url.pathname.slice('/v1/todos/'.length)
        const raw = await readBody(req, 64 * 1024)
        let patch: Record<string, unknown>
        try {
          patch = JSON.parse(raw.toString('utf8')) as Record<string, unknown>
        } catch {
          sendJson(res, 400, { ok: false, error: 'invalid json' })
          return
        }
        const updated = await store.update(id, {
          title: typeof patch.title === 'string' ? patch.title : undefined,
          status: typeof patch.status === 'string'
            ? patch.status as 'active' | 'done' | 'cancelled'
            : undefined,
          dueDate: patch.dueDate === null
            ? null
            : typeof patch.dueDate === 'string'
              ? patch.dueDate
              : undefined,
          weekdays: patch.weekdays === null
            ? null
            : Array.isArray(patch.weekdays)
              ? patch.weekdays as number[]
              : undefined,
          kind: typeof patch.kind === 'string'
            ? patch.kind as 'once' | 'weekly' | 'daily'
            : undefined,
        })
        if (!updated) {
          sendJson(res, 404, { ok: false, error: 'not found' })
          return
        }
        sendJson(res, 200, { ok: true, todo: updated })
        return
      }

      sendJson(res, 404, { ok: false, error: 'not found' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'server error'
      if (message === 'payload too large') {
        sendJson(res, 413, { ok: false, error: message })
        return
      }
      sendJson(res, 500, { ok: false, error: message })
    }
  })
}

export async function listenHttp(app: RemindoraApp): Promise<Server> {
  const server = createHttpServer(app)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(app.config.port, app.config.host, () => resolve())
  })
  return server
}
