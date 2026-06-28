import { StaffRoomsPage } from '@/components/dashboard/staff-rooms-page'

export default async function ReceptionistRoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; filter?: string; opsDate?: string }>
}) {
  return (
    <StaffRoomsPage
      routePrefix="/receptionist"
      badge="Rooms"
      title="Room Status"
      description="Update room availability as guests arrive and leave."
      statusOnly
      defaultView="floor"
      searchParams={searchParams}
    />
  )
}
