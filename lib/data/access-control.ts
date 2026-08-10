import { createAdminClient } from '@/lib/supabase/admin'
import { resolveHotelTenantAccess } from '@/lib/data/tenant-guard'
import { isAgentOnline } from '@/lib/access/agent-auth'
import { ensureDefaultAccessPolicies } from '@/lib/access/policies'
import type {
  AccessCredentialRow,
  AccessDeviceRow,
  AccessDeviceRole,
  AccessIntegrationSummary,
  AccessPersonType,
  AccessPointRow,
  AccessPolicyRow,
  AccessJobRow,
  AccessStaffStatus,
  AttendanceRecordRow,
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
    const rooms = (row as unknown as { rooms?: { number: string } | { number: string }[] | null })
      .rooms
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

function mapCredentialRow(row: Record<string, unknown>): AccessCredentialRow {
  const guest = row.guests as
    | { name: string; rooms: { number: string } | { number: string }[] | null }
    | null
    | undefined
  const rooms = guest?.rooms
  const roomNumber = Array.isArray(rooms) ? rooms[0]?.number : rooms?.number
  const policy = row.access_policies as { name?: string; code?: string } | null | undefined

  return {
    id: row.id as string,
    hotel_id: row.hotel_id as string,
    guest_id: (row.guest_id as string | null) ?? null,
    reservation_id: (row.reservation_id as string | null) ?? null,
    person_type: ((row.person_type as string) || 'tenant') as AccessPersonType,
    profile_id: (row.profile_id as string | null) ?? null,
    staff_status: (row.staff_status as AccessStaffStatus | null) ?? null,
    access_policy_id: (row.access_policy_id as string | null) ?? null,
    employee_no: row.employee_no as string,
    display_name: row.display_name as string,
    card_no: (row.card_no as string | null) ?? null,
    has_pin: Boolean(row.has_pin),
    has_face: Boolean(row.has_face),
    has_fingerprint: Boolean(row.has_fingerprint),
    valid_from: row.valid_from as string,
    valid_to: row.valid_to as string,
    status: row.status as AccessCredentialRow['status'],
    sync_status: row.sync_status as AccessCredentialRow['sync_status'],
    last_error: (row.last_error as string | null) ?? null,
    last_synced_at: (row.last_synced_at as string | null) ?? null,
    guest_name: guest?.name ?? null,
    room_number: roomNumber ?? null,
    policy_name: policy?.name ?? null,
    policy_code: policy?.code ?? null,
  }
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
  let query = admin
    .from('access_credentials')
    .select('*, guests(name, rooms(number)), access_policies(name, code)')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Reception: tenant guests only (defense in depth; RLS also enforces).
  if (profile.role === 'receptionist') {
    query = query.eq('person_type', 'tenant')
  }

  const { data } = await query
  return (data ?? []).map((row) => mapCredentialRow(row as unknown as Record<string, unknown>))
}

export async function getStaffAccessCredentials(
  hotelId: string,
  limit = 100,
): Promise<AccessCredentialRow[]> {
  const profile = await resolveHotelTenantAccess(hotelId, {
    roles: ['owner', 'manager'],
  })
  if (!profile) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('access_credentials')
    .select('*, access_policies(name, code)')
    .eq('hotel_id', hotelId)
    .neq('person_type', 'tenant')
    .order('display_name', { ascending: true })
    .limit(limit)

  return (data ?? []).map((row) => mapCredentialRow(row as unknown as Record<string, unknown>))
}

export async function getAccessPoliciesForHotel(hotelId: string): Promise<AccessPolicyRow[]> {
  const profile = await resolveHotelTenantAccess(hotelId, {
    roles: ['owner', 'manager'],
  })
  if (!profile) return []

  await ensureDefaultAccessPolicies(hotelId)

  const admin = createAdminClient()
  let q = admin
    .from('access_policies')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('audience', 'staff')
    .order('name', { ascending: true })

  if (profile.role === 'manager') {
    q = q.eq('assignable_by_manager', true)
  }

  const { data: policies } = await q
  if (!policies?.length) return []

  const { data: links } = await admin
    .from('access_policy_points')
    .select('policy_id, access_point_id')
    .eq('hotel_id', hotelId)
    .in(
      'policy_id',
      policies.map((p) => p.id),
    )

  const byPolicy = new Map<string, string[]>()
  for (const link of links ?? []) {
    const list = byPolicy.get(link.policy_id) ?? []
    list.push(link.access_point_id)
    byPolicy.set(link.policy_id, list)
  }

  return policies.map((row) => ({
    id: row.id,
    hotel_id: row.hotel_id,
    code: row.code,
    name: row.name,
    audience: row.audience as 'staff' | 'guest',
    assignable_by_manager: row.assignable_by_manager,
    is_system: row.is_system,
    point_ids: byPolicy.get(row.id) ?? [],
  }))
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

  return devices.map((d) => {
    const role = (d as { device_role?: string }).device_role
    const device_role: AccessDeviceRole =
      role === 'enrollment' ? 'enrollment' : role === 'attendance' ? 'attendance' : 'door'
    return {
      id: d.id,
      hotel_id: d.hotel_id,
      device_key: d.device_key,
      label: d.label,
      host: d.host ?? null,
      port: d.port ?? null,
      username: d.username ?? null,
      use_https: Boolean(d.use_https),
      managed_in_cloud: Boolean(d.managed_in_cloud),
      device_role,
      model: d.model ?? null,
      is_online: Boolean(d.is_online),
      last_seen_at: d.last_seen_at ?? null,
      has_password: withSecret.has(d.id),
    }
  })
}

export async function getAttendanceRecords(
  hotelId: string,
  limit = 100,
): Promise<AttendanceRecordRow[]> {
  const profile = await resolveHotelTenantAccess(hotelId, {
    roles: ['owner', 'manager'],
  })
  if (!profile) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('attendance_records')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map((row) => ({
    id: row.id,
    hotel_id: row.hotel_id,
    credential_id: row.credential_id,
    profile_id: row.profile_id,
    employee_no: row.employee_no,
    display_name: row.display_name,
    event_type: row.event_type as AttendanceRecordRow['event_type'],
    occurred_at: row.occurred_at,
    device_key: row.device_key,
    raw_ref: row.raw_ref,
  }))
}
