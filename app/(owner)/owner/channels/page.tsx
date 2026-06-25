import { ChannelsPanel } from '@/components/dashboard/channels-panel'
import { PageHeader } from '@/components/dashboard/page-header'
import { getChannelsData } from '@/lib/data/channels'

export default async function ChannelsPage() {
  const data = await getChannelsData()

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Distribution"
        title="Channel sync"
        description="Import OTA bookings via iCal and export your availability to Airbnb and Booking.com."
      />

      {!data ? (
        <p className="text-sm text-muted-foreground">Sign in as property owner to manage channels.</p>
      ) : (
        <ChannelsPanel
          importFeeds={data.importFeeds}
          exportFeeds={data.exportFeeds}
          rooms={data.rooms}
        />
      )}
    </div>
  )
}
