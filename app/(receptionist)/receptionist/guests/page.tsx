import { GuestsTable } from '@/components/dashboard/guests-table'
import { PageHeader } from '@/components/dashboard/page-header'
import { PropertyPortalQrPanel } from '@/components/guest/property-portal-qr-panel'
import { RegisterInHouseGuestCta } from '@/components/guest/register-in-house-guest'
import { WalkInCheckInCta } from '@/components/guest/walk-in-check-in-cta'
import { getGuestsPage, parseGuestDirectoryFilter } from '@/lib/data/guests'
import { parsePageParam } from '@/lib/data/pagination'

export default async function ReceptionistGuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; open?: string; page?: string; status?: string }>
}) {
  const { q, open, page: pageParam, status: statusParam } = await searchParams
  const page = parsePageParam(pageParam)
  const status = parseGuestDirectoryFilter(statusParam)
  const guestsPage = await getGuestsPage({ page, search: q, status })

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="CRM"
        title="Guests"
        description="In-house stays first, then past guests. Loyalty (first stay, returning, VIP) is separate from occupancy."
      />
      <PropertyPortalQrPanel />
      <RegisterInHouseGuestCta />
      <WalkInCheckInCta reservationsHref="/receptionist/reservations" />
      <GuestsTable
        guests={guestsPage.guests}
        initialSearch={q}
        openGuestId={open}
        staffRole="receptionist"
        serverPagination={{
          page: guestsPage.page,
          totalPages: guestsPage.totalPages,
          totalItems: guestsPage.totalCount,
          pageSize: guestsPage.pageSize,
        }}
        initialStatus={status}
      />
    </div>
  )
}
