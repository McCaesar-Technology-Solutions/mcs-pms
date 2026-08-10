/**
 * Minimal Hikvision ISAPI client (Digest auth via node:http).
 * Targets common AccessControl person/card/door endpoints.
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { digestRequest } from './digest-http.js'

function findFfmpeg() {
  const candidates = [
    process.env.FFMPEG_PATH,
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    'ffmpeg',
  ].filter(Boolean)
  for (const c of candidates) {
    if (c === 'ffmpeg' || existsSync(c)) return c
  }
  return null
}

function mapAttendanceStatus(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  if (!s) return 'unknown'
  if (
    s === 'checkin' ||
    s === 'clockin' ||
    s === 'in' ||
    s === 'breakin' ||
    s === 'overtimein'
  ) {
    return 'clock_in'
  }
  if (
    s === 'checkout' ||
    s === 'clockout' ||
    s === 'out' ||
    s === 'breakout' ||
    s === 'overtimeout'
  ) {
    return 'clock_out'
  }
  return 'unknown'
}

/** Normalize one AcsEvent InfoList row for PMS ingest. */
function mapAcsEventInfo(item) {
  if (!item || typeof item !== 'object') return null
  const employeeNo = String(
    item.employeeNoString ?? item.employeeNo ?? item.employee_no ?? '',
  ).trim()
  if (!employeeNo) return null

  const occurredRaw =
    item.time ?? item.Time ?? item.dateTime ?? item.occurredAt ?? item.occurred_at
  if (!occurredRaw) return null
  const occurredAt = new Date(String(occurredRaw))
  if (Number.isNaN(occurredAt.getTime())) return null

  const eventType = mapAttendanceStatus(
    item.attendanceStatus ?? item.AttendanceStatus ?? item.attendanceStatusValue,
  )

  const serial =
    item.serialNo != null
      ? String(item.serialNo)
      : item.serialNumber != null
        ? String(item.serialNumber)
        : null

  return {
    employeeNo,
    displayName: item.name != null ? String(item.name).slice(0, 80) : null,
    occurredAt: occurredAt.toISOString(),
    eventType,
    rawRef: serial,
    major: item.major != null ? Number(item.major) : null,
    minor: item.minor != null ? Number(item.minor) : null,
  }
}

export class HikvisionDevice {
  constructor(config) {
    this.key = config.key
    this.host = config.host
    this.port = config.port ?? 80
    this.useHttps = Boolean(config.useHttps)
    this.username = config.username
    this.password = config.password
    this.role =
      config.role === 'enrollment'
        ? 'enrollment'
        : config.role === 'attendance'
          ? 'attendance'
          : 'door'
    this.model = config.model ?? null
  }

  baseUrl() {
    const scheme = this.useHttps ? 'https' : 'http'
    return `${scheme}://${this.host}:${this.port}`
  }

  async digest(url, { method = 'GET', headers = {}, body, timeoutMs } = {}) {
    return digestRequest(url, {
      username: this.username,
      password: this.password,
      method,
      headers,
      body,
      timeoutMs: Number(timeoutMs ?? this.timeoutMs ?? 8000),
    })
  }

  async request(method, path, body) {
    const url = `${this.baseUrl()}${path}${path.includes('?') ? '&' : '?'}format=json`
    const timeoutMs = Number(this.timeoutMs ?? 8000)
    const res = await this.digest(url, {
      method,
      timeoutMs,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { raw: text }
    }

    if (!res.ok) {
      const msg =
        json?.statusString ||
        json?.errorMsg ||
        json?.subStatusCode ||
        text ||
        `HTTP ${res.status}`
      throw new Error(`${this.key} ${method} ${path}: ${msg}`)
    }
    return json
  }

  async deviceInfo() {
    const json = await this.request('GET', '/ISAPI/System/deviceInfo')
    if (json?.model || json?.deviceName) return json
    const raw = typeof json?.raw === 'string' ? json.raw : ''
    if (!raw) return json
    const pick = (tag) => raw.match(new RegExp(`<${tag}>([^<]*)`, 'i'))?.[1]?.trim() || null
    return {
      ...json,
      deviceName: pick('deviceName'),
      model: pick('model'),
      serialNumber: pick('serialNumber'),
      firmwareVersion: pick('firmwareVersion'),
      macAddress: pick('macAddress'),
    }
  }

  async upsertUser({ employeeNo, name, validFrom, validTo, doorNos }) {
    // Try create; on conflict modify.
    const beginTime = `${validFrom}T00:00:00`
    const endTime = `${validTo}T23:59:59`
    const doors =
      Array.isArray(doorNos) && doorNos.length
        ? [...new Set(doorNos.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 1))]
        : [1]
    if (!doors.length) doors.push(1)
    const doorRight = doors.join(',')
    const RightPlan = doors.map((doorNo) => ({ doorNo, planTemplateNo: '1' }))
    const userInfo = {
      employeeNo: String(employeeNo),
      name: String(name).slice(0, 32),
      userType: 'normal',
      Valid: {
        enable: true,
        beginTime,
        endTime,
        timeType: 'local',
      },
      doorRight,
      RightPlan,
    }

    try {
      await this.request('POST', '/ISAPI/AccessControl/UserInfo/Record', {
        UserInfo: userInfo,
      })
    } catch {
      await this.request('PUT', '/ISAPI/AccessControl/UserInfo/Modify', {
        UserInfo: userInfo,
      })
    }
  }

  async deleteUser(employeeNo) {
    await this.request('PUT', '/ISAPI/AccessControl/UserInfo/Delete', {
      UserInfoDelCond: {
        EmployeeNoList: [{ employeeNo: String(employeeNo) }],
      },
    })
  }

  async upsertCard({ employeeNo, cardNo }) {
    if (!cardNo) return
    const card = {
      employeeNo: String(employeeNo),
      cardNo: String(cardNo),
      cardType: 'normalCard',
    }
    try {
      await this.request('POST', '/ISAPI/AccessControl/CardInfo/Record', {
        CardInfo: card,
      })
    } catch {
      // Some firmwares use Modify; ignore duplicate failures after retry path
      await this.request('PUT', '/ISAPI/AccessControl/CardInfo/Modify', {
        CardInfo: card,
      }).catch(() => undefined)
    }
  }

  async setDoorPin({ employeeNo, doorPin }) {
    if (!doorPin) return
    // Password / PIN field names vary by firmware; best-effort UserInfo modify.
    await this.request('PUT', '/ISAPI/AccessControl/UserInfo/Modify', {
      UserInfo: {
        employeeNo: String(employeeNo),
        password: String(doorPin),
      },
    }).catch(() => undefined)
  }

  async remoteOpen(doorNo = 1) {
    // Prefer XML — proven on this property's controller (JSON format=json is flaky on some firmwares).
    const path = `/ISAPI/AccessControl/RemoteControl/door/${Number(doorNo) || 1}`
    const url = `${this.baseUrl()}${path}`
    const xml =
      '<RemoteControlDoor version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema"><cmd>open</cmd></RemoteControlDoor>'
    const timeoutMs = Number(this.timeoutMs ?? 8000)
    const res = await this.digest(url, {
      method: 'PUT',
      timeoutMs,
      headers: {
        'Content-Type': 'application/xml',
        Accept: 'application/xml',
      },
      body: xml,
    })
    const text = res.text()
    if (!res.ok || (text.includes('statusCode') && !text.includes('<statusCode>1</statusCode>') && !text.includes('<statusString>OK</statusString>'))) {
      // Fallback to JSON shape used by newer firmwares
      try {
        await this.request('PUT', path, { RemoteControlDoor: { cmd: 'open' } })
        return
      } catch {
        throw new Error(
          `${this.key} remoteOpen door ${doorNo}: ${text || `HTTP ${res.status}`}`,
        )
      }
    }
  }

  extractCardNo(payload) {
    if (!payload) return null
    if (typeof payload === 'string') {
      const m = payload.match(/<(?:cardNo|CardNo)>([^<]+)</i)
      return m?.[1]?.trim() || null
    }
    const candidates = [
      payload.cardNo,
      payload.CardNo,
      payload?.CardInfo?.cardNo,
      payload?.CaptureCardInfo?.cardNo,
      payload?.CardCapture?.cardNo,
      payload?.raw && typeof payload.raw === 'string'
        ? payload.raw.match(/<(?:cardNo|CardNo)>([^<]+)</i)?.[1]
        : null,
    ]
    for (const c of candidates) {
      if (c != null && String(c).trim()) return String(c).trim()
    }
    return null
  }

  /**
   * DS-K1F600U-D6E-F / ACS card capture — waits for a card tap.
   * Tries known ISAPI paths used across enrollment stations and terminals.
   */
  async captureCard({ timeoutMs = 90_000 } = {}) {
    const deadline = Date.now() + timeoutMs
    const paths = [
      { method: 'GET', path: '/ISAPI/AccessControl/CaptureCardInfo' },
      { method: 'POST', path: '/ISAPI/AccessControl/CaptureCardInfo', body: {} },
      { method: 'GET', path: '/ISAPI/AccessControl/CardInfo/Capture' },
      { method: 'POST', path: '/ISAPI/AccessControl/CardInfo/Capture', body: {} },
      {
        method: 'PUT',
        path: '/ISAPI/AccessControl/CaptureCardInfo',
        body: { CaptureCardInfo: { cardType: 'normalCard' } },
      },
    ]

    let lastError = 'No card captured'
    while (Date.now() < deadline) {
      for (const attempt of paths) {
        const remaining = Math.max(3000, Math.min(25_000, deadline - Date.now()))
        try {
          const prev = this.timeoutMs
          this.timeoutMs = remaining
          const json = await this.request(attempt.method, attempt.path, attempt.body)
          this.timeoutMs = prev
          const cardNo = this.extractCardNo(json)
          if (cardNo) return { cardNo }
          if (json?.statusString && /busy|wait|timeout/i.test(String(json.statusString))) {
            lastError = json.statusString
            continue
          }
        } catch (err) {
          this.timeoutMs = undefined
          lastError = err.message
          // 404 / invalid path — try next
          if (/404|Invalid Operation|notSupport|badUrl/i.test(err.message)) continue
        }
      }
      await new Promise((r) => setTimeout(r, 800))
    }
    throw new Error(
      `${this.key}: card capture timed out on DS-K1F600U-D6E-F (${lastError}). Tap a card on the enrollment station.`,
    )
  }

  /**
   * Fingerprint capture — DS-K1F600U wants XML CaptureFingerPrintCond (not JSON / FingerprintCollect).
   * Keep POSTing until fingerData appears or timeout (place finger on sensor while this runs).
   */
  async captureFingerprint({ timeoutMs = 90_000, fingerNo = 1 } = {}) {
    const deadline = Date.now() + timeoutMs
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CaptureFingerPrintCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <fingerNo>${Number(fingerNo) || 1}</fingerNo>
</CaptureFingerPrintCond>`
    const url = `${this.baseUrl()}/ISAPI/AccessControl/CaptureFingerPrint`
    let lastError = 'Waiting for finger on sensor'

    while (Date.now() < deadline) {
      const remaining = deadline - Date.now()
      if (remaining < 4000) break
      const attemptMs = Math.min(20_000, remaining)
      try {
        const res = await this.digest(url, {
          method: 'POST',
          timeoutMs: attemptMs,
          headers: {
            'Content-Type': 'application/xml',
            Accept: 'application/xml, */*',
          },
          body: xml,
        })
        const text = res.text()
        const fingerData =
          text.match(/<fingerData>([^<]+)/i)?.[1]?.trim() ||
          text.match(/"fingerData"\s*:\s*"([^"]+)"/i)?.[1]?.trim() ||
          null
        if (fingerData) {
          return {
            fingerNo:
              Number(text.match(/<fingerNo>([^<]+)/i)?.[1]) ||
              Number(fingerNo) ||
              1,
            fingerprintData: fingerData,
            fingerprintQuality:
              text.match(/<fingerPrintQuality>([^<]+)/i)?.[1]?.trim() || null,
          }
        }
        const sub =
          text.match(/<subStatusCode>([^<]+)/i)?.[1] ||
          text.match(/<statusString>([^<]+)/i)?.[1] ||
          `HTTP ${res.status}`
        lastError = sub
        // busy / no finger yet — keep trying
        if (!/deviceBusy|deviceError|Invalid Operation|timeout|busy/i.test(sub) && res.ok) {
          lastError = text.slice(0, 180) || sub
        }
      } catch (err) {
        lastError = err.message
      }
      await new Promise((r) => setTimeout(r, 600))
    }
    throw new Error(
      `${this.key}: fingerprint capture timed out (${lastError}). Place finger on the DS-K1F600U sensor after clicking Enroll.`,
    )
  }

  async upsertFingerprint({ employeeNo, fingerNo = 1, fingerprintData }) {
    if (!fingerprintData) return
    const body = {
      FingerPrintCfg: {
        employeeNo: String(employeeNo),
        enableCardReader: [1],
        fingerPrintID: Number(fingerNo) || 1,
        fingerType: 'normalFP',
        fingerData: fingerprintData,
      },
    }
    try {
      await this.request('POST', '/ISAPI/AccessControl/FingerPrint/SetUp', body)
    } catch {
      await this.request('POST', '/ISAPI/AccessControl/FingerPrintDownload', {
        FingerPrintInfo: {
          employeeNo: String(employeeNo),
          fingerprintList: [
            {
              fingerNo: Number(fingerNo) || 1,
              fingerData: fingerprintData,
            },
          ],
        },
      })
    }
  }

  /**
   * Face capture on DS-K1F600U enrollment station.
   * CaptureFaceData ISAPI returns pictureUploadFailed on this firmware — use RTSP snapshot instead.
   * Guest must face the enrollment station camera while this runs.
   */
  async captureFaceJpeg({ timeoutMs = 90_000 } = {}) {
    // Brief ISAPI attempt (works on some firmwares / when progress API is healthy)
    try {
      const viaIsapi = await this.captureFaceViaIsapi({ timeoutMs: Math.min(12_000, timeoutMs) })
      if (viaIsapi?.jpeg?.length) return viaIsapi
    } catch {
      // expected on DS-K1F600U — fall through to RTSP
    }
    return this.captureFaceViaRtsp({ timeoutMs })
  }

  async captureFaceViaIsapi({ timeoutMs = 12_000 } = {}) {
    const deadline = Date.now() + timeoutMs
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CaptureFaceDataCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <dataType>binary</dataType>
  <captureInfrared>false</captureInfrared>
</CaptureFaceDataCond>`
    const url = `${this.baseUrl()}/ISAPI/AccessControl/CaptureFaceData`
    let lastError = 'Waiting for face'

    while (Date.now() < deadline) {
      const remaining = deadline - Date.now()
      if (remaining < 3000) break
      const res = await this.digest(url, {
        method: 'POST',
        timeoutMs: Math.min(10_000, remaining),
        headers: {
          'Content-Type': 'application/xml',
          Accept: 'application/xml, image/jpeg, application/octet-stream, */*',
        },
        body: xml,
      })
      const buf = res.body
      if (buf.length > 500 && buf[0] === 0xff && buf[1] === 0xd8) {
        return { jpeg: buf, contentType: 'image/jpeg' }
      }
      const text = res.text()
      const faceDataUrl = text.match(/<faceDataUrl>([^<]+)/i)?.[1]?.trim()
      if (faceDataUrl) {
        const abs = faceDataUrl.startsWith('http')
          ? faceDataUrl
          : `${this.baseUrl()}${faceDataUrl.startsWith('/') ? '' : '/'}${faceDataUrl}`
        const pic = await this.digest(abs, {
          method: 'GET',
          timeoutMs: 10_000,
          headers: { Accept: 'image/jpeg, */*' },
        })
        if (pic.body?.length > 500) return { jpeg: pic.body, contentType: 'image/jpeg' }
      }
      lastError =
        text.match(/<subStatusCode>([^<]+)/i)?.[1] ||
        text.match(/<statusString>([^<]+)/i)?.[1] ||
        `HTTP ${res.status}`
      if (/pictureUploadFailed/i.test(lastError)) break
      await new Promise((r) => setTimeout(r, 400))
    }
    throw new Error(lastError)
  }

  /** Grab a JPEG from the enrollment station RTSP stream (proven path on DS-K1F600U). */
  async captureFaceViaRtsp({ timeoutMs = 90_000 } = {}) {
    const ffmpeg = findFfmpeg()
    if (!ffmpeg) {
      throw new Error(
        `${this.key}: face capture needs ffmpeg on this PC (brew install ffmpeg). Enrollment station has no working CaptureFaceData snapshot API.`,
      )
    }

    const user = encodeURIComponent(this.username)
    const pass = encodeURIComponent(this.password)
    const host = this.host
    const paths = [
      '/h264/ch1/main/av_stream',
      '/Streaming/Channels/101',
      '/Streaming/Channels/1',
      '/h264/ch1/sub/av_stream',
    ]
    const deadline = Date.now() + timeoutMs
    let lastError = 'Waiting for RTSP frame'
    const outFile = join(tmpdir(), `mojo-face-${this.key}-${Date.now()}.jpg`)

    while (Date.now() < deadline) {
      for (const path of paths) {
        const rtsp = `rtsp://${user}:${pass}@${host}:554${path}`
        try {
          await new Promise((resolve, reject) => {
            const args = [
              '-y',
              '-hide_banner',
              '-loglevel',
              'error',
              '-rtsp_transport',
              'tcp',
              '-i',
              rtsp,
              '-update',
              '1',
              '-frames:v',
              '1',
              '-q:v',
              '5',
              outFile,
            ]
            const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] })
            let err = ''
            child.stderr.on('data', (c) => {
              err += c.toString()
            })
            const timer = setTimeout(() => {
              child.kill('SIGKILL')
              reject(new Error(`ffmpeg timeout for ${path}`))
            }, 15_000)
            child.on('error', (e) => {
              clearTimeout(timer)
              reject(e)
            })
            child.on('close', (code) => {
              clearTimeout(timer)
              if (code === 0 && existsSync(outFile)) resolve()
              else reject(new Error(err.trim() || `ffmpeg exit ${code} (${path})`))
            })
          })
          const jpeg = readFileSync(outFile)
          try {
            unlinkSync(outFile)
          } catch {
            // ignore
          }
          if (jpeg.length > 500 && jpeg[0] === 0xff && jpeg[1] === 0xd8) {
            return { jpeg, contentType: 'image/jpeg', source: 'rtsp', path }
          }
          lastError = `empty/invalid jpeg from ${path}`
        } catch (err) {
          lastError = err.message
          try {
            unlinkSync(outFile)
          } catch {
            // ignore
          }
        }
      }
      await new Promise((r) => setTimeout(r, 800))
    }
    throw new Error(
      `${this.key}: face capture timed out on enrollment station (${lastError}). Face the DS-K1F600U camera after clicking Enroll face.`,
    )
  }

  /**
   * Pull access/attendance punch events (AcsEvent) — used for DS-K1A8503MF-B.
   * Returns normalized rows for PMS ingest: employeeNo, occurredAt, eventType, rawRef, displayName.
   */
  async pullAttendanceEvents({ sinceHours = 48 } = {}) {
    const hours = Math.min(168, Math.max(1, Number(sinceHours) || 48))
    const end = new Date()
    const start = new Date(end.getTime() - hours * 3600_000)
    // Hikvision often rejects millisecond / trailing Z forms.
    const startTime = start.toISOString().replace(/\.\d{3}Z$/, '')
    const endTime = end.toISOString().replace(/\.\d{3}Z$/, '')
    const searchID = `mojo-att-${Date.now()}`
    const maxResults = 30
    const maxPages = 40
    const records = []
    let position = 0
    let lastError = null

    for (let page = 0; page < maxPages; page++) {
      let json
      try {
        json = await this.request('POST', '/ISAPI/AccessControl/AcsEvent', {
          AcsEventCond: {
            searchID,
            searchResultPosition: position,
            maxResults,
            major: 5,
            minor: 0,
            startTime,
            endTime,
          },
        })
      } catch (err) {
        lastError = err.message
        // Some firmwares want major/minor omitted or zeroed for “all events”.
        if (page === 0 && /Invalid|notSupport|badUrl|400|403/i.test(String(err.message))) {
          try {
            json = await this.request('POST', '/ISAPI/AccessControl/AcsEvent', {
              AcsEventCond: {
                searchID: `${searchID}-all`,
                searchResultPosition: 0,
                maxResults,
                major: 0,
                minor: 0,
                startTime,
                endTime,
              },
            })
            lastError = null
          } catch (err2) {
            throw new Error(
              `${this.key}: attendance AcsEvent pull failed (${err2.message}). Check ISAPI / network on DS-K1A8503MF-B.`,
            )
          }
        } else {
          throw new Error(
            `${this.key}: attendance AcsEvent pull failed (${err.message}).`,
          )
        }
      }

      const acs = json?.AcsEvent ?? json
      const listRaw = acs?.InfoList ?? acs?.infoList ?? []
      const list = Array.isArray(listRaw) ? listRaw : listRaw ? [listRaw] : []

      for (const item of list) {
        const mapped = mapAcsEventInfo(item)
        if (mapped) records.push(mapped)
      }

      const status = String(acs?.responseStatusStrg ?? acs?.responseStatusString ?? '')
      const num = Number(acs?.numOfMatches ?? list.length) || list.length
      if (!list.length || /^NO MATCH$/i.test(status)) break
      if (/^OK$/i.test(status) && num < maxResults) break
      if (num < maxResults) break
      position += num
    }

    if (lastError && !records.length) {
      throw new Error(`${this.key}: attendance pull failed (${lastError})`)
    }
    return records
  }

  async uploadFace({ employeeNo, jpeg }) {
    if (!jpeg?.length) return
    const url = `${this.baseUrl()}/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json`
    const boundary = `----MojoBoundary${Date.now()}`
    const meta = JSON.stringify({
      faceLibType: 'blackFD',
      FDID: '1',
      FPID: String(employeeNo),
      name: String(employeeNo),
    })
    const chunks = [
      `--${boundary}\r\nContent-Disposition: form-data; name="FaceDataRecord"\r\nContent-Type: application/json\r\n\r\n${meta}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="FaceImage"; filename="face.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
    ]
    const head = Buffer.from(chunks[0] + chunks[1], 'utf8')
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
    const body = Buffer.concat([head, Buffer.from(jpeg), tail])

    const res = await this.digest(url, {
      method: 'POST',
      timeoutMs: Number(this.timeoutMs ?? 20000),
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Accept: 'application/json',
      },
      body,
    })
    const text = res.text()
    if (!res.ok) {
      throw new Error(`${this.key} face upload: ${text || `HTTP ${res.status}`}`)
    }
  }
}
