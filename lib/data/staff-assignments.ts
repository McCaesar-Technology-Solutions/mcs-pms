import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { ownerOwnsHotel } from '@/lib/data/properties'
import {
  decideManagerAssignment,
  decideManagerInviteCollision,
  decideManagerUnassignment,
} from '@/lib/staff-assignments/rules'
import type { HotelStaffAssignment, Profile } from '@/types'

function mapRow(row: {
  id: string
  profile_id: string
  hotel_id: string
  role: string
  assigned_by: string | null
  assigned_at: string
  is_active: boolean
}): HotelStaffAssignment {
  return {
    id: row.id,
    profile_id: row.profile_id,
    hotel_id: row.hotel_id,
    role: 'manager',
    assigned_by: row.assigned_by,
    assigned_at: row.assigned_at,
    is_active: row.is_active,
  }
}

export async function listAssignmentsForHotel(
  hotelId: string,
): Promise<HotelStaffAssignment[]> {
  const admin = tryCreateAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('hotel_staff_assignments')
    .select('id, profile_id, hotel_id, role, assigned_by, assigned_at, is_active')
    .eq('hotel_id', hotelId)
    .eq('is_active', true)
    .eq('role', 'manager')
  return (data ?? []).map(mapRow)
}

export async function listAssignmentsForProfile(
  profileId: string,
): Promise<HotelStaffAssignment[]> {
  const admin = tryCreateAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('hotel_staff_assignments')
    .select('id, profile_id, hotel_id, role, assigned_by, assigned_at, is_active')
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .eq('role', 'manager')
    .order('assigned_at', { ascending: true })
  return (data ?? []).map(mapRow)
}

export async function managerAssignedToHotel(
  profileId: string,
  hotelId: string,
): Promise<boolean> {
  const admin = tryCreateAdminClient()
  if (!admin) return false
  const { data } = await admin
    .from('hotel_staff_assignments')
    .select('id')
    .eq('profile_id', profileId)
    .eq('hotel_id', hotelId)
    .eq('is_active', true)
    .maybeSingle()
  return Boolean(data)
}

async function managerInOwnerPortfolio(
  ownerId: string,
  manager: { id: string; hotel_id: string | null },
): Promise<boolean> {
  if (manager.hotel_id && (await ownerOwnsHotel(ownerId, manager.hotel_id))) {
    return true
  }
  const assignments = await listAssignmentsForProfile(manager.id)
  for (const row of assignments) {
    if (await ownerOwnsHotel(ownerId, row.hotel_id)) return true
  }
  return false
}

export async function ownerCanAssignManager(
  ownerId: string,
  managerId: string,
  hotelId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const decision = await evaluateAssignManager(ownerId, managerId, hotelId)
  return decision.ok ? { ok: true } : decision
}

async function evaluateAssignManager(
  ownerId: string,
  managerId: string,
  hotelId: string,
) {
  const admin = tryCreateAdminClient()
  if (!admin) {
    return { ok: false as const, error: 'Could not update staff assignments.' }
  }

  const [{ data: manager }, { data: existing }, ownsTarget] = await Promise.all([
    admin
      .from('profiles')
      .select('id, role, is_active, hotel_id')
      .eq('id', managerId)
      .maybeSingle(),
    admin
      .from('hotel_staff_assignments')
      .select('hotel_id, is_active')
      .eq('profile_id', managerId)
      .eq('hotel_id', hotelId)
      .maybeSingle(),
    ownerOwnsHotel(ownerId, hotelId),
  ])

  const inPortfolio = manager
    ? await managerInOwnerPortfolio(ownerId, { id: manager.id, hotel_id: manager.hotel_id })
    : false

  return decideManagerAssignment({
    ownerOwnsTargetHotel: ownsTarget,
    manager: manager ? { role: manager.role, is_active: manager.is_active } : null,
    managerInOwnerPortfolio: inPortfolio,
    existing,
  })
}

/** Record the home-property assignment when a manager accepts an invite. */
export async function recordManagerAssignment(input: {
  profileId: string
  hotelId: string
  assignedBy: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = tryCreateAdminClient()
  if (!admin) return { ok: false, error: 'Could not complete registration.' }

  const { error } = await admin.from('hotel_staff_assignments').upsert(
    {
      profile_id: input.profileId,
      hotel_id: input.hotelId,
      role: 'manager',
      assigned_by: input.assignedBy,
      is_active: true,
    },
    { onConflict: 'profile_id,hotel_id' },
  )

  if (error) return { ok: false, error: 'Could not complete registration.' }
  return { ok: true }
}

export async function assignManagerToHotel(input: {
  ownerId: string
  managerId: string
  hotelId: string
}): Promise<{ ok: true; action: 'insert' | 'reactivate' | 'noop' } | { ok: false; error: string }> {
  const admin = tryCreateAdminClient()
  if (!admin) return { ok: false, error: 'Could not update staff assignments.' }

  const decision = await evaluateAssignManager(input.ownerId, input.managerId, input.hotelId)
  if (!decision.ok) return decision
  if (decision.action === 'noop') return decision

  if (decision.action === 'reactivate') {
    const { error } = await admin
      .from('hotel_staff_assignments')
      .update({ is_active: true, assigned_by: input.ownerId, assigned_at: new Date().toISOString() })
      .eq('profile_id', input.managerId)
      .eq('hotel_id', input.hotelId)
    if (error) return { ok: false, error: 'Could not update staff assignments.' }
    return decision
  }

  const { error } = await admin.from('hotel_staff_assignments').insert({
    profile_id: input.managerId,
    hotel_id: input.hotelId,
    role: 'manager',
    assigned_by: input.ownerId,
    is_active: true,
  })
  if (error) return { ok: false, error: 'Could not update staff assignments.' }
  return decision
}

export async function unassignManagerFromHotel(input: {
  ownerId: string
  managerId: string
  hotelId: string
}): Promise<{ ok: true; nextHotelId: string | null } | { ok: false; error: string }> {
  const admin = tryCreateAdminClient()
  if (!admin) return { ok: false, error: 'Could not update staff assignments.' }

  if (!(await ownerOwnsHotel(input.ownerId, input.hotelId))) {
    return { ok: false, error: 'You do not have access to that property.' }
  }

  const { data: manager } = await admin
    .from('profiles')
    .select('id, hotel_id, role')
    .eq('id', input.managerId)
    .maybeSingle()

  if (!manager || manager.role !== 'manager') {
    return { ok: false, error: 'That staff member was not found.' }
  }

  if (!(await managerInOwnerPortfolio(input.ownerId, manager))) {
    return { ok: false, error: 'You can only unassign managers who work at one of your properties.' }
  }

  const assignments = await listAssignmentsForProfile(input.managerId)
  const decision = decideManagerUnassignment({
    hotelId: input.hotelId,
    currentHotelId: manager.hotel_id,
    activeAssignments: assignments,
  })
  if (!decision.ok) return decision

  const wasAssigned = assignments.some((row) => row.hotel_id === input.hotelId)
  if (wasAssigned) {
    const { error } = await admin
      .from('hotel_staff_assignments')
      .update({ is_active: false })
      .eq('profile_id', input.managerId)
      .eq('hotel_id', input.hotelId)
    if (error) return { ok: false, error: 'Could not update staff assignments.' }
  }

  if (decision.nextHotelId && decision.nextHotelId !== manager.hotel_id) {
    const { error } = await admin
      .from('profiles')
      .update({ hotel_id: decision.nextHotelId })
      .eq('id', input.managerId)
    if (error) return { ok: false, error: 'Could not update staff assignments.' }
  }

  return decision
}

/** Managers assigned to this hotel, including those whose active hotel_id is elsewhere. */
export async function loadAssignedManagerProfiles(
  hotelId: string,
  opts?: { activeOnly?: boolean },
): Promise<Profile[]> {
  const admin = tryCreateAdminClient()
  if (!admin) return []
  const assignments = await listAssignmentsForHotel(hotelId)
  const ids = [...new Set(assignments.map((row) => row.profile_id))]
  if (!ids.length) return []

  let query = admin.from('profiles').select('*').in('id', ids).eq('role', 'manager')
  if (opts?.activeOnly) query = query.eq('is_active', true)

  const { data } = await query
  return (data ?? []) as Profile[]
}

export async function resolveManagerInviteCollision(input: {
  ownerId: string
  ownerRole: Profile['role']
  hotelId: string
  email: string
}): Promise<{ allowInvite: true } | { allowInvite: false; error: string }> {
  const admin = tryCreateAdminClient()
  if (!admin) return { allowInvite: true }

  const { data: existing } = await admin
    .from('profiles')
    .select('id, role, hotel_id, email')
    .eq('email', input.email)
    .maybeSingle()

  if (!existing || existing.role !== 'manager') {
    return decideManagerInviteCollision({
      alreadyOnThisHotel: Boolean(existing && existing.hotel_id === input.hotelId),
      managerInOwnerPortfolio: false,
      hasExistingManagerAccount: false,
    })
  }

  const assignedHere = await managerAssignedToHotel(existing.id, input.hotelId)
  const alreadyOnThisHotel = existing.hotel_id === input.hotelId || assignedHere
  const inPortfolio =
    input.ownerRole === 'owner'
      ? await managerInOwnerPortfolio(input.ownerId, {
          id: existing.id,
          hotel_id: existing.hotel_id,
        })
      : false

  return decideManagerInviteCollision({
    alreadyOnThisHotel,
    managerInOwnerPortfolio: inPortfolio,
    hasExistingManagerAccount: true,
  })
}
