import { RoomStatusGrid } from '@/components/dashboard/room-status-grid'
import { PageHeader } from '@/components/dashboard/page-header'

export default function ManagerRoomsPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHeader badge="Rooms" title="Room Status" description="Update and monitor room availability." />
      <RoomStatusGrid />
    </div>
  )
}
