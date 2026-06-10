import { RoomStatusGrid } from '@/components/dashboard/room-status-grid'
import { PageHeader } from '@/components/dashboard/page-header'

export default function OwnerRoomsPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Inventory"
        title="Rooms"
        description="Live room status across your property."
      />
      <RoomStatusGrid />
    </div>
  )
}
