export type StaffAssignmentRow = {
  hotel_id: string
  is_active: boolean
}

export type AssignManagerDecision =
  | { ok: true; action: 'insert' | 'reactivate' | 'noop' }
  | { ok: false; error: string }

export type UnassignManagerDecision =
  | { ok: true; nextHotelId: string | null }
  | { ok: false; error: string }

const LAST_ASSIGNMENT_ERROR =
  'Assign them to another property first, or deactivate the account.'

export function decideManagerAssignment(input: {
  ownerOwnsTargetHotel: boolean
  manager: { role: string; is_active: boolean | null } | null
  managerInOwnerPortfolio: boolean
  existing: StaffAssignmentRow | null
}): AssignManagerDecision {
  if (!input.ownerOwnsTargetHotel) {
    return { ok: false, error: 'You do not have access to that property.' }
  }
  if (!input.manager) {
    return { ok: false, error: 'That staff member was not found.' }
  }
  if (input.manager.role !== 'manager') {
    return { ok: false, error: 'Only managers can be assigned to other properties.' }
  }
  if (input.manager.is_active === false) {
    return { ok: false, error: 'Reactivate this manager before assigning them to a property.' }
  }
  if (!input.managerInOwnerPortfolio) {
    return { ok: false, error: 'You can only assign managers who already work at one of your properties.' }
  }
  if (input.existing?.is_active) {
    return { ok: true, action: 'noop' }
  }
  if (input.existing && !input.existing.is_active) {
    return { ok: true, action: 'reactivate' }
  }
  return { ok: true, action: 'insert' }
}

export function decideManagerUnassignment(input: {
  hotelId: string
  currentHotelId: string | null
  activeAssignments: Pick<StaffAssignmentRow, 'hotel_id'>[]
}): UnassignManagerDecision {
  const others = input.activeAssignments.filter((row) => row.hotel_id !== input.hotelId)
  const isAssigned = others.length < input.activeAssignments.length
  if (!isAssigned) {
    return { ok: true, nextHotelId: input.currentHotelId }
  }
  if (others.length === 0) {
    return { ok: false, error: LAST_ASSIGNMENT_ERROR }
  }
  if (input.currentHotelId !== input.hotelId) {
    return { ok: true, nextHotelId: input.currentHotelId }
  }
  return { ok: true, nextHotelId: others[0]!.hotel_id }
}

export function decideManagerHotelSwitch(input: {
  targetHotelId: string
  assignedHotelIds: string[]
}): { ok: true } | { ok: false; error: string } {
  if (!input.assignedHotelIds.includes(input.targetHotelId)) {
    return { ok: false, error: 'You are not assigned to that property.' }
  }
  return { ok: true }
}

export const ASSIGN_MANAGER_INSTEAD_ERROR =
  'That manager already works at one of your properties. Assign them to this property instead of sending a new invite.'

export function decideManagerInviteCollision(input: {
  alreadyOnThisHotel: boolean
  managerInOwnerPortfolio: boolean
  hasExistingManagerAccount: boolean
}): { allowInvite: true } | { allowInvite: false; error: string } {
  if (input.alreadyOnThisHotel) {
    return { allowInvite: false, error: 'Someone with that email is already on your team.' }
  }
  if (input.managerInOwnerPortfolio) {
    return { allowInvite: false, error: ASSIGN_MANAGER_INSTEAD_ERROR }
  }
  if (input.hasExistingManagerAccount) {
    return { allowInvite: false, error: 'That email already belongs to a manager account.' }
  }
  return { allowInvite: true }
}

export function mergeStaffForHotel<T extends { id: string }>(onHotel: T[], assignedManagers: T[]): T[] {
  const byId = new Map<string, T>()
  for (const row of onHotel) byId.set(row.id, row)
  for (const row of assignedManagers) {
    if (!byId.has(row.id)) byId.set(row.id, row)
  }
  return [...byId.values()]
}
