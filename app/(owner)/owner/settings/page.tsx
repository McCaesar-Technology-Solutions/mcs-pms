import { SettingsPanel } from '@/components/dashboard/settings-panel'
import { NotificationPreferencesPanel } from '@/components/dashboard/notification-preferences-panel'
import { EmailNotificationPreferencesPanel } from '@/components/dashboard/email-notification-preferences-panel'
import { NotificationLogPanel } from '@/components/dashboard/notification-log-panel'
import { AuditLogPanel } from '@/components/dashboard/audit-log-panel'
import { GuestRulesPanel } from '@/components/dashboard/guest-rules-panel'
import { GuestPortalSettingsPanel } from '@/components/dashboard/guest-portal-settings-panel'
import { PageHeader } from '@/components/dashboard/page-header'
import { PageTabShell } from '@/components/dashboard/page-tab-shell'
import { getActiveHotelSettings } from '@/lib/data/settings'
import { getNotificationLog } from '@/lib/data/notification-log'
import { getAuditLog } from '@/lib/data/audit-log'
import { SubscriptionPlanPanel } from '@/components/dashboard/subscription-plan-panel'
import { getProfile } from '@/lib/auth/get-profile'
import { getOwnerProperties } from '@/lib/data/properties'
import { getSubscriptionForOwner } from '@/lib/saas/organization'

const SETTINGS_HASH_TO_TAB: Record<string, string> = {
  plan: 'plan',
  billing: 'plan',
  'guest-portal': 'guest-portal',
  'guest-feedback': 'guest-portal',
  'guest-requests': 'guest-portal',
  notifications: 'alerts',
  'audit-log': 'activity',
  'sms-log': 'activity',
}

export default async function SettingsPage() {
  const hotelSettings = await getActiveHotelSettings()
  const profile = await getProfile()
  const [notificationLog, auditLog, properties, subscription] = await Promise.all([
    getNotificationLog(50),
    getAuditLog(50),
    getOwnerProperties(),
    profile?.id ? getSubscriptionForOwner(profile.id) : Promise.resolve(null),
  ])

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Configuration"
        title="Settings"
        description="Manage property details, guest portal, alerts, and activity history."
      />

      <PageTabShell
        hashToTab={SETTINGS_HASH_TO_TAB}
        defaultTab="property"
        tabs={[
          { id: 'property', label: 'Property' },
          { id: 'plan', label: 'Plan' },
          { id: 'guest-portal', label: 'Guest portal' },
          { id: 'alerts', label: 'Alerts' },
          { id: 'activity', label: 'Activity' },
        ]}
        panels={{
          property: <SettingsPanel hotelSettings={hotelSettings} profile={profile} />,
          plan: (
            <SubscriptionPlanPanel subscription={subscription} propertyCount={properties.length} />
          ),
          'guest-portal':
            hotelSettings != null ? (
              <>
                <GuestPortalSettingsPanel
                  hotelId={hotelSettings.id}
                  propertyName={hotelSettings.name}
                />
                <GuestRulesPanel hotelId={hotelSettings.id} propertyName={hotelSettings.name} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add a property first to configure the guest portal.
              </p>
            ),
          alerts:
            hotelSettings != null ? (
              <div className="grid gap-6 xl:grid-cols-2">
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
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add a property first to configure alerts.
              </p>
            ),
          activity: (
            <div className="grid gap-6 xl:grid-cols-2">
              <AuditLogPanel entries={auditLog} />
              <NotificationLogPanel entries={notificationLog} />
            </div>
          ),
        }}
      />
    </div>
  )
}
