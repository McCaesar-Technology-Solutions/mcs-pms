import { StaffReservationsPage } from '@/components/dashboard/staff-reservations-page'

export default function ManagerReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    open?: string
    checkIn?: string
    checkOut?: string
    status?: string
    payment?: string
  }>
}) {
  return (
    <StaffReservationsPage
      badge="Bookings"
      title="Reservations"
      description="View and manage all guest reservations across properties."
      searchParams={searchParams}
    />
  )
}
