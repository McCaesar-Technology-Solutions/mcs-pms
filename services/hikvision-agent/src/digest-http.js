/**
 * Digest-auth HTTP via node:http/https — reliable in Electron main (global fetch
 * often fails on LAN private IPs with opaque "fetch failed").
 */

import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'
import md5 from 'md5'

function parseWwwAuthenticate(header) {
  if (!header || !/^digest\s+/i.test(header)) return null
  const params = {}
  const body = header.replace(/^digest\s+/i, '')
  const re = /(\w+)=(?:"([^"]*)"|([^\s,]+))/g
  let m
  while ((m = re.exec(body))) {
    params[m[1].toLowerCase()] = m[2] ?? m[3]
  }
  if (!params.realm || !params.nonce) return null
  return params
}

function buildDigestAuth({ username, password, method, uri, challenge, nc }) {
  const qop = challenge.qop ? String(challenge.qop).split(',')[0].trim() : null
  const cnonce = md5(`${Date.now()}:${Math.random()}`).slice(0, 16)
  const ha1 = md5(`${username}:${challenge.realm}:${password}`)
  const ha2 = md5(`${method}:${uri}`)
  let response
  const parts = [
    `username="${username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
  ]
  if (qop) {
    const ncStr = String(nc).padStart(8, '0')
    response = md5(`${ha1}:${challenge.nonce}:${ncStr}:${cnonce}:${qop}:${ha2}`)
    parts.push(`algorithm=MD5`, `response="${response}"`, `qop=${qop}`, `nc=${ncStr}`, `cnonce="${cnonce}"`)
  } else {
    response = md5(`${ha1}:${challenge.nonce}:${ha2}`)
    parts.push(`response="${response}"`)
  }
  if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`)
  return `Digest ${parts.join(', ')}`
}

/**
 * @returns {Promise<{ status: number, headers: http.IncomingHttpHeaders, body: Buffer }>}
 */
function rawRequest(urlString, { method = 'GET', headers = {}, body, timeoutMs = 8000 } = {}) {
  const url = new URL(urlString)
  const lib = url.protocol === 'https:' ? https : http
  const payload = body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(String(body))

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          ...headers,
          ...(payload ? { 'Content-Length': payload.length } : {}),
          Connection: 'close',
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          })
        })
      },
    )
    req.on('timeout', () => {
      req.destroy(new Error(`timeout after ${timeoutMs}ms`))
    })
    req.on('error', (err) => {
      const code = err.code ? ` (${err.code})` : ''
      reject(new Error(`${err.message}${code}`))
    })
    if (payload) req.write(payload)
    req.end()
  })
}

/**
 * HTTP(S) request with Digest authentication (Hikvision ISAPI).
 * @returns {Promise<{ status: number, headers: http.IncomingHttpHeaders, body: Buffer, text: () => string }>}
 */
export async function digestRequest(urlString, options = {}) {
  const { username, password, method = 'GET', headers = {}, body, timeoutMs = 8000 } = options
  if (!username || password == null) {
    throw new Error('digestRequest: username/password required')
  }

  const url = new URL(urlString)
  const uri = `${url.pathname}${url.search}`

  const first = await rawRequest(urlString, { method, headers, body, timeoutMs })
  if (first.status !== 401) {
    return {
      ...first,
      ok: first.status >= 200 && first.status < 300,
      text: () => first.body.toString('utf8'),
      arrayBuffer: async () =>
        first.body.buffer.slice(first.body.byteOffset, first.body.byteOffset + first.body.byteLength),
    }
  }

  const challenge = parseWwwAuthenticate(first.headers['www-authenticate'])
  if (!challenge) {
    throw new Error(`Digest auth challenge missing (HTTP ${first.status})`)
  }

  const auth = buildDigestAuth({
    username,
    password,
    method,
    uri,
    challenge,
    nc: 1,
  })

  const second = await rawRequest(urlString, {
    method,
    headers: { ...headers, Authorization: auth },
    body,
    timeoutMs,
  })

  return {
    ...second,
    ok: second.status >= 200 && second.status < 300,
    text: () => second.body.toString('utf8'),
    arrayBuffer: async () =>
      second.body.buffer.slice(second.body.byteOffset, second.body.byteOffset + second.body.byteLength),
  }
}
