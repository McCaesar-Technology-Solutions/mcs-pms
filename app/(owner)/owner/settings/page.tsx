import { SettingsPanel } from '@/components/dashboard/settings-panel'
import { NotificationPreferencesPanel } from '@/components/dashboard/notification-preferences-panel'
import { EmailNotificationPreferencesPanel } from '@/components/dashboard/email-notification-preferences-panel'
import { NotificationLogPanel } from '@/components/dashboard/notification-log-panel'
import { AuditLogPanel } from '@/components/dashboard/audit-log-panel'
import { GuestRulesPanel } from '@/components/dashboard/guest-rules-panel'
import { GuestPortalSettingsPanel } from '@/components/dashboard/guest-portal-settings-panel'
import { GuestFeedbackPanel } from '@/components/dashboard/guest-feedback-panel'
import { PageHeader } from '@/components/dashboard/page-header'
import { loadHotelGuestFeedback } from '@/lib/data/guest-feedback'
import { getActiveHotelSettings } from '@/lib/data/settings'
import { getNotificationLog } from '@/lib/data/notification-log'
import { getAuditLog } from '@/lib/data/audit-log'
import { getProfile } from '@/lib/auth/get-profile'

export default async function SettingsPage() {
  const hotelSettings = await getActiveHotelSettings()
  const [profile, notificationLog, auditLog, guestFeedback] = await Promise.all([
    getProfile(),
    getNotificationLog(50),
    getAuditLog(50),
    hotelSettings?.id ? loadHotelGuestFeedback(hotelSettings.id, 20) : Promise.resolve(null),
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
          <GuestRulesPanel hotelId={hotelSettings.id} propertyName={hotelSettings.name} />
          <GuestPortalSettingsPanel hotelId={hotelSettings.id} propertyName={hotelSettings.name} />
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
          {guestFeedback && <GuestFeedbackPanel summary={guestFeedback} />}
        </>
      )}
      <AuditLogPanel entries={auditLog} />
      <NotificationLogPanel entries={notificationLog} />
    </div>
  )
}
