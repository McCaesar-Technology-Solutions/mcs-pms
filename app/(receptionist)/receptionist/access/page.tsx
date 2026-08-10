import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/dashboard/page-header'
import { PageTabShell } from '@/components/dashboard/page-tab-shell'
import { AccessOpsPanel } from '@/components/dashboard/access-ops-panel'
import { AccessStatusStrip } from '@/components/dashboard/access-status-strip'
import { ACCESS_HASH_TO_TAB, accessTabsForRole } from '@/lib/access/access-page-tabs'
import { getProfile } from '@/lib/auth/get-profile'
import {
  getAccessCredentials,
  getAccessDevices,
  getAccessIntegrationSummary,
  getAccessPoints,
  getRecentAccessJobs,
} from '@/lib/data/access-control'

function openJobBadge(jobs: { status: string }[]) {
  return jobs.filter(
    (j) => j.status === 'pending' || j.status === 'claimed' || j.status === 'failed',
  ).length
}

export default async function ReceptionistAccessPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'receptionist' || !profile.hotel_id) {
    redirect('/login')
  }

  const hotelId = profile.hotel_id
  const [integration, points, credentials, jobs, devices] = await Promise.all([
    getAccessIntegrationSummary(hotelId),
    getAccessPoints(hotelId),
    getAccessCredentials(hotelId),
    getRecentAccessJobs(hotelId),
    getAccessDevices(hotelId),
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

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Access"
        title="Access control"
        description="Issue cards and unlock doors for in-house guests."
      />

      <AccessStatusStrip integration={summary} jobs={jobs} viewerRole="receptionist" />

      <PageTabShell
        stickyNav
        defaultTab="today"
        hashToTab={ACCESS_HASH_TO_TAB}
        tabs={accessTabsForRole('receptionist', openJobBadge(jobs))}
        panels={{
          today: (
            <AccessOpsPanel
              hotelId={hotelId}
              points={points}
              credentials={credentials}
              jobs={jobs}
              devices={devices}
              viewerRole="receptionist"
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
              viewerRole="receptionist"
              focus="guests"
            />
          ),
        }}
      />
    </div>
  )
}
