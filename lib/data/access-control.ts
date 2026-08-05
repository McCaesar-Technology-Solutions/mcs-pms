import { createAdminClient } from '@/lib/supabase/admin'
import { resolveHotelTenantAccess } from '@/lib/data/tenant-guard'
import { isAgentOnline } from '@/lib/access/agent-auth'
import type {
  AccessCredentialRow,
  AccessDeviceRow,
  AccessIntegrationSummary,
  AccessPointRow,
  AccessJobRow,
  DeviceCredentialMode,
} from '@/lib/access/types'

export async function getAccessIntegrationSummary(
  hotelId: string,
): Promise<AccessIntegrationSummary | null> {
  const profile = await resolveHotelTenantAccess(hotelId, {
    roles: ['owner', 'manager', 'receptionist'],
  })
  if (!profile) return null

  const admin = createAdminClient()
  const [{ data: hotel }, { data: integration }] = await Promise.all([
    admin.from('hotels').select('access_control_enabled').eq('id', hotelId).maybeSingle(),
    admin.from('access_integrations').select('*').eq('hotel_id', hotelId).maybeSingle(),
  ])

  if (!hotel) return null

  const mode = (integration?.device_credential_mode ?? 'cloud') as DeviceCredentialMode

  return {
    hotelId,
    enabled: Boolean(integration?.enabled),
    hotelFlagEnabled: Boolean(hotel.access_control_enabled),
    hasAgentToken: Boolean(integration?.agent_token_hash),
    agentTokenPrefix: integration?.agent_token_prefix ?? null,
    agentLastSeenAt: integration?.agent_last_seen_at ?? null,
    agentVersion: integration?.agent_version ?? null,
    agentHostname: integration?.agent_hostname ?? null,
    agentOnline: isAgentOnline(integration?.agent_last_seen_at),
    deviceCredentialMode: mode === 'local' ? 'local' : 'cloud',
  }
}

export async function getAccessPoints(hotelId: string): Promise<AccessPointRow[]> {
  const profile = await resolveHotelTenantAccess(hotelId, {
    roles: ['owner', 'manager', 'receptionist'],
  })
  if (!profile) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('access_points')
    .select('*, rooms(number)')
    .eq('hotel_id', hotelId)
    .order('label', { ascending: true })

  return (data ?? []).map((row) => {
    const rooms = (row as unknown as { rooms?: { number: string } | { number: string }[] | null }).rooms
    const roomNumber = Array.isArray(rooms) ? rooms[0]?.number : rooms?.number
    return {
      id: row.id,
      hotel_id: row.hotel_id,
      device_key: row.device_key,
      door_no: row.door_no,
      label: row.label,
      zone: row.zone,
      room_id: row.room_id,
      grants_shared_access: row.grants_shared_access,
      is_active: row.is_active,
      room_number: roomNumber ?? null,
    }
  })
}

export async function getAccessCredentials(
  hotelId: string,
  limit = 50,
): Promise<AccessCredentialRow[]> {
  const profile = await resolveHotelTenantAccess(hotelId, {
    roles: ['owner', 'manager', 'receptionist'],
  })
  if (!profile) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('access_credentials')
    .select('*, guests(name, rooms(number))')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map((row) => {
    const guest = (row as unknown as {
      guests?: { name: string; rooms: { number: string } | { number: string }[] | null } | null
    }).guests
    const rooms = guest?.rooms
    const roomNumber = Array.isArray(rooms) ? rooms[0]?.number : rooms?.number
    return {
      id: row.id,
      hotel_id: row.hotel_id,
      guest_id: row.guest_id,
      reservation_id: row.reservation_id,
      employee_no: row.employee_no,
      display_name: row.display_name,
      card_no: row.card_no,
      has_pin: row.has_pin,
      has_face: Boolean((row as { has_face?: boolean }).has_face),
      has_fingerprint: Boolean((row as { has_fingerprint?: boolean }).has_fingerprint),
      valid_from: row.valid_from,
      valid_to: row.valid_to,
      status: row.status,
      sync_status: row.sync_status,
      last_error: row.last_error,
      last_synced_at: row.last_synced_at,
      guest_name: guest?.name ?? null,
      room_number: roomNumber ?? null,
    }
  })
}

export async function getRecentAccessJobs(hotelId: string, limit = 30): Promise<AccessJobRow[]> {
  const profile = await resolveHotelTenantAccess(hotelId, {
    roles: ['owner', 'manager', 'receptionist'],
  })
  if (!profile) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('access_jobs')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as AccessJobRow[]
}

export async function getAccessDevices(hotelId: string): Promise<AccessDeviceRow[]> {
  const profile = await resolveHotelTenantAccess(hotelId, {
    roles: ['owner', 'manager', 'receptionist'],
  })
  if (!profile) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('access_devices')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('label', { ascending: true })

  const devices = data ?? []
  if (!devices.length) return []

  const { data: secrets } = await admin
    .from('access_device_secrets')
    .select('device_id')
    .eq('hotel_id', hotelId)

  const withSecret = new Set((secrets ?? []).map((s) => s.device_id))

  return devices.map((d) => ({
    id: d.id,
    hotel_id: d.hotel_id,
    device_key: d.device_key,
    label: d.label,
    host: d.host ?? null,
    port: d.port ?? null,
    username: d.username ?? null,
    use_https: Boolean(d.use_https),
    managed_in_cloud: Boolean(d.managed_in_cloud),
    device_role:
      (d as { device_role?: string }).device_role === 'enrollment' ? 'enrollment' : 'door',
    model: d.model ?? null,
    is_online: Boolean(d.is_online),
    last_seen_at: d.last_seen_at ?? null,
    has_password: withSecret.has(d.id),
  }))
}
