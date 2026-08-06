import { createHash } from 'node:crypto'
import dns from 'node:dns/promises'
import net from 'node:net'
import { isIP } from 'node:net'

const FETCH_TIMEOUT_MS = 15_000
const MAX_BODY_BYTES = 2 * 1024 * 1024
const USER_AGENT = 'MOJO-PMS-iCalSync/1.0 (+https://mojoapartments)'

const AIRBNB_HOST_SUFFIXES = ['.airbnb.com', '.muscache.com']
const AIRBNB_HOSTS = new Set(['airbnb.com', 'www.airbnb.com', 'muscache.com', 'a0.muscache.com'])

export type SafeFetchResult =
  | { ok: true; body: string; etag: string | null; notModified: false; contentHash: string }
  | { ok: true; body: null; etag: string | null; notModified: true; contentHash: null }
  | { ok: false; error: string; code: string }

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number)
    const a = parts[0] ?? 0
    const b = parts[1] ?? 0
    if (a === 0) return true
    if (a === 10) return true
    if (a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    if (a >= 224) return true // multicast / reserved
    return false
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase()
    if (normalized === '::1') return true
    if (normalized === '::') return true
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true // unique local
    if (normalized.startsWith('fe80')) return true // link-local
    if (normalized.startsWith('ff')) return true // multicast
    // IPv4-mapped dotted (::ffff:127.0.0.1)
    if (normalized.includes('.')) {
      const mapped = normalized.split(':').pop()
      if (mapped && net.isIPv4(mapped)) return isPrivateOrReservedIp(mapped)
    }
    // IPv4-mapped hex (::ffff:7f00:1)
    const hexMapped = normalized.match(/^:?:ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
    if (hexMapped) {
      const hi = Number.parseInt(hexMapped[1]!, 16)
      const lo = Number.parseInt(hexMapped[2]!, 16)
      const dotted = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`
      return isPrivateOrReservedIp(dotted)
    }
    return false
  }
  return true
}

export function isAirbnbCalendarHost(hostname: string): boolean {
  const host = normalizeHostname(hostname).replace(/\.$/, '')
  if (AIRBNB_HOSTS.has(host)) return true
  return AIRBNB_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

/** Node may keep brackets on IPv6 hostnames (`[::1]`). */
function normalizeHostname(hostname: string): string {
  const host = hostname.toLowerCase()
  if (host.startsWith('[') && host.endsWith(']')) return host.slice(1, -1)
  return host
}

/** Validate import URL shape before DNS/fetch. HTTPS only. */
export function validateImportUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return { ok: false, error: 'Invalid calendar URL.' }
  }
  if (url.protocol !== 'https:') {
    return { ok: false, error: 'Calendar URL must use HTTPS.' }
  }
  if (url.username || url.password) {
    return { ok: false, error: 'Calendar URL must not include credentials.' }
  }
  const host = normalizeHostname(url.hostname)
  if (!host || host === 'localhost' || host.endsWith('.local')) {
    return { ok: false, error: 'Calendar host is not allowed.' }
  }
  if (isIP(host) && isPrivateOrReservedIp(host)) {
    return { ok: false, error: 'Calendar host is not allowed.' }
  }
  return { ok: true, url }
}

async function assertPublicHostname(hostname: string): Promise<string | null> {
  const host = normalizeHostname(hostname)
  if (isIP(host)) {
    return isPrivateOrReservedIp(host) ? 'Calendar host resolves to a private address.' : null
  }
  let records: { address: string; family: number }[]
  try {
    records = await dns.lookup(host, { all: true, verbatim: true })
  } catch {
    return 'Could not resolve calendar host.'
  }
  if (!records.length) return 'Could not resolve calendar host.'
  for (const rec of records) {
    if (isPrivateOrReservedIp(rec.address)) {
      return 'Calendar host resolves to a private address.'
    }
  }
  return null
}

export function hashIcsBody(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex')
}

/**
 * SSRF-safe HTTPS fetch for iCal feeds.
 * Resolves DNS and rejects private/reserved addresses before requesting.
 */
export async function fetchIcalFeed(
  importUrl: string,
  opts: { etag?: string | null } = {},
): Promise<SafeFetchResult> {
  const validated = validateImportUrl(importUrl)
  if (!validated.ok) return { ok: false, error: validated.error, code: 'INVALID_URL' }

  const hostError = await assertPublicHostname(normalizeHostname(validated.url.hostname))
  if (hostError) return { ok: false, error: hostError, code: 'SSRF_BLOCKED' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const headers: Record<string, string> = {
      Accept: 'text/calendar, text/plain, */*',
      'User-Agent': USER_AGENT,
    }
    if (opts.etag) headers['If-None-Match'] = opts.etag

    const res = await fetch(validated.url.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers,
      cache: 'no-store',
    })

    // Follow a single same-host HTTPS redirect manually after re-validating.
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location')
      if (!location) return { ok: false, error: 'Calendar redirect missing location.', code: 'BAD_REDIRECT' }
      const next = validateImportUrl(new URL(location, validated.url).toString())
      if (!next.ok) return { ok: false, error: next.error, code: 'BAD_REDIRECT' }
      if (next.url.hostname !== validated.url.hostname) {
        return { ok: false, error: 'Calendar redirect to a different host is blocked.', code: 'BAD_REDIRECT' }
      }
      const redirectHostError = await assertPublicHostname(next.url.hostname)
      if (redirectHostError) return { ok: false, error: redirectHostError, code: 'SSRF_BLOCKED' }

      const res2 = await fetch(next.url.toString(), {
        method: 'GET',
        redirect: 'error',
        signal: controller.signal,
        headers,
        cache: 'no-store',
      })
      return await readFeedResponse(res2)
    }

    return await readFeedResponse(res)
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Calendar fetch timed out.', code: 'TIMEOUT' }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Calendar fetch failed.',
      code: 'FETCH_FAILED',
    }
  } finally {
    clearTimeout(timer)
  }
}

async function readFeedResponse(res: Response): Promise<SafeFetchResult> {
  const etag = res.headers.get('etag')

  if (res.status === 304) {
    return { ok: true, body: null, etag, notModified: true, contentHash: null }
  }

  if (!res.ok) {
    return {
      ok: false,
      error: `Calendar host returned HTTP ${res.status}.`,
      code: 'HTTP_ERROR',
    }
  }

  const lengthHeader = res.headers.get('content-length')
  if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) {
    return { ok: false, error: 'Calendar feed is too large.', code: 'TOO_LARGE' }
  }

  const reader = res.body?.getReader()
  if (!reader) {
    const text = await res.text()
    if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
      return { ok: false, error: 'Calendar feed is too large.', code: 'TOO_LARGE' }
    }
    return {
      ok: true,
      body: text,
      etag,
      notModified: false,
      contentHash: hashIcsBody(text),
    }
  }

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      try {
        await reader.cancel()
      } catch {
        /* ignore */
      }
      return { ok: false, error: 'Calendar feed is too large.', code: 'TOO_LARGE' }
    }
    chunks.push(value)
  }

  const body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8')
  return {
    ok: true,
    body,
    etag,
    notModified: false,
    contentHash: hashIcsBody(body),
  }
}
