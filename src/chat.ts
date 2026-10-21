import type { RemindoraConfig } from './types.js'

export interface ChatRequest {
  system: string
  user: string
  temperature?: number
}

/** Minimal chat seam used by todo parsing and briefing copy. */
export interface ChatClient {
  readonly kind: 'env' | 'harness'
  complete(request: ChatRequest): Promise<string>
}

export class ChatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChatError'
  }
}

/** Standalone / fallback: OpenAI-compatible HTTP using Remindora env. */
export function createEnvChatClient(config: RemindoraConfig): ChatClient {
  return {
    kind: 'env',
    async complete(request) {
      if (!config.deepseekApiKey) {
        throw new ChatError('未配置 DEEPSEEK_API_KEY（独立进程需要此项；插件模式应复用 Harness 模型）')
      }
      const base = config.deepseekBaseUrl.replace(/\/$/, '')
      const url = base.endsWith('/v1')
        ? `${base}/chat/completions`
        : `${base}/v1/chat/completions`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.deepseekApiKey}`,
        },
        body: JSON.stringify({
          model: config.deepseekModel,
          temperature: request.temperature ?? 0,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
        }),
      })
      if (!res.ok) {
        const body = await res.text()
        throw new ChatError(`模型请求失败: ${res.status} ${body.slice(0, 200)}`)
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = data.choices?.[0]?.message?.content
      if (!content) {
        throw new ChatError('模型返回空内容')
      }
      return content
    },
  }
}

type HarnessCtx = {
  llm: {
    stream: (options: Record<string, unknown>) => AsyncIterable<Record<string, unknown>>
  }
  agentDefaultModel: {
    currentSelection: () => {
      provider: string
      model: string
      reasoningEffort?: string
    }
  }
}

/** Plugin mode: reuse Harness default provider/model and credentials via ctx.llm. */
export function createHarnessChatClient(ctx: HarnessCtx): ChatClient {
  return {
    kind: 'harness',
    async complete(request) {
      const { createUserMessage } = await import('@deepseek-ai/dsh-llm') as {
        createUserMessage: (input: Record<string, unknown>) => unknown
      }
      const selection = ctx.agentDefaultModel.currentSelection()
      if (!selection?.provider || !selection?.model) {
        throw new ChatError('Harness 未配置默认模型（Settings → 默认模型）')
      }

      const overrideProvider = process.env.REMINDORA_LLM_PROVIDER?.trim()
      const overrideModel = process.env.REMINDORA_LLM_MODEL?.trim()
      const provider = overrideProvider || selection.provider
      const model = overrideModel || selection.model

      console.log(`[remindora] llm via harness provider=${provider} model=${model}`)

      let text = ''
      let finish: Record<string, unknown> | undefined
      for await (const chunk of ctx.llm.stream({
        provider,
        model,
        ...(selection.reasoningEffort && !overrideProvider
          ? { reasoningEffort: selection.reasoningEffort }
          : {}),
        system: request.system,
        temperature: request.temperature ?? 0,
        messages: [
          createUserMessage({
            content: [{ type: 'text', text: request.user }],
            source: { kind: 'user' },
          }),
        ],
      })) {
        if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
          text += chunk.text
        }
        if (chunk.type === 'finish') {
          finish = chunk.reason as Record<string, unknown>
        }
      }

      if (finish && (finish.kind === 'error' || finish.kind === 'aborted')) {
        const failure = finish.failure as { message?: string; code?: string } | undefined
        throw new ChatError(
          `Harness 模型调用失败: ${failure?.code ?? finish.kind} ${failure?.message ?? ''}`.trim(),
        )
      }
      if (!text.trim()) {
        throw new ChatError('Harness 模型返回空内容')
      }
      return text
    },
  }
}
