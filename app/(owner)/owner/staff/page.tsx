import { PageHeader } from '@/components/dashboard/page-header'
import { StaffManager } from '@/components/dashboard/staff-manager'
import { getStaffData } from '@/lib/data/staff'

export default async function OwnerStaffPage() {
  const { profile, staff, invites } = await getStaffData()

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Team"
        title="Staff"
        description="Invite managers and technicians, and manage access across your hotel."
      />
      {profile ? (
        <StaffManager currentProfile={profile} staff={staff} invites={invites} />
      ) : (
        <p className="text-sm text-muted-foreground">Unable to load your team right now.</p>
      )}
    </div>
  )
}
