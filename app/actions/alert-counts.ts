'use server'

import { loadVerifiedStaffProfile } from '@/lib/auth/staff-session'
import { getManagerTabBadges, getNavBadgeMap } from '@/lib/data/staff-alerts'

export async function loadNavBadgeMap() {
  const profile = await loadVerifiedStaffProfile()
  if (!profile) return {}
  return getNavBadgeMap()
}

export async function loadManagerTabBadges() {
  const profile = await loadVerifiedStaffProfile()
  if (!profile) return { overview: 0, guestPortal: 0 }
  return getManagerTabBadges()
}
