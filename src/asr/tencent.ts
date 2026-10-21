import { asr } from 'tencentcloud-sdk-nodejs'
import type { RemindoraConfig } from '../types.js'

type AsrClient = InstanceType<typeof asr.v20190614.Client>

let client: AsrClient | null = null

function getClient(config: RemindoraConfig): AsrClient {
  if (!config.tencentSecretId || !config.tencentSecretKey) {
    throw new Error('未配置 TENCENT_SECRET_ID / TENCENT_SECRET_KEY')
  }
  if (!client) {
    client = new asr.v20190614.Client({
      credential: {
        secretId: config.tencentSecretId,
        secretKey: config.tencentSecretKey,
      },
      region: '',
      profile: {
        httpProfile: { endpoint: 'asr.tencentcloudapi.com' },
      },
    })
  }
  return client
}

export function resetAsrClient(): void {
  client = null
}

export async function transcribeWav(
  wav: Buffer,
  config: RemindoraConfig,
): Promise<string> {
  const c = getClient(config)
  const res = await c.SentenceRecognition({
    EngSerViceType: '16k_zh',
    SourceType: 1,
    VoiceFormat: 'wav',
    Data: wav.toString('base64'),
    DataLen: wav.length,
  })
  const text = (res.Result ?? '').trim()
  if (!text) {
    throw new Error('语音识别结果为空')
  }
  return text
}
