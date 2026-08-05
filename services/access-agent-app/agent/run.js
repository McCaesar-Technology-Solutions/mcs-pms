import { writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import os from 'node:os'
import { loadConfig, applyCloudDevices } from './config.js'

export const AGENT_VERSION = '1.2.4'

/**
 * @param {{
 *   envDir?: string
 *   log?: (level: 'info'|'warn'|'error', message: string) => void
 *   onStatus?: (status: { online: boolean; detail: string; devices: string[] }) => void
 * }} [options]
 * @returns {Promise<{ stop: () => void }>}
 */
export async function startAgent(options = {}) {
  const log =
    options.log ??
    ((level, message) => {
      const line = `[mojo-access-agent] ${message}`
      if (level === 'error') console.error(line)
      else if (level === 'warn') console.warn(line)
      else console.log(line)
    })

  const envDir = options.envDir || process.cwd()
  const config = loadConfig({ envDir })

  function headers() {
    return {
      Authorization: `Bearer ${config.agentToken}`,
      'Content-Type': 'application/json',
      'X-Mojo-Hotel-Id': config.hotelId,
      'X-Mojo-Agent-Id': config.agentId,
      'X-Mojo-Agent-Hostname': os.hostname(),
    }
  }

  async function api(path, init = {}) {
    const res = await fetch(`${config.apiUrl}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(20000),
      headers: { ...headers(), ...(init.headers ?? {}) },
    })
    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { raw: text }
    }
    if (!res.ok) {
      throw new Error(`${path} → ${res.status}: ${json?.error ?? text}`)
    }
    return json
  }

  let lastDeviceRefreshAt = 0
  let apiBackoffUntil = 0
  const DEVICE_REFRESH_MS = Number(process.env.DEVICE_REFRESH_MS ?? 5 * 60 * 1000)

  async function apiWithBackoff(path, init = {}) {
    if (Date.now() < apiBackoffUntil) {
      throw new Error(`${path} → skipped (backing off after rate limit)`)
    }
    try {
      return await api(path, init)
    } catch (err) {
      if (String(err.message).includes('429')) {
        apiBackoffUntil = Date.now() + 30_000
        log('warn', 'Rate limited by MOJO — pausing API calls for 30s')
      }
      throw err
    }
  }

  async function refreshDevicesFromCloud({ force = false } = {}) {
    if (config.deviceSource === 'local') return
    const now = Date.now()
    if (!force && config.devices.size && now - lastDeviceRefreshAt < DEVICE_REFRESH_MS) {
      return
    }
    const data = await apiWithBackoff('/api/access/agent/devices')
    lastDeviceRefreshAt = Date.now()
    if (data.mode === 'local') {
      if (!config.devices.size) {
        throw new Error(
          'MOJO is in local credential mode, but this agent has no DEVICES. Set DEVICES or switch MOJO to cloud mode.',
        )
      }
      return
    }
    applyCloudDevices(config, data.devices)
    log(
      'info',
      `Loaded ${config.devices.size} controller(s) from MOJO: ${[...config.devices.keys()].join(', ')}`,
    )
  }

  async function heartbeat() {
    if (config.deviceSource !== 'local') {
      try {
        await refreshDevicesFromCloud()
      } catch (err) {
        if (!String(err.message).includes('skipped')) {
          log('warn', `Device refresh failed: ${err.message}`)
        }
      }
    }

    const devices = []
    for (const [key, device] of config.devices) {
      let online = false
      let model = null
      let serialNumber = null
      let firmware = null
      try {
        const info = await device.deviceInfo()
        online = true
        model = info?.model ?? info?.deviceName ?? null
        serialNumber = info?.serialNumber ?? null
        firmware = info?.firmwareVersion ?? null
      } catch (err) {
        log(
          'warn',
          `Device ${key} unreachable at ${device.baseUrl()}: ${err.message} (PC must be on same LAN as controller)`,
        )
      }
      devices.push({
        deviceKey: key,
        label: key,
        model,
        serialNumber,
        firmware,
        online,
      })
    }

    await apiWithBackoff('/api/access/agent/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        version: AGENT_VERSION,
        hostname: os.hostname(),
        devices,
      }),
    })

    const onlineKeys = devices.filter((d) => d.online).map((d) => d.deviceKey)
    options.onStatus?.({
      online: true,
      detail: `Synced with MOJO · ${onlineKeys.length}/${devices.length} controllers reachable`,
      devices: onlineKeys,
    })
  }

  function devicesForDoors(doors = []) {
    const keys = [...new Set(doors.map((d) => d.deviceKey))]
    return keys.map((key) => {
      const device = config.devices.get(key)
      if (!device) throw new Error(`Unknown device key "${key}" — not in agent devices`)
      return device
    })
  }

  async function handleJob(job) {
    const { type, payload } = job
    log('info', `Job ${job.id} ${type}`)

    if (type === 'unlock') {
      const device = config.devices.get(payload.deviceKey)
      if (!device) throw new Error(`Unknown device key "${payload.deviceKey}"`)
      await device.remoteOpen(payload.doorNo ?? 1)
      return { unlocked: true, deviceKey: payload.deviceKey, doorNo: payload.doorNo }
    }

    if (type === 'revoke') {
      for (const device of config.devices.values()) {
        try {
          await device.deleteUser(payload.employeeNo)
        } catch (err) {
          log('warn', `Revoke on ${device.key}: ${err.message}`)
        }
      }
      return { revoked: true, employeeNo: payload.employeeNo }
    }

    if (type === 'provision' || type === 'assign_card' || type === 'update_validity') {
      const doors = payload.doors ?? []
      const targets = doors.length ? devicesForDoors(doors) : [...config.devices.values()]

      for (const device of targets) {
        await device.upsertUser({
          employeeNo: payload.employeeNo,
          name: payload.displayName ?? payload.employeeNo,
          validFrom: payload.validFrom,
          validTo: payload.validTo,
        })
        if (payload.cardNo) {
          await device.upsertCard({
            employeeNo: payload.employeeNo,
            cardNo: payload.cardNo,
          })
        }
        if (payload.doorPin) {
          await device.setDoorPin({
            employeeNo: payload.employeeNo,
            doorPin: payload.doorPin,
          })
        }
      }
      return {
        provisioned: true,
        employeeNo: payload.employeeNo,
        devices: targets.map((d) => d.key),
      }
    }

    throw new Error(`Unsupported job type: ${type}`)
  }

  async function pollOnce() {
    const { jobs } = await apiWithBackoff('/api/access/agent/jobs', {
      method: 'POST',
      body: JSON.stringify({ limit: 10 }),
    })

    for (const job of jobs ?? []) {
      try {
        const result = await handleJob(job)
        await apiWithBackoff(`/api/access/agent/jobs/${job.id}/complete`, {
          method: 'POST',
          body: JSON.stringify({ success: true, result }),
        })
        log('info', `Job ${job.id} succeeded`)
      } catch (err) {
        log('error', `Job ${job.id} failed: ${err.message}`)
        await apiWithBackoff(`/api/access/agent/jobs/${job.id}/complete`, {
          method: 'POST',
          body: JSON.stringify({ success: false, error: err.message }),
        }).catch((e) => log('error', `Complete report failed: ${e.message}`))
      }
    }
  }

  log('info', `v${AGENT_VERSION} hotel=${config.hotelId}`)
  log('info', `device source: ${config.deviceSource}`)

  if (config.deviceSource !== 'local') {
    try {
      await refreshDevicesFromCloud({ force: true })
    } catch (err) {
      log('warn', `Initial device refresh failed: ${err.message}`)
    }
  } else {
    log('info', `devices: ${[...config.devices.keys()].join(', ')}`)
  }

  const timers = []
  const loop = (fn, ms, label) => {
    const run = async () => {
      try {
        await fn()
      } catch (err) {
        log('error', `${label}: ${err.message}`)
        options.onStatus?.({
          online: false,
          detail: err.message,
          devices: [...config.devices.keys()],
        })
      }
    }
    // Fire-and-forget first tick so UI is never blocked on LAN device timeouts
    void run()
    timers.push(setInterval(run, ms))
  }

  loop(heartbeat, config.heartbeatMs, 'heartbeat')
  loop(pollOnce, config.pollMs, 'poll')

  options.onStatus?.({
    online: true,
    detail: 'Agent running — syncing…',
    devices: [...config.devices.keys()],
  })

  return {
    stop() {
      for (const t of timers) clearInterval(t)
    },
  }
}

/** Write agent settings file (used by desktop first-run). */
export function writeAgentEnvFile(envDir, contents) {
  const path = resolve(envDir, '.env')
  writeFileSync(path, contents.endsWith('\n') ? contents : `${contents}\n`, 'utf8')
  return path
}

export function agentEnvExists(envDir) {
  return existsSync(resolve(envDir, '.env'))
}
