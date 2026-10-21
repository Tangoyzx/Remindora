import { BriefingService } from './briefing.js'
import { createEnvChatClient, type ChatClient } from './chat.js'
import { loadConfig } from './config.js'
import { listenHttp, type RemindoraApp } from './http/server.js'
import { TodoStore } from './store.js'
import type { RemindoraConfig } from './types.js'

export async function createApp(
  overrides: Partial<RemindoraConfig> = {},
  chat?: ChatClient,
): Promise<RemindoraApp> {
  const config = loadConfig(overrides)
  const store = new TodoStore(config.dataDir)
  await store.init()
  const chatClient = chat ?? createEnvChatClient(config)
  const briefing = new BriefingService(store, config, chatClient)
  await briefing.init()
  return { config, store, briefing, chat: chatClient }
}

export async function startRemindora(
  overrides: Partial<RemindoraConfig> = {},
  chat?: ChatClient,
): Promise<{ app: RemindoraApp; server: Awaited<ReturnType<typeof listenHttp>> }> {
  const app = await createApp(overrides, chat)
  const server = await listenHttp(app)
  const addr = `http://${app.config.host === '0.0.0.0' ? '127.0.0.1' : app.config.host}:${app.config.port}`
  console.log(`[remindora] listening on ${addr}`)
  console.log(`[remindora] data dir ${app.config.dataDir}`)
  console.log(`[remindora] timezone ${app.config.timezone}`)
  console.log(`[remindora] chat backend: ${app.chat.kind}`)
  return { app, server }
}
