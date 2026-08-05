import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/dashboard/page-header'
import { AccessOpsPanel } from '@/components/dashboard/access-ops-panel'
import { getProfile } from '@/lib/auth/get-profile'
import {
  getAccessCredentials,
  getAccessDevices,
  getAccessIntegrationSummary,
  getAccessPoints,
  getRecentAccessJobs,
} from '@/lib/data/access-control'

export default async function ManagerAccessPage() {
  const profile = await getProfile()
  if (!profile || !['manager', 'owner'].includes(profile.role) || !profile.hotel_id) {
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

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Access"
        title="Access control"
        description={
          integration?.agentOnline
            ? 'Agent online — unlock doors and manage guest credentials.'
            : 'Agent offline or not configured — unlock jobs will queue until it reconnects.'
        }
      />

      <AccessOpsPanel
        hotelId={hotelId}
        points={points}
        credentials={credentials}
        jobs={jobs}
        devices={devices}
      />
    </div>
  )
}
