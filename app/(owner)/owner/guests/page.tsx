import { GuestsTable } from '@/components/dashboard/guests-table'
import { PageHeader } from '@/components/dashboard/page-header'
import { PropertyPortalQrPanel } from '@/components/guest/property-portal-qr-panel'
import { WalkInCheckInCta } from '@/components/guest/walk-in-check-in-cta'
import { getGuestsPage, type GuestStatus } from '@/lib/data/guests'
import { parsePageParam } from '@/lib/data/pagination'

const GUEST_STATUSES: GuestStatus[] = ['active', 'returning', 'vip', 'new']

function parseGuestStatus(value: string | undefined): GuestStatus | null {
  if (!value) return null
  return GUEST_STATUSES.includes(value as GuestStatus) ? (value as GuestStatus) : null
}

export default async function OwnerGuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; open?: string; page?: string; status?: string }>
}) {
  const { q, open, page: pageParam, status: statusParam } = await searchParams
  const page = parsePageParam(pageParam)
  const status = parseGuestStatus(statusParam)
  const guestsPage = await getGuestsPage({ page, search: q, status })

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="CRM"
        title="Guests"
        description="View guest directory and stay history across your property."
      />
      <PropertyPortalQrPanel />
      <WalkInCheckInCta reservationsHref="/owner/reservations" />
      <GuestsTable
        guests={guestsPage.guests}
        initialSearch={q}
        openGuestId={open}
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
