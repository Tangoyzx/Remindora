import { formatLocalDate } from './dates.js'
import { ingestText } from './ingest.js'
import type { RemindoraApp } from './http/server.js'

type DefineTool = (spec: Record<string, unknown>) => unknown

async function loadDefineTool(): Promise<DefineTool> {
  const mod = await import('@deepseek-ai/dsh-tools') as { defineTool?: DefineTool }
  if (typeof mod.defineTool !== 'function') {
    throw new Error('@deepseek-ai/dsh-tools.defineTool missing')
  }
  return mod.defineTool
}

const objectOut = {
  schema: { type: 'object', additionalProperties: true },
  render: (_args: unknown, value: unknown) => [
    { type: 'text', text: JSON.stringify(value, null, 2) },
  ],
}

/** Register Agent tools when Cordis `tools` is available on the Harness host. */
export async function registerTools(
  ctx: { tools: { register: (tool: unknown) => void } },
  app: RemindoraApp,
): Promise<void> {
  const defineTool = await loadDefineTool()

  ctx.tools.register(defineTool({
    name: 'remindora_add_text',
    description: 'Add a personal reminder from plain text (once / weekly / daily).',
    parameters: {
      text: {
        type: 'string',
        required: true,
        description: 'Natural language reminder, e.g. 明天提醒我带英语书',
      },
    },
    output: objectOut,
    async execute(args: { text: string }) {
      return ingestText(app.store, app.config, app.chat, args.text, 'agent')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'remindora_list',
    description: 'List Remindora todos that hit a local calendar date.',
    parameters: {
      date: {
        type: 'string',
        description: 'YYYY-MM-DD; defaults to today in plugin timezone',
      },
    },
    output: objectOut,
    async execute(args: { date?: string }) {
      const date = args.date ?? formatLocalDate(new Date(), app.config.timezone)
      const todos = await app.store.listForDate(date)
      return { date, todos }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'remindora_update',
    description: 'Update a Remindora todo: retitle, reschedule, complete, or cancel.',
    parameters: {
      id: { type: 'string', required: true, description: 'Todo id' },
      title: { type: 'string', description: 'New title' },
      status: { type: 'string', description: 'active | done | cancelled' },
      dueDate: { type: 'string', description: 'YYYY-MM-DD for once todos' },
      weekdays: {
        type: 'array',
        items: { type: 'number' },
        description: 'ISO weekdays 1-7 for weekly todos',
      },
      kind: { type: 'string', description: 'once | weekly | daily' },
    },
    output: objectOut,
    async execute(args: {
      id: string
      title?: string
      status?: 'active' | 'done' | 'cancelled'
      dueDate?: string
      weekdays?: number[]
      kind?: 'once' | 'weekly' | 'daily'
    }) {
      const todo = await app.store.update(args.id, {
        title: args.title,
        status: args.status,
        dueDate: args.dueDate,
        weekdays: args.weekdays,
        kind: args.kind,
      })
      if (!todo) return { ok: false, error: 'not found' }
      return { ok: true, todo }
    },
  }))
}
