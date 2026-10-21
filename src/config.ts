import path from 'node:path'
import type { RemindoraConfig } from './types.js'

function env(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim()
}

export function loadConfig(overrides: Partial<RemindoraConfig> = {}): RemindoraConfig {
  const dataDir = path.resolve(env('REMINDORA_DATA_DIR', './data'))
  const voice = Number(env('TENCENT_TTS_VOICE_TYPE', '101001'))
  return {
    host: env('REMINDORA_HOST', '0.0.0.0'),
    port: Number(env('REMINDORA_PORT', '3090')) || 3090,
    token: env('REMINDORA_TOKEN', 'change-me'),
    dataDir,
    timezone: env('REMINDORA_TIMEZONE', 'Asia/Shanghai'),
    deepseekApiKey: env('DEEPSEEK_API_KEY'),
    deepseekBaseUrl: env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com').replace(/\/$/, ''),
    deepseekModel: env('DEEPSEEK_MODEL', 'deepseek-chat'),
    tencentSecretId: env('TENCENT_SECRET_ID'),
    tencentSecretKey: env('TENCENT_SECRET_KEY'),
    tencentTtsVoiceType: Number.isFinite(voice) ? voice : 101001,
    maxWavSeconds: 20,
    ...overrides,
  }
}
