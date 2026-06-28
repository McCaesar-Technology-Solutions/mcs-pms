import { StaffReservationsPage } from '@/components/dashboard/staff-reservations-page'

export default function ReceptionistReservationsPage({
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
      description="Create bookings, check guests in and out, and manage stays."
      searchParams={searchParams}
    />
  )
}
