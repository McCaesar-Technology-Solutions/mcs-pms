import { PageHeader } from '@/components/dashboard/page-header'
import { StaffManager } from '@/components/dashboard/staff-manager'
import { getStaffData } from '@/lib/data/staff'

export default async function ManagerStaffPage() {
  const { profile, staff, invites } = await getStaffData()

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Team"
        title="Technicians"
        description="Invite technicians and manage their access."
      />
      {profile ? (
        <StaffManager currentProfile={profile} staff={staff} invites={invites} />
      ) : (
        <p className="text-sm text-muted-foreground">Unable to load your team right now.</p>
      )}
    </div>
  )
}
