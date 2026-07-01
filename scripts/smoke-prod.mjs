#!/usr/bin/env node
/**
 * Post-deploy smoke test. Requires PRODUCTION_APP_URL (or NEXT_PUBLIC_APP_URL).
 *
 *   PRODUCTION_APP_URL=https://mcs-pms.vercel.app npm run smoke:prod
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

async function check(path, expectReady = false) {
  const url = `${base}${path}`
  const res = await fetch(url, { redirect: 'follow' })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(`FAIL ${path} → ${res.status}`, body)
    process.exit(1)
  }
  if (expectReady && body.status !== 'ready') {
    console.error(`FAIL ${path} — expected status=ready`, body)
    process.exit(1)
  }
  console.log(`OK   ${path} → ${res.status}`, expectReady ? `(ready)` : `(health)`)
}

console.log(`Smoke test: ${base}`)
await check('/api/health')
await check('/api/ready', true)
console.log('All smoke checks passed.')
