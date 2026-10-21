/**
 * Run Remindora without loading it as a Cordis plugin.
 *
 *   npm start
 */
import { startRemindora } from './app.js'
import { loadRemindoraEnv } from './env.js'

const envFiles = loadRemindoraEnv()
if (envFiles.length) {
  console.log(`[remindora] loaded env from: ${envFiles.join(', ')}`)
}

const { server } = await startRemindora()

const shutdown = () => {
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
