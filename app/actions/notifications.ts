'use server'

import { getNotifications as fetchNotifications } from '@/lib/data/notifications'

export async function loadNotifications() {
  return fetchNotifications()
}
