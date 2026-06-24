import { SettingsPanel } from '@/components/dashboard/settings-panel'
import { NotificationPreferencesPanel } from '@/components/dashboard/notification-preferences-panel'
import { EmailNotificationPreferencesPanel } from '@/components/dashboard/email-notification-preferences-panel'
import { NotificationLogPanel } from '@/components/dashboard/notification-log-panel'
import { AuditLogPanel } from '@/components/dashboard/audit-log-panel'
import { PageHeader } from '@/components/dashboard/page-header'
import { getActiveHotelSettings } from '@/lib/data/settings'
import { getNotificationLog } from '@/lib/data/notification-log'
import { getAuditLog } from '@/lib/data/audit-log'
import { getProfile } from '@/lib/auth/get-profile'

export default async function SettingsPage() {
  const [hotelSettings, profile, notificationLog, auditLog] = await Promise.all([
    getActiveHotelSettings(),
    getProfile(),
    getNotificationLog(50),
    getAuditLog(50),
  ])

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Configuration"
        title="Settings"
        description="Manage property details, tax compliance, and your apartment portfolio."
      />

      <SettingsPanel hotelSettings={hotelSettings} profile={profile} />
      {hotelSettings && (
        <>
          <NotificationPreferencesPanel
            hotelId={hotelSettings.id}
            initialPrefs={hotelSettings.notificationSmsPrefs}
          />
          <EmailNotificationPreferencesPanel
            hotelId={hotelSettings.id}
            propertyName={hotelSettings.name}
            initialPrefs={hotelSettings.notificationEmailPrefs}
            initialFromEmail={hotelSettings.notificationFromEmail}
          />
        </>
      )}
      <AuditLogPanel entries={auditLog} />
      <NotificationLogPanel entries={notificationLog} />
    </div>
  )
}
