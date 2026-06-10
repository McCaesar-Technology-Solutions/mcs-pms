import { SettingsPanel } from '@/components/dashboard/settings-panel'
import { PageHeader } from '@/components/dashboard/page-header'
import { getActiveHotelSettings } from '@/lib/data/settings'

export default async function SettingsPage() {
  const hotelSettings = await getActiveHotelSettings()

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Configuration"
        title="Settings"
        description="Manage property details, tax compliance, and your apartment portfolio."
      />

      <SettingsPanel hotelSettings={hotelSettings} />
    </div>
  )
}
