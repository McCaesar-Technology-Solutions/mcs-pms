import { describe, expect, it } from 'vitest'
import {
  ASSIGN_MANAGER_INSTEAD_ERROR,
  decideManagerAssignment,
  decideManagerHotelSwitch,
  decideManagerInviteCollision,
  decideManagerUnassignment,
  mergeStaffForHotel,
} from '@/lib/staff-assignments/rules'

const HOTEL_A = 'hotel-a'
const HOTEL_B = 'hotel-b'

const manager = { role: 'manager' as const, is_active: true }

describe('decideManagerAssignment', () => {
  it('rejects assigning to another owner’s hotel', () => {
    const result = decideManagerAssignment({
      ownerOwnsTargetHotel: false,
      manager,
      managerInOwnerPortfolio: true,
      existing: null,
    })
    expect(result).toEqual({
      ok: false,
      error: 'You do not have access to that property.',
    })
  })

  it('rejects a manager who is not already in the owner’s portfolio', () => {
    expect(
      decideManagerAssignment({
        ownerOwnsTargetHotel: true,
        manager,
        managerInOwnerPortfolio: false,
        existing: null,
      }),
    ).toEqual({
      ok: false,
      error: 'You can only assign managers who already work at one of your properties.',
    })
  })

  it('treats a duplicate active assignment as a no-op', () => {
    expect(
      decideManagerAssignment({
        ownerOwnsTargetHotel: true,
        manager,
        managerInOwnerPortfolio: true,
        existing: { hotel_id: HOTEL_B, is_active: true },
      }),
    ).toEqual({ ok: true, action: 'noop' })
  })

  it('reactivates a previously unassigned property', () => {
    expect(
      decideManagerAssignment({
        ownerOwnsTargetHotel: true,
        manager,
        managerInOwnerPortfolio: true,
        existing: { hotel_id: HOTEL_B, is_active: false },
      }),
    ).toEqual({ ok: true, action: 'reactivate' })
  })

  it('inserts when the manager is new to that property', () => {
    expect(
      decideManagerAssignment({
        ownerOwnsTargetHotel: true,
        manager,
        managerInOwnerPortfolio: true,
        existing: null,
      }),
    ).toEqual({ ok: true, action: 'insert' })
  })
})

describe('decideManagerUnassignment', () => {
  it('refuses to drop the last assignment without a replacement', () => {
    expect(
      decideManagerUnassignment({
        hotelId: HOTEL_A,
        currentHotelId: HOTEL_A,
        activeAssignments: [{ hotel_id: HOTEL_A }],
      }),
    ).toEqual({
      ok: false,
      error: 'Assign them to another property first, or deactivate the account.',
    })
  })

  it('moves the active hotel when unassigning the property they are working', () => {
    expect(
      decideManagerUnassignment({
        hotelId: HOTEL_A,
        currentHotelId: HOTEL_A,
        activeAssignments: [{ hotel_id: HOTEL_A }, { hotel_id: HOTEL_B }],
      }),
    ).toEqual({ ok: true, nextHotelId: HOTEL_B })
  })

  it('keeps the active hotel when unassigning a different property', () => {
    expect(
      decideManagerUnassignment({
        hotelId: HOTEL_B,
        currentHotelId: HOTEL_A,
        activeAssignments: [{ hotel_id: HOTEL_A }, { hotel_id: HOTEL_B }],
      }),
    ).toEqual({ ok: true, nextHotelId: HOTEL_A })
  })
})

describe('decideManagerInviteCollision', () => {
  it('asks the owner to assign instead of inviting a portfolio manager again', () => {
    expect(
      decideManagerInviteCollision({
        alreadyOnThisHotel: false,
        managerInOwnerPortfolio: true,
        hasExistingManagerAccount: true,
      }),
    ).toEqual({ allowInvite: false, error: ASSIGN_MANAGER_INSTEAD_ERROR })
  })

  it('blocks a second invite when they are already on this hotel', () => {
    expect(
      decideManagerInviteCollision({
        alreadyOnThisHotel: true,
        managerInOwnerPortfolio: true,
        hasExistingManagerAccount: true,
      }).allowInvite,
    ).toBe(false)
  })

  it('blocks inviting a manager who belongs to another owner', () => {
    expect(
      decideManagerInviteCollision({
        alreadyOnThisHotel: false,
        managerInOwnerPortfolio: false,
        hasExistingManagerAccount: true,
      }),
    ).toEqual({
      allowInvite: false,
      error: 'That email already belongs to a manager account.',
    })
  })
})

describe('decideManagerHotelSwitch', () => {
  it('allows switching to an assigned hotel only', () => {
    expect(
      decideManagerHotelSwitch({
        targetHotelId: HOTEL_B,
        assignedHotelIds: [HOTEL_A, HOTEL_B],
      }),
    ).toEqual({ ok: true })
    expect(
      decideManagerHotelSwitch({
        targetHotelId: HOTEL_B,
        assignedHotelIds: [HOTEL_A],
      }),
    ).toEqual({ ok: false, error: 'You are not assigned to that property.' })
  })
})

describe('mergeStaffForHotel', () => {
  it('includes assigned managers whose active hotel is elsewhere', () => {
    const merged = mergeStaffForHotel(
      [{ id: 'owner-1' }, { id: 'mgr-home' }],
      [{ id: 'mgr-assigned' }, { id: 'mgr-home' }],
    )
    expect(merged.map((row) => row.id).sort()).toEqual(['mgr-assigned', 'mgr-home', 'owner-1'])
  })
})
