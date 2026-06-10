import { RoomsManager } from '@/components/dashboard/rooms-manager'
import { PageHeader } from '@/components/dashboard/page-header'
import { getDashboardData } from '@/lib/data/dashboard'

export default async function OwnerRoomsPage() {
  const { dbRooms } = await getDashboardData()

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Inventory"
        title="Rooms"
        description="Live room status across your property."
      />
      <RoomsManager rooms={dbRooms} canDelete />
    </div>
  )
}
