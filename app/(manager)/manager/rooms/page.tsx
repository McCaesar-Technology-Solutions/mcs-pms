import { StaffRoomsPage } from '@/components/dashboard/staff-rooms-page'

export default async function ManagerRoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; filter?: string; opsDate?: string }>
}) {
  return (
    <StaffRoomsPage
      routePrefix="/manager"
      badge="Rooms"
      title="Room Status"
      description="Floor board and grid view with live arrival, departure, and housekeeping signals."
      defaultView="floor"
      searchParams={searchParams}
    />
  )
}
