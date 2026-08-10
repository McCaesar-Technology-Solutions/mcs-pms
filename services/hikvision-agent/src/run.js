import { writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import os from 'node:os'
import { loadConfig, applyCloudDevices } from './config.js'

export const AGENT_VERSION = '1.3.6'

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
  let loggedBackoff = false
  const DEVICE_REFRESH_MS = Number(process.env.DEVICE_REFRESH_MS ?? 5 * 60 * 1000)
  const RATE_LIMIT_BACKOFF_MS = Number(process.env.RATE_LIMIT_BACKOFF_MS ?? 60_000)

  function backoffRemainingMs() {
    return Math.max(0, apiBackoffUntil - Date.now())
  }

  async function apiWithBackoff(path, init = {}) {
    if (Date.now() < apiBackoffUntil) {
      const err = new Error(`${path} → skipped (backing off after rate limit)`)
      err.code = 'RATE_LIMIT_BACKOFF'
      throw err
    }
    try {
      const json = await api(path, init)
      loggedBackoff = false
      return json
    } catch (err) {
      if (String(err.message).includes('429')) {
        apiBackoffUntil = Date.now() + RATE_LIMIT_BACKOFF_MS
        if (!loggedBackoff) {
          loggedBackoff = true
          log(
            'warn',
            `Rate limited by MOJO — pausing API calls for ${Math.round(RATE_LIMIT_BACKOFF_MS / 1000)}s`,
          )
        }
        const limited = new Error(err.message)
        limited.code = 'RATE_LIMIT_BACKOFF'
        throw limited
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
          `Device ${key} unreachable at ${device.baseUrl()}: ${err.message}. If Terminal can reach this IP, quit & reopen the agent and allow Local Network access for MOJO Access Agent.`,
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

  function doorDevices() {
    return [...config.devices.values()].filter(
      (d) => d.role !== 'enrollment' && d.role !== 'attendance',
    )
  }

  /**
   * Group payload doors by controller, collecting door numbers per device.
   * Requires a non-empty doors list — never falls back to all devices.
   */
  function targetsFromDoors(doors = []) {
    if (!Array.isArray(doors) || !doors.length) {
      throw new Error('Job has no door targets — map doors / access policy before syncing.')
    }
    const byKey = new Map()
    for (const d of doors) {
      const key = d.deviceKey
      if (!key) continue
      const device = config.devices.get(key)
      if (!device) throw new Error(`Unknown device key "${key}" — not in agent devices`)
      if (device.role === 'enrollment' || device.role === 'attendance') {
        throw new Error(`Device "${key}" is not a door controller (role: ${device.role})`)
      }
      const doorNo = Number(d.doorNo ?? 1)
      const n = Number.isFinite(doorNo) && doorNo >= 1 ? doorNo : 1
      const entry = byKey.get(key) ?? { device, doorNos: new Set() }
      entry.doorNos.add(n)
      byKey.set(key, entry)
    }
    const targets = [...byKey.values()].map(({ device, doorNos }) => ({
      device,
      doorNos: [...doorNos].sort((a, b) => a - b),
    }))
    if (!targets.length) {
      throw new Error('Job door list did not resolve to any door controllers.')
    }
    return targets
  }

  function enrollmentDevice(deviceKey) {
    const device = deviceKey ? config.devices.get(deviceKey) : null
    if (device?.role === 'enrollment') return device
    const fallback = [...config.devices.values()].find((d) => d.role === 'enrollment')
    if (!fallback) {
      throw new Error(
        'No enrollment station in agent devices. Save DS-K1F600U-D6E-F in Owner → Access (role: Enrollment).',
      )
    }
    return fallback
  }

  function attendanceDevice(deviceKey) {
    const device = deviceKey ? config.devices.get(deviceKey) : null
    if (device?.role === 'attendance') return device
    const fallback = [...config.devices.values()].find((d) => d.role === 'attendance')
    if (!fallback) {
      throw new Error(
        'No attendance terminal in agent devices. Save DS-K1A8503MF-B in Owner → Access (role: Attendance).',
      )
    }
    return fallback
  }

  async function handleJob(job) {
    const { type, payload } = job
    log('info', `Job ${job.id} ${type}`)

    if (type === 'unlock') {
      const device = config.devices.get(payload.deviceKey)
      if (!device) throw new Error(`Unknown device key "${payload.deviceKey}"`)
      if (device.role !== 'door') {
        throw new Error(`Cannot unlock non-door device "${payload.deviceKey}" (${device.role})`)
      }
      await device.remoteOpen(payload.doorNo ?? 1)
      return { unlocked: true, deviceKey: payload.deviceKey, doorNo: payload.doorNo }
    }

    if (type === 'revoke') {
      const errors = []
      for (const device of doorDevices()) {
        try {
          await device.deleteUser(payload.employeeNo)
        } catch (err) {
          log('warn', `Revoke on ${device.key}: ${err.message}`)
          errors.push(`${device.key}: ${err.message}`)
        }
      }
      if (errors.length) {
        throw new Error(`Revoke partial failure — ${errors.join('; ')}`)
      }
      return { revoked: true, employeeNo: payload.employeeNo }
    }

    if (type === 'provision' || type === 'assign_card' || type === 'update_validity') {
      const targets = targetsFromDoors(payload.doors ?? [])

      for (const { device, doorNos } of targets) {
        await device.upsertUser({
          employeeNo: payload.employeeNo,
          name: payload.displayName ?? payload.employeeNo,
          validFrom: payload.validFrom,
          validTo: payload.validTo,
          doorNos,
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
        devices: targets.map((t) => ({
          key: t.device.key,
          doorNos: t.doorNos,
        })),
      }
    }

    if (type === 'enroll_card_capture') {
      const station = enrollmentDevice(payload.deviceKey)
      log('info', `Waiting for card on ${station.key} (DS-K1F600U-D6E-F)…`)
      const { cardNo } = await station.captureCard({ timeoutMs: payload.timeoutMs ?? 90_000 })
      log('info', `Captured card ${cardNo} — pushing to door controllers`)
      const targets = targetsFromDoors(payload.doors ?? [])
      for (const { device, doorNos } of targets) {
        await device.upsertUser({
          employeeNo: payload.employeeNo,
          name: payload.displayName ?? payload.employeeNo,
          validFrom: payload.validFrom,
          validTo: payload.validTo,
          doorNos,
        })
        await device.upsertCard({ employeeNo: payload.employeeNo, cardNo })
      }
      return {
        cardNo,
        hasCard: true,
        devices: targets.map((t) => t.device.key),
      }
    }

    if (type === 'enroll_face_capture') {
      const station = enrollmentDevice(payload.deviceKey)
      const targets = targetsFromDoors(payload.doors ?? [])
      log(
        'info',
        `Capturing face on ${station.key} (DS-K1F600U enrollment station) — face the station camera…`,
      )
      const { jpeg, source } = await station.captureFaceJpeg({
        timeoutMs: payload.timeoutMs ?? 90_000,
      })
      log(
        'info',
        `Face image captured on enrollment station${source ? ` via ${source}` : ''} — uploading to door controllers`,
      )
      for (const { device, doorNos } of targets) {
        await device.upsertUser({
          employeeNo: payload.employeeNo,
          name: payload.displayName ?? payload.employeeNo,
          validFrom: payload.validFrom,
          validTo: payload.validTo,
          doorNos,
        })
        await device.uploadFace({ employeeNo: payload.employeeNo, jpeg })
      }
      return { hasFace: true, capturedOn: station.key, devices: targets.map((t) => t.device.key) }
    }

    if (type === 'enroll_fingerprint_capture') {
      const station = enrollmentDevice(payload.deviceKey)
      log('info', `Capturing fingerprint on ${station.key} (DS-K1F600U-D6E-F)…`)
      const fp = await station.captureFingerprint({ timeoutMs: payload.timeoutMs ?? 90_000 })
      const targets = targetsFromDoors(payload.doors ?? [])
      for (const { device, doorNos } of targets) {
        await device.upsertUser({
          employeeNo: payload.employeeNo,
          name: payload.displayName ?? payload.employeeNo,
          validFrom: payload.validFrom,
          validTo: payload.validTo,
          doorNos,
        })
        await device.upsertFingerprint({
          employeeNo: payload.employeeNo,
          fingerNo: fp.fingerNo,
          fingerprintData: fp.fingerprintData,
        })
      }
      return { hasFingerprint: true, devices: targets.map((t) => t.device.key) }
    }

    if (type === 'pull_attendance') {
      const device = attendanceDevice(payload.deviceKey)
      log('info', `Pulling attendance events from ${device.key}…`)
      if (typeof device.pullAttendanceEvents !== 'function') {
        throw new Error(
          'Attendance pull is not supported on this Access Agent build yet — upgrade the agent.',
        )
      }
      const records = await device.pullAttendanceEvents({ sinceHours: 48 })
      return { records: records ?? [], deviceKey: device.key }
    }

    throw new Error(`Unsupported job type: ${type}`)
  }

  async function pollOnce() {
    const { jobs } = await apiWithBackoff('/api/access/agent/jobs', {
      method: 'POST',
      body: JSON.stringify({ limit: 10 }),
    })

    let hadUnlock = false
    for (const job of jobs ?? []) {
      if (
        job.type === 'unlock' ||
        job.type === 'enroll_card_capture' ||
        job.type === 'enroll_face_capture' ||
        job.type === 'enroll_fingerprint_capture'
      ) {
        hadUnlock = true
      }
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
    return { count: jobs?.length ?? 0, hadUnlock }
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
  let stopped = false

  const loopInterval = (fn, ms, label) => {
    const run = async () => {
      if (stopped) return
      if (backoffRemainingMs() > 0 && label === 'heartbeat') return
      try {
        await fn()
      } catch (err) {
        if (err.code === 'RATE_LIMIT_BACKOFF' || String(err.message).includes('skipped')) return
        log('error', `${label}: ${err.message}`)
        options.onStatus?.({
          online: false,
          detail: err.message,
          devices: [...config.devices.keys()],
        })
      }
    }
    void run()
    timers.push(setInterval(run, ms))
  }

  // Poll with setTimeout so ticks never stack; re-poll immediately after unlocks.
  const schedulePoll = (delayMs) => {
    const t = setTimeout(async () => {
      if (stopped) return
      const wait = backoffRemainingMs()
      if (wait > 0) {
        schedulePoll(wait)
        return
      }
      let result = { count: 0, hadUnlock: false }
      try {
        result = (await pollOnce()) ?? result
      } catch (err) {
        if (err.code !== 'RATE_LIMIT_BACKOFF' && !String(err.message).includes('skipped')) {
          log('error', `poll: ${err.message}`)
          options.onStatus?.({
            online: false,
            detail: err.message,
            devices: [...config.devices.keys()],
          })
        } else {
          options.onStatus?.({
            online: true,
            detail: `Paused briefly (MOJO rate limit) — retrying in ${Math.ceil(backoffRemainingMs() / 1000)}s`,
            devices: [...config.devices.keys()],
          })
        }
      }
      const nextBackoff = backoffRemainingMs()
      const next =
        nextBackoff > 0
          ? nextBackoff
          : result.hadUnlock || result.count > 0
            ? Math.min(400, config.pollMs) // burst after activity
            : config.pollMs
      schedulePoll(next)
    }, delayMs)
    timers.push(t)
  }

  loopInterval(heartbeat, config.heartbeatMs, 'heartbeat')
  schedulePoll(0)

  options.onStatus?.({
    online: true,
    detail: 'Agent running — syncing…',
    devices: [...config.devices.keys()],
  })

  return {
    stop() {
      stopped = true
      for (const t of timers) {
        clearInterval(t)
        clearTimeout(t)
      }
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
