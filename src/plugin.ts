/**
 * Cordis entry for DeepSeek Harness.
 *
 * Uses ctx.llm + ctx.agentDefaultModel so Remindora reuses the same provider,
 * model, and credentials already configured in Harness Settings.
 */
import type { Server } from 'node:http'
import { startRemindora } from './app.js'
import { createHarnessChatClient } from './chat.js'
import { loadRemindoraEnv } from './env.js'
import { registerTools } from './tools.js'
import type { RemindoraApp } from './http/server.js'

export const name = 'remindora'
export const inject = ['tools', 'llm', 'agentDefaultModel']

export function apply(ctx: any) {
  let server: Server | undefined
  let app: RemindoraApp | undefined
  let closed = false

  const boot = async () => {
    const envFiles = loadRemindoraEnv()
    if (envFiles.length) {
      console.log(`[remindora] loaded env from: ${envFiles.join(', ')}`)
    }

    const chat = createHarnessChatClient(ctx)
    const selection = ctx.agentDefaultModel.currentSelection()
    console.log(
      `[remindora] harness default model: ${selection.provider}/${selection.model}`,
    )

    const started = await startRemindora({}, chat)
    if (closed) {
      started.server.close()
      return
    }
    app = started.app
    server = started.server
    try {
      await registerTools(ctx, app)
      console.log('[remindora] agent tools registered')
    } catch (err) {
      console.warn(
        '[remindora] HTTP API is up; agent tools skipped:',
        err instanceof Error ? err.message : err,
      )
    }
  }

  void boot().catch((err) => {
    console.error('[remindora] failed to start', err)
  })

  ctx.effect(() => () => {
    closed = true
    server?.close()
    server = undefined
    app = undefined
  })
}

export default { name, inject, apply }
