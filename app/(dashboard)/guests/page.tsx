import { GuestsTable } from '@/components/dashboard/guests-table'
import { PageHeader } from '@/components/dashboard/page-header'

export default function GuestsPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="CRM"
        title="Guests"
        description="Manage all guests, view stay history, preferences, and communication records."
      />

      <GuestsTable guests={[]} />
    </div>
  )
}
