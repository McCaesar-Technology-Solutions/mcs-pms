import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/dashboard/page-header'
import { AccessOpsPanel } from '@/components/dashboard/access-ops-panel'
import { getProfile } from '@/lib/auth/get-profile'
import {
  getAccessCredentials,
  getAccessIntegrationSummary,
  getAccessPoints,
  getRecentAccessJobs,
} from '@/lib/data/access-control'

export default async function ReceptionistAccessPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'receptionist' || !profile.hotel_id) {
    redirect('/login')
  }

  const hotelId = profile.hotel_id
  const [integration, points, credentials, jobs] = await Promise.all([
    getAccessIntegrationSummary(hotelId),
    getAccessPoints(hotelId),
    getAccessCredentials(hotelId),
    getRecentAccessJobs(hotelId),
  ])

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Access"
        title="Access control"
        description={
          integration?.agentOnline
            ? 'Issue cards and unlock doors for in-house guests.'
            : 'Agent offline — jobs will run when the on-site agent reconnects.'
        }
      />

      <AccessOpsPanel
        hotelId={hotelId}
        points={points}
        credentials={credentials}
        jobs={jobs}
      />
    </div>
  )
}
