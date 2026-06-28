import { ReservationsManager } from '@/components/dashboard/reservations-manager'
import { ReservationsTimelineSection } from '@/components/dashboard/reservations-timeline-section'
import { PageHeader } from '@/components/dashboard/page-header'
import { getDashboardData } from '@/lib/data/dashboard'
import { getProfile } from '@/lib/auth/get-profile'
import { parseReservationSearchParams } from '@/lib/reservations/search-params'

interface StaffReservationsPageProps {
  badge: string
  title: string
  description: string
  searchParams: Promise<{
    q?: string
    open?: string
    checkIn?: string
    checkOut?: string
    status?: string
    payment?: string
  }>
}

export async function StaffReservationsPage({
  badge,
  title,
  description,
  searchParams,
}: StaffReservationsPageProps) {
  const params = await searchParams
  const { q, open, checkIn } = params
  const filters = parseReservationSearchParams(params)
  const [profile, { reservations, roomOptions, occupancySpans, timelineRooms, timelineBars }] =
    await Promise.all([getProfile(), getDashboardData()])

  return (
    <div className="page-shell page-content-stack">
      <PageHeader badge={badge} title={title} description={description} />

      <div className="flex flex-col gap-6">
        <div className="order-1 md:order-2">
          <ReservationsManager
            reservations={reservations}
            roomOptions={roomOptions}
            occupancySpans={occupancySpans}
            staffRole={profile?.role ?? 'receptionist'}
            initialSearch={q}
            openReservationId={open}
            initialNewFlow={checkIn === '1' ? 'check_in' : undefined}
            initialCheckInDate={filters.initialCheckInDate}
            initialCheckOutDate={filters.initialCheckOutDate}
            initialStatus={filters.initialStatus}
            initialPaymentSecured={filters.initialPaymentSecured}
          />
        </div>
        <div className="order-2 md:order-1">
          <ReservationsTimelineSection rooms={timelineRooms} bars={timelineBars} />
        </div>
      </div>
    </div>
  )
}
