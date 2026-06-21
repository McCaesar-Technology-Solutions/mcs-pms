export function stayNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn + 'T00:00:00')
  const end = new Date(checkOut + 'T00:00:00')
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/** End of checkout calendar day (portal token expiry). */
export function tokenExpiryISO(checkOut: string): string {
  const d = new Date(checkOut)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

export async function buildGuestLoginUrl(token: string): Promise<string> {
  let appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    const { headers } = await import('next/headers')
    const h = await headers()
    const host = h.get('host')
    const proto = h.get('x-forwarded-proto') ?? 'https'
    appUrl = host ? `${proto}://${host}` : 'http://localhost:3000'
  }
  return `${appUrl}/guest/enter?token=${token}`
}
