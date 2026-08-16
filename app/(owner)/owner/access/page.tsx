import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/dashboard/page-header'
import { PageTabShell } from '@/components/dashboard/page-tab-shell'
import { AccessControlSettingsPanel } from '@/components/dashboard/access-control-settings-panel'
import { AccessOpsPanel } from '@/components/dashboard/access-ops-panel'
import { AccessAgentInstallCard } from '@/components/dashboard/access-agent-install-card'
import { AccessStatusStrip } from '@/components/dashboard/access-status-strip'
import { StaffAccessPanel } from '@/components/dashboard/staff-access-panel'
import { AttendancePanel } from '@/components/dashboard/attendance-panel'
import { ACCESS_HASH_TO_TAB, accessTabsForRole } from '@/lib/access/access-page-tabs'
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

function openJobBadge(jobs: { status: string }[]) {
  return jobs.filter(
    (j) =>
      j.status === 'pending' ||
      j.status === 'claimed' ||
      j.status === 'failed' ||
      j.status === 'dead',
  ).length
}

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
  const lastPullJob = jobs.find((j) => j.job_type === 'pull_attendance') ?? null
  const hasEnrollmentStation = devices.some(
    (d) => d.device_role === 'enrollment' && d.managed_in_cloud,
  )
  const mode = summary.deviceCredentialMode ?? 'cloud'
  const doorReady =
    mode !== 'cloud' ||
    devices.some((d) => d.device_role === 'door' && d.managed_in_cloud && d.has_password)
  const setupHealthy =
    summary.enabled &&
    summary.hotelFlagEnabled &&
    summary.hasAgentToken &&
    summary.agentOnline &&
    doorReady &&
    points.some((p) => p.is_active)

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Access"
        title="Access"
        description="Today for unlocks. Guests for badges. Staff and attendance when you need them. Setup when something is missing."
      />

      <AccessStatusStrip
        integration={summary}
        jobs={jobs}
        lastPullJob={lastPullJob}
        viewerRole="owner"
      />

      <PageTabShell
        stickyNav
        defaultTab="today"
        hashToTab={ACCESS_HASH_TO_TAB}
        tabs={accessTabsForRole('owner', {
          openJobBadge: openJobBadge(jobs),
          setupHealthy,
        })}
        panels={{
          today: (
            <AccessOpsPanel
              hotelId={hotelId}
              points={points}
              credentials={credentials}
              jobs={jobs}
              devices={devices}
              viewerRole="owner"
              focus="today"
            />
          ),
          guests: (
            <AccessOpsPanel
              hotelId={hotelId}
              points={points}
              credentials={credentials}
              jobs={jobs}
              devices={devices}
              viewerRole="owner"
              focus="guests"
            />
          ),
          staff: (
            <StaffAccessPanel
              hotelId={hotelId}
              policies={policies}
              points={points}
              staffCredentials={staffCredentials}
              linkableProfiles={linkableProfiles}
              hasEnrollmentStation={hasEnrollmentStation}
              canCreateOwnerTypes
            />
          ),
          attendance: (
            <AttendancePanel
              hotelId={hotelId}
              records={attendance}
              lastPullJob={lastPullJob}
              hasAttendanceDevice={devices.some((d) => d.device_role === 'attendance')}
              agentOnline={summary.agentOnline}
              canOpenSetup
            />
          ),
          setup: (
            <>
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
                hasStaffPolicyDoors={policies.some((p) => (p.point_ids?.length ?? 0) > 0)}
              />
              <AccessAgentInstallCard links={agentDownloads} />
            </>
          ),
        }}
      />
    </div>
  )
}
