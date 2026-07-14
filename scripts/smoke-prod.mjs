#!/usr/bin/env node
/**
 * Post-deploy smoke test. Requires PRODUCTION_APP_URL (or NEXT_PUBLIC_APP_URL).
 *
 *   PRODUCTION_APP_URL=https://mcs-pms.vercel.app npm run smoke:prod
 *
 * Optional:
 *   SMOKE_RETRIES=8          — attempts for /api/ready (default 8)
 *   SMOKE_RETRY_MS=15000     — delay between ready retries (default 15s)
 */
const base = (
  process.env.PRODUCTION_APP_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  ''
).replace(/\/$/, '')

if (!base) {
  console.error('Set PRODUCTION_APP_URL or NEXT_PUBLIC_APP_URL')
  process.exit(1)
}

const readyRetries = Math.max(1, Number.parseInt(process.env.SMOKE_RETRIES ?? '8', 10) || 8)
const readyRetryMs = Math.max(1000, Number.parseInt(process.env.SMOKE_RETRY_MS ?? '15000', 10) || 15_000)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(path) {
  const url = `${base}${path}`
  const res = await fetch(url, { redirect: 'follow' })
  const body = await res.json().catch(() => ({}))
  return { res, body }
}

async function checkHealth() {
  const { res, body } = await fetchJson('/api/health')
  if (!res.ok) {
    console.error(`FAIL /api/health → ${res.status}`, body)
    process.exit(1)
  }
  console.log(`OK   /api/health → ${res.status}`, body.version ? `(${body.version})` : '')
}

async function checkReady() {
  for (let attempt = 1; attempt <= readyRetries; attempt++) {
    const { res, body } = await fetchJson('/api/ready')
    if (res.ok && body.status === 'ready') {
      console.log(`OK   /api/ready → ${res.status} (ready, attempt ${attempt}/${readyRetries})`)
      return
    }

    const detail = body.error ?? body.status ?? res.status
    if (attempt === readyRetries) {
      console.error(`FAIL /api/ready — expected status=ready after ${readyRetries} attempts`, body)
      process.exit(1)
    }

    console.warn(
      `WAIT /api/ready → ${res.status} (${detail}); retry ${attempt}/${readyRetries} in ${readyRetryMs}ms`,
    )
    await sleep(readyRetryMs)
  }
}

async function checkLoginPage() {
  const url = `${base}/login`
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    console.error(`FAIL /login → ${res.status}`)
    process.exit(1)
  }
  console.log(`OK   /login → ${res.status}`)
}

console.log(`Smoke test: ${base}`)
await checkHealth()
await checkReady()
await checkLoginPage()
console.log('All smoke checks passed.')
