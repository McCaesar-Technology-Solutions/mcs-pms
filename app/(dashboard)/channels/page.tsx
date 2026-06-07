import { ChannelsManager } from '@/components/dashboard/channels-manager'
import { PageHeader } from '@/components/dashboard/page-header'

export default function ChannelsPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Distribution"
        title="Distribution Channels"
        description="Manage OTA integrations, sync listings, and monitor bookings across all channels."
      />

      <ChannelsManager />
    </div>
  )
}
