import { GuestsTable } from '@/components/dashboard/guests-table'
import { PageHeader } from '@/components/dashboard/page-header'
import { GuestEnrollment } from '@/components/guest/guest-enrollment'

export default function ManagerGuestsPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="CRM"
        title="Guests"
        description="Enroll guests and manage active stays."
      />
      <GuestEnrollment />
      <GuestsTable />
    </div>
  )
}
