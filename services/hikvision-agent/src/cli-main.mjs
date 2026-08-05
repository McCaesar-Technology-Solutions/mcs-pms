/**
 * Standalone entry for system Node (macOS Local Network works for CLI Node;
 * Electron GUI often gets EHOSTUNREACH until Local Network is allowed).
 */
import { startAgent } from './run.js'

const agent = await startAgent({
  envDir: process.env.MOJO_AGENT_ENV_DIR || process.cwd(),
  log: (level, message) => {
    const line = JSON.stringify({ t: Date.now(), level, message })
    console.log(line)
  },
  onStatus: (status) => {
    console.log(JSON.stringify({ t: Date.now(), type: 'status', status }))
  },
})

function shutdown() {
  try {
    agent.stop()
  } catch {
    // ignore
  }
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
