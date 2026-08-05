/**
 * Minimal Hikvision ISAPI client (Digest auth via node:http).
 * Targets common AccessControl person/card/door endpoints.
 */

import { digestRequest } from './digest-http.js'

export class HikvisionDevice {
  constructor(config) {
    this.key = config.key
    this.host = config.host
    this.port = config.port ?? 80
    this.useHttps = Boolean(config.useHttps)
    this.username = config.username
    this.password = config.password
    this.role = config.role === 'enrollment' ? 'enrollment' : 'door'
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

  async upsertUser({ employeeNo, name, validFrom, validTo }) {
    // Try create; on conflict modify.
    const beginTime = `${validFrom}T00:00:00`
    const endTime = `${validTo}T23:59:59`
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
      doorRight: '1',
      RightPlan: [{ doorNo: 1, planTemplateNo: '1' }],
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
   * Face capture via CaptureFaceData (XML). Device may return progress, faceDataUrl, or JPEG bytes.
   * Enrollment station often returns pictureUploadFailed; door terminals (DS-K1T321) support progress polling.
   */
  async captureFaceJpeg({ timeoutMs = 90_000 } = {}) {
    const deadline = Date.now() + timeoutMs
    const xmlBodies = [
      `<?xml version="1.0" encoding="UTF-8"?>
<CaptureFaceDataCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <dataType>binary</dataType>
  <captureInfrared>false</captureInfrared>
</CaptureFaceDataCond>`,
      `<?xml version="1.0" encoding="UTF-8"?>
<CaptureFaceDataCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <dataType>binary</dataType>
  <captureInfrared>true</captureInfrared>
</CaptureFaceDataCond>`,
    ]
    const url = `${this.baseUrl()}/ISAPI/AccessControl/CaptureFaceData`
    let lastError = 'Waiting for face'
    let xmlIndex = 0
    const where =
      this.role === 'enrollment'
        ? 'enrollment station camera'
        : `${this.key} door camera`

    while (Date.now() < deadline) {
      const remaining = deadline - Date.now()
      if (remaining < 4000) break
      // Keep each attempt long enough for the person to align with the camera
      const attemptMs = Math.min(20_000, remaining)
      const xml = xmlBodies[xmlIndex % xmlBodies.length]
      xmlIndex += 1
      try {
        const res = await this.digest(url, {
          method: 'POST',
          timeoutMs: attemptMs,
          headers: {
            'Content-Type': 'application/xml',
            Accept: 'application/xml, image/jpeg, application/octet-stream, */*',
          },
          body: xml,
        })
        const buf = res.body
        const ctype = String(res.headers['content-type'] || '')
        if (buf.length > 500 && (ctype.includes('jpeg') || (buf[0] === 0xff && buf[1] === 0xd8))) {
          return { jpeg: buf, contentType: 'image/jpeg' }
        }

        const text = res.text()
        const progress = Number(text.match(/<captureProgress>([^<]+)/i)?.[1] ?? NaN)
        const faceDataUrl = text.match(/<faceDataUrl>([^<]+)/i)?.[1]?.trim()
        const infraredUrl = text.match(/<infraredFaceDataUrl>([^<]+)/i)?.[1]?.trim()
        const dataUrl = faceDataUrl || infraredUrl

        if (dataUrl) {
          const abs = dataUrl.startsWith('http')
            ? dataUrl
            : `${this.baseUrl()}${dataUrl.startsWith('/') ? '' : '/'}${dataUrl}`
          const pic = await this.digest(abs, {
            method: 'GET',
            timeoutMs: 15_000,
            headers: { Accept: 'image/jpeg, application/octet-stream, */*' },
          })
          if (pic.body?.length > 500) {
            return { jpeg: pic.body, contentType: 'image/jpeg' }
          }
          lastError = `faceDataUrl empty (${dataUrl})`
        } else if (Number.isFinite(progress) && progress > 0 && progress < 100) {
          lastError = `captureProgress ${progress}% — keep facing the camera`
        } else if (progress === 100) {
          lastError = 'captureProgress 100 but no face image in response'
        } else if (progress === 0) {
          lastError = 'captureProgress 0% — stand in front of the camera'
        } else {
          const sub =
            text.match(/<subStatusCode>([^<]+)/i)?.[1] ||
            text.match(/<statusString>([^<]+)/i)?.[1] ||
            `HTTP ${res.status}`
          lastError = sub
        }
      } catch (err) {
        lastError = err.message
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error(
      `${this.key}: face capture timed out (${lastError}). Face the ${where} while Enroll face is running.`,
    )
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
