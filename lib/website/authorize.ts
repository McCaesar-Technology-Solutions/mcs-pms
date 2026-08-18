import { timingSafeEqual } from 'node:crypto'
import { getWebsiteSyncSecret } from '@/lib/env'

export function authorizeWebsiteSync(request: Request): boolean {
  const secret = getWebsiteSyncSecret()
  if (!secret) return false
  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (auth.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
}
