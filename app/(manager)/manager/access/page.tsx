import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/dashboard/page-header'
import { AccessOpsPanel } from '@/components/dashboard/access-ops-panel'
import { AccessAgentInstallCard } from '@/components/dashboard/access-agent-install-card'
import { StaffAccessPanel } from '@/components/dashboard/staff-access-panel'
import { AttendancePanel } from '@/components/dashboard/attendance-panel'
import { getAccessAgentDownloadLinks } from '@/lib/access/agent-downloads'
import { getProfile } from '@/lib/auth/get-profile'
import {
  getAccessCredentials,
  getAccessDevices,
  getAccessIntegrationSummary,
  getAccessLinkableProfiles,
  getAccessPoints,
  getAccessPoliciesForHotel,
  getAttendanceRecords,
  getRecentAccessJobs,
  getStaffAccessCredentials,
} from '@/lib/data/access-control'

export default async function ManagerAccessPage() {
  const profile = await getProfile()
  if (!profile || !['manager', 'owner'].includes(profile.role) || !profile.hotel_id) {
    redirect('/login')
  }

  const hotelId = profile.hotel_id
  const [
    integration,
    points,
    credentials,
    jobs,
    devices,
    policies,
    staffCredentials,
    attendance,
    linkableProfiles,
  ] = await Promise.all([
    getAccessIntegrationSummary(hotelId),
    getAccessPoints(hotelId),
    getAccessCredentials(hotelId),
    getRecentAccessJobs(hotelId),
    getAccessDevices(hotelId),
    getAccessPoliciesForHotel(hotelId),
    getStaffAccessCredentials(hotelId),
    getAttendanceRecords(hotelId),
    getAccessLinkableProfiles(hotelId),
  ])

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Access"
        title="Access control"
        description={
          integration?.agentOnline
            ? 'Agent online — unlock doors and manage guest + approved staff access.'
            : 'Agent offline or not configured — unlock jobs will queue until it reconnects.'
        }
      />

      <AccessAgentInstallCard links={getAccessAgentDownloadLinks()} />

      <StaffAccessPanel
        hotelId={hotelId}
        policies={policies}
        points={points}
        staffCredentials={staffCredentials}
        linkableProfiles={linkableProfiles}
        hasEnrollmentStation={devices.some(
          (d) => d.device_role === 'enrollment' && d.managed_in_cloud,
        )}
        canCreateOwnerTypes={false}
      />

      <AttendancePanel hotelId={hotelId} records={attendance} />

      <AccessOpsPanel
        hotelId={hotelId}
        points={points}
        credentials={credentials}
        jobs={jobs}
        devices={devices}
        viewerRole="manager"
      />
    </div>
  )
}
