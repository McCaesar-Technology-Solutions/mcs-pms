import { PageHeader } from '@/components/dashboard/page-header'
import { StaffManager } from '@/components/dashboard/staff-manager'
import { getOwnerStaffAssignmentUi, getStaffData } from '@/lib/data/staff'

export default async function OwnerStaffPage() {
  const { profile, staff, invites, compensationByProfileId } = await getStaffData()
  const assignmentUi =
    profile?.role === 'owner' && profile.hotel_id
      ? await getOwnerStaffAssignmentUi(profile.id, profile.hotel_id)
      : null

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Team"
        title="Staff"
        description="Invite new people, or assign an existing manager to another of your properties."
      />
      {profile ? (
        <StaffManager
          currentProfile={profile}
          staff={staff}
          invites={invites}
          compensationByProfileId={compensationByProfileId}
          assignmentUi={assignmentUi}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Unable to load your team right now.</p>
      )}
    </div>
  )
}
