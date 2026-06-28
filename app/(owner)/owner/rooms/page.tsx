import { StaffRoomsPage } from '@/components/dashboard/staff-rooms-page'

export default async function OwnerRoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; filter?: string; opsDate?: string }>
}) {
  return (
    <StaffRoomsPage
      routePrefix="/owner"
      badge="Inventory"
      title="Rooms"
      description="Live room status across your property — grid or floor board."
      canDelete
      defaultView="grid"
      searchParams={searchParams}
    />
  )
}
