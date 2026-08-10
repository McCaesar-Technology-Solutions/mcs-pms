import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/dashboard/page-header'
import { AccessControlSettingsPanel } from '@/components/dashboard/access-control-settings-panel'
import { AccessOpsPanel } from '@/components/dashboard/access-ops-panel'
import { AccessAgentInstallCard } from '@/components/dashboard/access-agent-install-card'
import { StaffAccessPanel } from '@/components/dashboard/staff-access-panel'
import { AttendancePanel } from '@/components/dashboard/attendance-panel'
import { getAccessAgentDownloadLinks } from '@/lib/access/agent-downloads'
import { getProfile } from '@/lib/auth/get-profile'
import { getActiveHotelSettings } from '@/lib/data/settings'
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
import { createAdminClient } from '@/lib/supabase/admin'

export default async function OwnerAccessPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'owner') redirect('/login')

  const hotelSettings = await getActiveHotelSettings()
  if (!hotelSettings) {
    return (
      <div className="page-shell page-content-stack">
        <PageHeader
          badge="Access"
          title="Access control"
          description="Add a property first, then connect Hikvision."
        />
      </div>
    )
  }

  const hotelId = hotelSettings.id
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

  const admin = createAdminClient()
  const { data: rooms } = await admin
    .from('rooms')
    .select('id, number')
    .eq('hotel_id', hotelId)
    .order('number')

  const summary =
    integration ??
    ({
      hotelId,
      enabled: false,
      hotelFlagEnabled: false,
      hasAgentToken: false,
      agentTokenPrefix: null,
      agentLastSeenAt: null,
      agentVersion: null,
      agentHostname: null,
      agentOnline: false,
      deviceCredentialMode: 'cloud' as const,
    } as const)

  const agentDownloads = getAccessAgentDownloadLinks()

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Access"
        title="Access control"
        description="Hikvision door enrollment driven by check-in and checkout — no separate iVMS for guests."
      />

      <AccessAgentInstallCard links={agentDownloads} />

      <AccessControlSettingsPanel
        hotelId={hotelId}
        propertyName={hotelSettings.name}
        integration={summary}
        points={points}
        rooms={(rooms ?? []).map((r) => ({ id: r.id, number: r.number }))}
        devices={devices}
        deviceKeys={devices
          .filter((d) => d.device_role === 'door')
          .map((d) => d.device_key)}
        canManage
        agentDownloads={agentDownloads}
        hasStaffPolicyDoors={policies.some((p) => p.point_ids.length > 0)}
      />

      <StaffAccessPanel
        hotelId={hotelId}
        policies={policies}
        points={points}
        staffCredentials={staffCredentials}
        linkableProfiles={linkableProfiles}
        hasEnrollmentStation={devices.some(
          (d) => d.device_role === 'enrollment' && d.managed_in_cloud,
        )}
        canCreateOwnerTypes
      />

      <AttendancePanel
        hotelId={hotelId}
        records={attendance}
        lastPullJob={jobs.find((j) => j.job_type === 'pull_attendance') ?? null}
      />

      <AccessOpsPanel
        hotelId={hotelId}
        points={points}
        credentials={credentials}
        jobs={jobs}
        devices={devices}
        viewerRole="owner"
      />
    </div>
  )
}
