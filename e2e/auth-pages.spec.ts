import { test, expect } from '@playwright/test'

test.describe('public auth pages', () => {
  test('login page renders sign-in form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText(/staff sign in/i)).toBeVisible()
    await expect(page.getByLabel(/email or phone/i)).toBeVisible()
    await expect(page.getByLabel(/^password$/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('signup page has password confirmation fields', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByLabel(/^password$/i)).toBeVisible()
    await expect(page.getByLabel(/confirm password/i)).toBeVisible()
    await expect(page.getByText(/at least 12 characters/i)).toBeVisible()
  })

  test('password visibility toggle works on login', async ({ page }) => {
    await page.goto('/login')
    const password = page.getByLabel(/^password$/i)
    await password.fill('test-password-12')
    await expect(password).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: /show password/i }).click()
    await expect(password).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: /hide password/i }).click()
    await expect(password).toHaveAttribute('type', 'password')
  })

  test('desktop install hint shows on large screens only', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/login')
    await expect(page.getByRole('region', { name: /install app/i })).toHaveCount(0)

    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/login')
    await expect(page.getByRole('region', { name: /install app/i })).toBeVisible()
    await expect(page.getByText(/install on your computer/i)).toBeVisible()
  })
})

test.describe('legal pages', () => {
  test('privacy and terms are reachable', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await page.goto('/terms')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

test.describe('API smoke', () => {
  test('health endpoint responds', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})
