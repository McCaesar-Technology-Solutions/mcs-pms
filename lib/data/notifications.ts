import { fetchStaffAlerts, type StaffAlertKind } from '@/lib/data/staff-alerts'

export type NotificationKind = StaffAlertKind

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  subtitle: string
  href: string
  urgent: boolean
}

export async function getNotifications(): Promise<AppNotification[]> {
  const alerts = await fetchStaffAlerts(25)
  return alerts.map(({ id, kind, title, subtitle, href, urgent }) => ({
    id,
    kind,
    title,
    subtitle,
    href,
    urgent,
  }))
}
