import { GuestsTable } from '@/components/dashboard/guests-table'
import { PageHeader } from '@/components/dashboard/page-header'
import { PropertyPortalQrPanel } from '@/components/guest/property-portal-qr-panel'
import { WalkInCheckInCta } from '@/components/guest/walk-in-check-in-cta'
import { getGuestsData } from '@/lib/data/guests'

export default async function OwnerGuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const guests = await getGuestsData()

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="CRM"
        title="Guests"
        description="View guest directory and stay history across your property."
      />
      <PropertyPortalQrPanel />
      <WalkInCheckInCta reservationsHref="/owner/reservations" />
      <GuestsTable guests={guests} initialSearch={q} />
    </div>
  )
}
