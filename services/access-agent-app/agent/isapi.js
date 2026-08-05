/**
 * Minimal Hikvision ISAPI client (Digest auth).
 * Targets common AccessControl person/card/door endpoints.
 */

import DigestFetch from 'digest-fetch'

export class HikvisionDevice {
  constructor(config) {
    this.key = config.key
    this.host = config.host
    this.port = config.port ?? 80
    this.useHttps = Boolean(config.useHttps)
    this.username = config.username
    this.password = config.password
    this.client = new DigestFetch(this.username, this.password)
  }

  baseUrl() {
    const scheme = this.useHttps ? 'https' : 'http'
    return `${scheme}://${this.host}:${this.port}`
  }

  async request(method, path, body) {
    const url = `${this.baseUrl()}${path}${path.includes('?') ? '&' : '?'}format=json`
    const timeoutMs = Number(this.timeoutMs ?? 5000)
    const init = {
      method,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }

    const res = await this.client.fetch(url, init)
    const text = await res.text()
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
    return this.request('GET', '/ISAPI/System/deviceInfo')
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
    const res = await this.client.fetch(url, {
      method: 'PUT',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'Content-Type': 'application/xml',
        Accept: 'application/xml',
      },
      body: xml,
    })
    const text = await res.text()
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
}
