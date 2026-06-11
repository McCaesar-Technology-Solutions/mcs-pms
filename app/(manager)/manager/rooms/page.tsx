import { RoomsManager } from '@/components/dashboard/rooms-manager'
import { PageHeader } from '@/components/dashboard/page-header'
import { getDashboardData } from '@/lib/data/dashboard'
import { getRoomCategories } from '@/lib/data/room-categories'

export default async function ManagerRoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const [{ dbRooms }, categories] = await Promise.all([getDashboardData(), getRoomCategories()])

  return (
    <div className="page-shell space-y-6">
      <PageHeader badge="Rooms" title="Room Status" description="Update and monitor room availability." />
      <RoomsManager rooms={dbRooms} categories={categories} initialSearch={q} />
    </div>
  )
}
