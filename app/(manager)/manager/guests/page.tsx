import { GuestsTable } from '@/components/dashboard/guests-table'
import { PageHeader } from '@/components/dashboard/page-header'
import { GuestEnrollment } from '@/components/guest/guest-enrollment'
import { getGuestsData } from '@/lib/data/guests'

export default async function ManagerGuestsPage({
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
        description="Enroll guests and manage active stays."
      />
      <GuestEnrollment />
      <GuestsTable guests={guests} initialSearch={q} />
    </div>
  )
}
