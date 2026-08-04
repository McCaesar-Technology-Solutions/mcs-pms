import os from 'node:os'
import { loadConfig, applyCloudDevices } from './config.js'

const VERSION = '1.0.1'

const config = loadConfig()

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

async function refreshDevicesFromCloud() {
  if (config.deviceSource === 'local') return
  const data = await api('/api/access/agent/devices')
  if (data.mode === 'local') {
    if (!config.devices.size) {
      throw new Error(
        'MOJO is in local credential mode, but this agent has no DEVICES. Set DEVICES or switch MOJO to cloud mode.',
      )
    }
    return
  }
  applyCloudDevices(config, data.devices)
  console.log(
    `[devices] loaded ${config.devices.size} controller(s) from MOJO cloud: ${[...config.devices.keys()].join(', ')}`,
  )
}

async function heartbeat() {
  if (config.deviceSource !== 'local') {
    try {
      await refreshDevicesFromCloud()
    } catch (err) {
      console.warn('[devices] refresh failed:', err.message)
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
      console.warn(`[heartbeat] device ${key} unreachable:`, err.message)
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

  await api('/api/access/agent/heartbeat', {
    method: 'POST',
    body: JSON.stringify({
      version: VERSION,
      hostname: os.hostname(),
      devices,
    }),
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
  console.log(`[job] ${job.id} ${type}`)

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
        console.warn(`[revoke] ${device.key}:`, err.message)
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
  const { jobs } = await api('/api/access/agent/jobs', {
    method: 'POST',
    body: JSON.stringify({ limit: 10 }),
  })

  for (const job of jobs ?? []) {
    try {
      const result = await handleJob(job)
      await api(`/api/access/agent/jobs/${job.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ success: true, result }),
      })
      console.log(`[job] ${job.id} succeeded`)
    } catch (err) {
      console.error(`[job] ${job.id} failed:`, err.message)
      await api(`/api/access/agent/jobs/${job.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ success: false, error: err.message }),
      }).catch((e) => console.error('[complete] report failed:', e.message))
    }
  }
}

async function main() {
  console.log(`[mojo-hikvision-agent] v${VERSION} hotel=${config.hotelId}`)
  console.log(`[mojo-hikvision-agent] device source: ${config.deviceSource}`)

  if (config.deviceSource !== 'local') {
    await refreshDevicesFromCloud()
  } else {
    console.log(`[mojo-hikvision-agent] devices: ${[...config.devices.keys()].join(', ')}`)
  }

  const loop = async (fn, ms, label) => {
    const run = async () => {
      try {
        await fn()
      } catch (err) {
        console.error(`[${label}]`, err.message)
      }
    }
    await run()
    setInterval(run, ms)
  }

  await loop(heartbeat, config.heartbeatMs, 'heartbeat')
  await loop(pollOnce, config.pollMs, 'poll')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
