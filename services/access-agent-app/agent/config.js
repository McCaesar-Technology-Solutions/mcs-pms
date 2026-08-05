import { resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { HikvisionDevice } from './isapi.js'

function loadDotEnv(envDir) {
  const path = resolve(envDir, '.env')
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

function requireEnv(name) {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Missing required env: ${name}`)
  return v
}

const LEGACY_API_HOSTS = new Set(['mcs-pms.vercel.app', 'www.mcs-pms.vercel.app'])
const DEFAULT_API_ORIGIN = 'https://portal.mojoapartmentsgh.com'

/** Origin only — strips paths like /owner/access and adds https if missing. */
function normalizeApiUrl(raw) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) throw new Error('MOJO_API_URL is empty')
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withProtocol)
    const host = url.host.toLowerCase()
    if (LEGACY_API_HOSTS.has(host)) return DEFAULT_API_ORIGIN
    return `${url.protocol}//${url.host}`
  } catch {
    throw new Error(
      `Invalid MOJO_API_URL "${raw}". Use your site origin only, e.g. ${DEFAULT_API_ORIGIN}`,
    )
  }
}

function devicesFromLocalEnv() {
  const devicesRaw = process.env.DEVICES?.trim()
  if (!devicesRaw) return null
  const deviceConfigs = JSON.parse(devicesRaw)
  if (!Array.isArray(deviceConfigs) || !deviceConfigs.length) {
    throw new Error('DEVICES must be a non-empty JSON array when set')
  }
  const devices = new Map()
  for (const d of deviceConfigs) {
    if (!d.key || !d.host || !d.username || !d.password) {
      throw new Error('Each device needs key, host, username, password')
    }
    devices.set(d.key, new HikvisionDevice(d))
  }
  return devices
}

/**
 * @param {{ envDir?: string }} [options]
 */
export function loadConfig(options = {}) {
  const envDir = options.envDir || process.cwd()
  loadDotEnv(envDir)

  const apiUrl = normalizeApiUrl(requireEnv('MOJO_API_URL'))
  const hotelId = requireEnv('HOTEL_ID')
  const agentToken = requireEnv('AGENT_TOKEN')
  const agentId = process.env.AGENT_ID?.trim() || 'hikvision-agent'
  const pollMs = Number(process.env.POLL_INTERVAL_MS ?? 5000)
  const heartbeatMs = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 30000)
  const source = (process.env.DEVICE_SOURCE?.trim() || 'auto').toLowerCase()

  const localDevices = (() => {
    try {
      return devicesFromLocalEnv()
    } catch (err) {
      if (source === 'local') throw err
      return null
    }
  })()

  /** @type {'local' | 'cloud' | 'auto'} */
  let deviceSource = 'auto'
  if (source === 'local' || source === 'cloud') deviceSource = source
  else if (localDevices?.size) deviceSource = 'local'
  else deviceSource = 'cloud'

  if (deviceSource === 'local' && !localDevices?.size) {
    throw new Error('DEVICE_SOURCE=local requires DEVICES in .env')
  }

  return {
    apiUrl,
    hotelId,
    agentToken,
    agentId,
    pollMs,
    heartbeatMs,
    deviceSource,
    devices: localDevices ?? new Map(),
    envDir,
  }
}

export function applyCloudDevices(config, deviceList) {
  const devices = new Map()
  for (const d of deviceList ?? []) {
    if (!d.key || !d.host || !d.username || !d.password) continue
    devices.set(d.key, new HikvisionDevice(d))
  }
  if (!devices.size) {
    throw new Error('Cloud mode: no controllers configured in MOJO Access yet')
  }
  config.devices = devices
  return devices
}
