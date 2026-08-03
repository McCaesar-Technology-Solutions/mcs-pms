import { createAdminClient } from '@/lib/supabase/admin'
import { resolveHotelTenantAccess } from '@/lib/data/tenant-guard'
import { isAgentOnline } from '@/lib/access/agent-auth'
import type {
  AccessCredentialRow,
  AccessIntegrationSummary,
  AccessPointRow,
  AccessJobRow,
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

export async function getAccessDevices(hotelId: string) {
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

  return data ?? []
}
