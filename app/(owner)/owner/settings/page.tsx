import { SettingsPanel } from '@/components/dashboard/settings-panel'
import { PageHeader } from '@/components/dashboard/page-header'
import { getActiveHotelSettings } from '@/lib/data/settings'
import { getProfile } from '@/lib/auth/get-profile'

export default async function SettingsPage() {
  const [hotelSettings, profile] = await Promise.all([
    getActiveHotelSettings(),
    getProfile(),
  ])

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Configuration"
        title="Settings"
        description="Manage property details, tax compliance, and your apartment portfolio."
      />

      <SettingsPanel hotelSettings={hotelSettings} profile={profile} />
    </div>
  )
}
