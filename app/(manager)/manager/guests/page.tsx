import { GuestsTable } from '@/components/dashboard/guests-table'
import { PageHeader } from '@/components/dashboard/page-header'
import { WalkInCheckInCta } from '@/components/guest/walk-in-check-in-cta'
import { PropertyPortalQrPanel } from '@/components/guest/property-portal-qr-panel'
import { getGuestsData } from '@/lib/data/guests'

export default async function ManagerGuestsPage({
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
        description="Enroll guests and manage active stays."
      />
      <PropertyPortalQrPanel />
      <WalkInCheckInCta reservationsHref="/manager/reservations" />
      <GuestsTable guests={guests} initialSearch={q} />
    </div>
  )
}
