'use server'

import { loadVerifiedStaffProfile } from '@/lib/auth/staff-session'
import { getClientIp } from '@/lib/auth/client-ip'
import { searchGlobal, type GlobalSearchResult } from '@/lib/data/global-search'
import { assertRateLimit, ipRateKey, SEARCH_RATE_LIMITS } from '@/lib/rate-limit'

export async function searchGlobalAction(query: string): Promise<GlobalSearchResult[]> {
  const profile = await loadVerifiedStaffProfile()
  if (!profile) return []

  const ip = await getClientIp()
  const limited = await assertRateLimit(
    ipRateKey('global-search', `${profile.id}:${ip}`),
    SEARCH_RATE_LIMITS.global,
  )
  if (limited) return []

  return searchGlobal(query, 8, profile)
}
