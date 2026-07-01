import { test, expect } from '@playwright/test'

test.describe('PWA install support', () => {
  test('manifest is served with standalone display', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest')
    expect(res.ok()).toBeTruthy()
    expect(res.headers()['content-type']).toContain('application/manifest')

    const json = await res.json()
    expect(json.name).toBe('MOJO Apartments')
    expect(json.start_url).toBe('/login')
    expect(json.display).toBe('standalone')
    expect(json.icons?.length).toBeGreaterThanOrEqual(2)
  })

  test('service worker is served', async ({ request }) => {
    const res = await request.get('/sw.js')
    expect(res.ok()).toBeTruthy()
    const body = await res.text()
    expect(body).toContain('addEventListener')
    expect(body).toContain('fetch')
  })
})
