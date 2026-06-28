'use server'

import { getManagerTabBadges, getNavBadgeMap } from '@/lib/data/staff-alerts'

export async function loadNavBadgeMap() {
  return getNavBadgeMap()
}

export async function loadManagerTabBadges() {
  return getManagerTabBadges()
}
