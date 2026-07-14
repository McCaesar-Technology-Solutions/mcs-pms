import { ReservationsManager } from '@/components/dashboard/reservations-manager'
import { ReservationsTimelineSection } from '@/components/dashboard/reservations-timeline-section'
import { PageHeader } from '@/components/dashboard/page-header'
import {
  getReservationWorkspaceData,
  getReservationsPage,
} from '@/lib/data/reservations-page'
import { getProfile } from '@/lib/auth/get-profile'
import { parseReservationSearchParams } from '@/lib/reservations/search-params'

interface StaffReservationsPageProps {
  badge: string
  title: string
  description: string
  searchParams: Promise<{
    q?: string
    open?: string
    extend?: string
    extendDate?: string
    guestRequest?: string
    checkIn?: string
    checkOut?: string
    status?: string
    payment?: string
    pay?: string
    page?: string
  }>
}

export async function StaffReservationsPage({
  badge,
  title,
  description,
  searchParams,
}: StaffReservationsPageProps) {
  const params = await searchParams
  const { open, extend, extendDate, guestRequest } = params
  const parsed = parseReservationSearchParams(params)

  const [profile, workspace, reservationsPage] = await Promise.all([
    getProfile(),
    getReservationWorkspaceData(),
    getReservationsPage(parsed.filters, { includeReservationId: open }),
  ])

  return (
    <div className="page-shell page-content-stack">
      <PageHeader badge={badge} title={title} description={description} />

      <div className="flex flex-col gap-6">
        <div className="order-1 md:order-2">
          <ReservationsManager
            reservations={reservationsPage.reservations}
            roomOptions={workspace.roomOptions}
            occupancySpans={workspace.occupancySpans}
            staffRole={profile?.role ?? 'receptionist'}
            initialSearch={parsed.initialSearch}
            openReservationId={open}
            initialExtendStay={extend === '1'}
            initialExtendDate={extendDate}
            initialGuestRequestId={guestRequest}
            initialNewFlow={params.checkIn === '1' && !parsed.initialCheckInDate ? 'check_in' : undefined}
            initialCheckInDate={parsed.initialCheckInDate}
            initialCheckOutDate={parsed.initialCheckOutDate}
            initialStatus={parsed.initialStatus ?? 'all'}
            initialPaymentStatus={parsed.initialPaymentStatus ?? 'all'}
            initialPaymentSecured={parsed.initialPaymentSecured}
            serverPagination={{
              page: reservationsPage.page,
              totalPages: reservationsPage.totalPages,
              totalItems: reservationsPage.totalCount,
              pageSize: reservationsPage.pageSize,
            }}
          />
        </div>
        <div className="order-2 md:order-1">
          <ReservationsTimelineSection
            rooms={workspace.timelineRooms}
            bars={workspace.timelineBars}
          />
        </div>
      </div>
    </div>
  )
}
