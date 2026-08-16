import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/dashboard/page-header'
import { PageTabShell } from '@/components/dashboard/page-tab-shell'
import { AccessOpsPanel } from '@/components/dashboard/access-ops-panel'
import { AccessStatusStrip } from '@/components/dashboard/access-status-strip'
import { StaffAccessPanel } from '@/components/dashboard/staff-access-panel'
import { AttendancePanel } from '@/components/dashboard/attendance-panel'
import { ACCESS_HASH_TO_TAB, accessTabsForRole } from '@/lib/access/access-page-tabs'
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

function openJobBadge(jobs: { status: string }[]) {
  return jobs.filter(
    (j) =>
      j.status === 'pending' ||
      j.status === 'claimed' ||
      j.status === 'failed' ||
      j.status === 'dead',
  ).length
}

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

  const lastPullJob = jobs.find((j) => j.job_type === 'pull_attendance') ?? null

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Access"
        title="Access"
        description="Unlock doors, issue guest badges, and manage approved staff access."
      />

      <AccessStatusStrip
        integration={summary}
        jobs={jobs}
        lastPullJob={lastPullJob}
        viewerRole="manager"
      />

      <PageTabShell
        stickyNav
        defaultTab="today"
        hashToTab={ACCESS_HASH_TO_TAB}
        tabs={accessTabsForRole('manager', { openJobBadge: openJobBadge(jobs) })}
        panels={{
          today: (
            <AccessOpsPanel
              hotelId={hotelId}
              points={points}
              credentials={credentials}
              jobs={jobs}
              devices={devices}
              viewerRole="manager"
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
              viewerRole="manager"
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
              hasEnrollmentStation={devices.some(
                (d) => d.device_role === 'enrollment' && d.managed_in_cloud,
              )}
              canCreateOwnerTypes={false}
            />
          ),
          attendance: (
            <AttendancePanel
              hotelId={hotelId}
              records={attendance}
              lastPullJob={lastPullJob}
              hasAttendanceDevice={devices.some((d) => d.device_role === 'attendance')}
              agentOnline={summary.agentOnline}
              canOpenSetup={false}
            />
          ),
        }}
      />
    </div>
  )
}
