import { PageHeader } from '@/components/dashboard/page-header'
import { StaffAvailability } from '@/components/dashboard/staff-availability'

export default function OwnerStaffPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Team"
        title="Staff"
        description="Manage managers and view staff across your hotel."
      />
      <StaffAvailability />
    </div>
  )
}
