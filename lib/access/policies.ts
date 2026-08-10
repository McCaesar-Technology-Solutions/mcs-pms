import { createAdminClient } from '@/lib/supabase/admin'
import type { AccessPersonType, AccessPolicyRow, StaffPersonType } from '@/lib/access/types'

type Admin = ReturnType<typeof createAdminClient>

export const DEFAULT_STAFF_POLICIES: Array<{
  code: string
  name: string
  assignableByManager: boolean
}> = [
  {
    code: 'MANAGEMENT_ALL_AREAS',
    name: 'Management — all areas',
    assignableByManager: false,
  },
  {
    code: 'MANAGER_APPROVED_AREAS',
    name: 'Manager — approved areas',
    assignableByManager: false,
  },
  {
    code: 'HOUSEKEEPING_ACCESS',
    name: 'Housekeeping',
    assignableByManager: true,
  },
  {
    code: 'RECEPTION_STAFF_ACCESS',
    name: 'Reception staff',
    assignableByManager: true,
  },
  {
    code: 'SECURITY_ACCESS',
    name: 'Security',
    assignableByManager: true,
  },
  {
    code: 'MAINTENANCE_ACCESS',
    name: 'Maintenance',
    assignableByManager: true,
  },
]

/** Staff types Manager may create by default (not Owner / Technical Admin). */
export const MANAGER_CREATABLE_STAFF_TYPES: ReadonlySet<StaffPersonType> = new Set([
  'receptionist',
  'housekeeping',
  'security',
  'maintenance',
  'other_staff',
])

export function isStaffPersonType(t: AccessPersonType): t is StaffPersonType {
  return t !== 'tenant'
}

export async function ensureDefaultAccessPolicies(hotelId: string): Promise<void> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  for (const p of DEFAULT_STAFF_POLICIES) {
    const { data: existing } = await admin
      .from('access_policies')
      .select('id')
      .eq('hotel_id', hotelId)
      .eq('code', p.code)
      .maybeSingle()
    if (existing) continue
    await admin.from('access_policies').insert({
      hotel_id: hotelId,
      code: p.code,
      name: p.name,
      audience: 'staff',
      assignable_by_manager: p.assignableByManager,
      is_system: true,
      created_at: now,
      updated_at: now,
    })
  }
}

export async function listAccessPolicies(
  admin: Admin,
  hotelId: string,
  opts?: { audience?: 'staff' | 'guest'; forManager?: boolean },
): Promise<AccessPolicyRow[]> {
  let q = admin
    .from('access_policies')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('name', { ascending: true })

  if (opts?.audience) q = q.eq('audience', opts.audience)
  if (opts?.forManager) q = q.eq('assignable_by_manager', true)

  const { data } = await q
  return (data ?? []).map((row) => ({
    id: row.id,
    hotel_id: row.hotel_id,
    code: row.code,
    name: row.name,
    audience: row.audience as 'staff' | 'guest',
    assignable_by_manager: row.assignable_by_manager,
    is_system: row.is_system,
  }))
}

export async function resolvePolicyDoors(
  admin: Admin,
  hotelId: string,
  policyId: string,
) {
  const { data: links } = await admin
    .from('access_policy_points')
    .select('access_point_id')
    .eq('hotel_id', hotelId)
    .eq('policy_id', policyId)

  const ids = (links ?? []).map((l) => l.access_point_id)
  if (!ids.length) return []

  const { data: points } = await admin
    .from('access_points')
    .select('device_key, door_no, label, zone, room_id, grants_shared_access, is_active')
    .eq('hotel_id', hotelId)
    .eq('is_active', true)
    .in('id', ids)

  return (points ?? []).map((p) => ({
    deviceKey: p.device_key,
    doorNo: p.door_no,
    label: p.label,
    zone: p.zone,
  }))
}
