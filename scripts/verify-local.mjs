/**
 * Capture local HTTP verification artifacts under docs/verify/.
 * Requires: npm start already running, and .env filled.
 *
 * Usage (PowerShell):
 *   node scripts/verify-local.mjs
 */
import { readFileSync } from 'node:fs'
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const verifyDir = path.join(root, 'docs', 'verify')

function loadDotEnv() {
  try {
    const text = readFileSync(path.join(root, '.env'), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const key = t.slice(0, eq).trim()
      let value = t.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
  } catch {
    // optional
  }
}

loadDotEnv()

const base = `http://127.0.0.1:${process.env.REMINDORA_PORT || '3090'}`
const token = process.env.REMINDORA_TOKEN || 'change-me'
const headers = {
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
}

async function main() {
  await mkdir(verifyDir, { recursive: true })
  const notes = []

  const health = await fetch(`${base}/v1/health`)
  notes.push(`health ${health.status}: ${await health.text()}`)

  const ingest = await fetch(`${base}/v1/ingest/text`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: '明天提醒我带英语书', source: 'verify' }),
  })
  const ingestBody = await ingest.text()
  await writeFile(path.join(verifyDir, '05-text-ingest.json'), `${ingestBody}\n`, 'utf8')
  notes.push(`ingest/text ${ingest.status}`)

  const b1 = await fetch(`${base}/v1/briefing/today`, { headers })
  const etag1 = b1.headers.get('etag')
  const date1 = b1.headers.get('x-briefing-date')
  const buf1 = Buffer.from(await b1.arrayBuffer())
  if (b1.ok) {
    await writeFile(path.join(verifyDir, `briefing-${date1}.mp3`), buf1)
  }

  const b2 = await fetch(`${base}/v1/briefing/today`, { headers })
  const etag2 = b2.headers.get('etag')
  await writeFile(
    path.join(verifyDir, '06-briefing-cached.txt'),
    [
      `status1=${b1.status}`,
      `etag1=${etag1}`,
      `date1=${date1}`,
      `bytes1=${buf1.length}`,
      `status2=${b2.status}`,
      `etag2=${etag2}`,
      `sameEtag=${etag1 === etag2}`,
    ].join('\n') + '\n',
    'utf8',
  )
  notes.push(`briefing etags equal: ${etag1 === etag2}`)

  const ingest2 = await fetch(`${base}/v1/ingest/text`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: '每天提醒我带钥匙', source: 'verify' }),
  })
  await ingest2.text()
  const b3 = await fetch(`${base}/v1/briefing/today`, {
    headers: { ...headers, 'if-none-match': etag1 ?? '' },
  })
  await writeFile(
    path.join(verifyDir, '07-cache-unchanged.txt'),
    [
      `afterNewTodo status=${b3.status}`,
      `etagAfter=${b3.headers.get('etag')}`,
      `ifNoneMatch=${etag1}`,
      `unchanged=${b3.status === 304 || b3.headers.get('etag') === etag1}`,
    ].join('\n') + '\n',
    'utf8',
  )
  notes.push(`cache unchanged: ${b3.status === 304 || b3.headers.get('etag') === etag1}`)

  const wavPath = process.env.REMINDORA_VERIFY_WAV
  if (wavPath) {
    const wav = await readFile(wavPath)
    const audioRes = await fetch(`${base}/v1/ingest`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'audio/wav',
      },
      body: wav,
    })
    const audioBody = await audioRes.text()
    await writeFile(path.join(verifyDir, '08-wav-ingest.json'), `${audioBody}\n`, 'utf8')
    notes.push(`wav ingest ${audioRes.status}`)
  } else {
    notes.push('wav ingest skipped (set REMINDORA_VERIFY_WAV)')
  }

  await writeFile(
    path.join(verifyDir, 'local-run-notes.txt'),
    notes.join('\n') + '\n',
    'utf8',
  )
  console.log(notes.join('\n'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
