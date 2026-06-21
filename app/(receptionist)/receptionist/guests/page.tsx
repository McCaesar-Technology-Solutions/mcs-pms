import { GuestsTable } from '@/components/dashboard/guests-table'
import { PageHeader } from '@/components/dashboard/page-header'
import { WalkInCheckInCta } from '@/components/guest/walk-in-check-in-cta'
import { getGuestsData } from '@/lib/data/guests'

export default async function ReceptionistGuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const guests = await getGuestsData()

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="CRM"
        title="Guests"
        description="Check in walk-ins and manage active stays."
      />
      <WalkInCheckInCta reservationsHref="/receptionist/reservations" />
      <GuestsTable guests={guests} initialSearch={q} />
    </div>
  )
}
