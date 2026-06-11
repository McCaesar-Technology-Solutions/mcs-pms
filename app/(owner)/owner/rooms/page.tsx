import { RoomsManager } from '@/components/dashboard/rooms-manager'
import { PageHeader } from '@/components/dashboard/page-header'
import { getDashboardData } from '@/lib/data/dashboard'
import { getRoomCategories } from '@/lib/data/room-categories'

export default async function OwnerRoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const [{ dbRooms }, categories] = await Promise.all([getDashboardData(), getRoomCategories()])

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Inventory"
        title="Rooms"
        description="Live room status across your property."
      />
      <RoomsManager rooms={dbRooms} categories={categories} canDelete initialSearch={q} />
    </div>
  )
}
