'use server'

import { loadVerifiedStaffProfile } from '@/lib/auth/staff-session'
import { getNotifications as fetchNotifications } from '@/lib/data/notifications'

export async function loadNotifications() {
  const profile = await loadVerifiedStaffProfile()
  if (!profile) return []
  return fetchNotifications()
}
