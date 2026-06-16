import { GuestsTable } from '@/components/dashboard/guests-table'
import { PageHeader } from '@/components/dashboard/page-header'
import { PropertyPortalQrPanel } from '@/components/guest/property-portal-qr-panel'
import { getGuestsData } from '@/lib/data/guests'

export default async function OwnerGuestsPage({
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
        description="View guest directory and stay history across your property."
      />
      <PropertyPortalQrPanel />
      <GuestsTable guests={guests} initialSearch={q} />
    </div>
  )
}
