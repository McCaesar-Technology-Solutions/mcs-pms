import { RoomsManager } from '@/components/dashboard/rooms-manager'
import { PageHeader } from '@/components/dashboard/page-header'
import { getDashboardData } from '@/lib/data/dashboard'

export default async function ManagerRoomsPage() {
  const { dbRooms } = await getDashboardData()

  return (
    <div className="page-shell space-y-6">
      <PageHeader badge="Rooms" title="Room Status" description="Update and monitor room availability." />
      <RoomsManager rooms={dbRooms} />
    </div>
  )
}
