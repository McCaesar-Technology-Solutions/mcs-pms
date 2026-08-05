import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/dashboard/page-header'
import { AccessControlSettingsPanel } from '@/components/dashboard/access-control-settings-panel'
import { AccessOpsPanel } from '@/components/dashboard/access-ops-panel'
import { getProfile } from '@/lib/auth/get-profile'
import { getActiveHotelSettings } from '@/lib/data/settings'
import {
  getAccessCredentials,
  getAccessDevices,
  getAccessIntegrationSummary,
  getAccessPoints,
  getRecentAccessJobs,
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
  const [integration, points, credentials, jobs, devices] = await Promise.all([
    getAccessIntegrationSummary(hotelId),
    getAccessPoints(hotelId),
    getAccessCredentials(hotelId),
    getRecentAccessJobs(hotelId),
    getAccessDevices(hotelId),
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

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Access"
        title="Access control"
        description="Hikvision door enrollment driven by check-in and checkout — no separate iVMS for guests."
      />

      <AccessControlSettingsPanel
        hotelId={hotelId}
        propertyName={hotelSettings.name}
        integration={summary}
        points={points}
        rooms={(rooms ?? []).map((r) => ({ id: r.id, number: r.number }))}
        devices={devices}
        deviceKeys={devices
          .filter((d) => d.device_role !== 'enrollment')
          .map((d) => d.device_key)}
        canManage
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
