import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { HikvisionDevice } from './isapi.js'

function loadDotEnv() {
  const path = resolve(process.cwd(), '.env')
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadDotEnv()

function requireEnv(name) {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Missing required env: ${name}`)
  return v
}

export function loadConfig() {
  const apiUrl = requireEnv('MOJO_API_URL').replace(/\/$/, '')
  const hotelId = requireEnv('HOTEL_ID')
  const agentToken = requireEnv('AGENT_TOKEN')
  const agentId = process.env.AGENT_ID?.trim() || 'hikvision-agent'
  const pollMs = Number(process.env.POLL_INTERVAL_MS ?? 5000)
  const heartbeatMs = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 30000)

  let devicesRaw = process.env.DEVICES?.trim()
  if (!devicesRaw) throw new Error('DEVICES env JSON array is required')
  const deviceConfigs = JSON.parse(devicesRaw)
  if (!Array.isArray(deviceConfigs) || !deviceConfigs.length) {
    throw new Error('DEVICES must be a non-empty JSON array')
  }

  const devices = new Map()
  for (const d of deviceConfigs) {
    if (!d.key || !d.host || !d.username || !d.password) {
      throw new Error('Each device needs key, host, username, password')
    }
    devices.set(d.key, new HikvisionDevice(d))
  }

  return { apiUrl, hotelId, agentToken, agentId, pollMs, heartbeatMs, devices }
}
