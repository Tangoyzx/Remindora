import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function loadDotEnv(filePath: string): boolean {
  if (!existsSync(filePath)) return false
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
  return true
}

/** Load env for plugin or standalone. Does not override existing process.env. */
export function loadRemindoraEnv(): string[] {
  const loaded: string[] = []
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const candidates = [
    process.env.REMINDORA_ENV_FILE,
    path.join(packageRoot, '.env'),
    path.resolve(process.cwd(), '.env'),
    path.join(process.env.USERPROFILE ?? '', '.dsh', 'remindora.env'),
  ].filter((p): p is string => Boolean(p))

  for (const candidate of candidates) {
    if (loadDotEnv(candidate)) {
      loaded.push(candidate)
    }
  }
  return loaded
}
