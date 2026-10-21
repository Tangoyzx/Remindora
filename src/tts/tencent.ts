import { tts } from 'tencentcloud-sdk-nodejs'
import type { RemindoraConfig } from '../types.js'

type TtsClient = InstanceType<typeof tts.v20190823.Client>

let client: TtsClient | null = null

function getClient(config: RemindoraConfig): TtsClient {
  if (!config.tencentSecretId || !config.tencentSecretKey) {
    throw new Error('未配置 TENCENT_SECRET_ID / TENCENT_SECRET_KEY')
  }
  if (!client) {
    client = new tts.v20190823.Client({
      credential: {
        secretId: config.tencentSecretId,
        secretKey: config.tencentSecretKey,
      },
      region: 'ap-guangzhou',
      profile: {
        httpProfile: { endpoint: 'tts.tencentcloudapi.com' },
      },
    })
  }
  return client
}

export function resetTtsClient(): void {
  client = null
}

const MAX_CHARS = 140

/** Split Chinese/English text into chunks under the API limit. */
export function splitForTts(text: string, maxChars = MAX_CHARS): string[] {
  const trimmed = text.trim()
  if (!trimmed) return ['今天没有待办。']
  if (trimmed.length <= maxChars) return [trimmed]

  const parts: string[] = []
  const sentences = trimmed.split(/(?<=[。！？；\n.!?;])/u).map((s) => s.trim()).filter(Boolean)
  let buf = ''
  for (const sentence of sentences.length ? sentences : [trimmed]) {
    if (sentence.length > maxChars) {
      if (buf) {
        parts.push(buf)
        buf = ''
      }
      for (let i = 0; i < sentence.length; i += maxChars) {
        parts.push(sentence.slice(i, i + maxChars))
      }
      continue
    }
    if ((buf + sentence).length > maxChars) {
      if (buf) parts.push(buf)
      buf = sentence
    } else {
      buf += sentence
    }
  }
  if (buf) parts.push(buf)
  return parts
}

async function synthesizeChunk(text: string, config: RemindoraConfig): Promise<Buffer> {
  const c = getClient(config)
  const res = await c.TextToVoice({
    Text: text,
    SessionId: `remindora-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    VoiceType: config.tencentTtsVoiceType,
    PrimaryLanguage: 1,
    SampleRate: 16000,
    Codec: 'mp3',
    ModelType: 1,
  })
  if (!res.Audio) {
    throw new Error('语音合成未返回音频')
  }
  return Buffer.from(res.Audio, 'base64')
}

export async function synthesizeMp3(
  text: string,
  config: RemindoraConfig,
): Promise<Buffer> {
  const chunks = splitForTts(text)
  const buffers: Buffer[] = []
  for (const chunk of chunks) {
    buffers.push(await synthesizeChunk(chunk, config))
  }
  return Buffer.concat(buffers)
}
