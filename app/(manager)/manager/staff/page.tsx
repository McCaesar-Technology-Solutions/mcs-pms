import { PageHeader } from '@/components/dashboard/page-header'
import { StaffAvailability } from '@/components/dashboard/staff-availability'

export default function ManagerStaffPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Team"
        title="Technicians"
        description="Manage technician assignments and availability."
      />
      <StaffAvailability />
    </div>
  )
}
