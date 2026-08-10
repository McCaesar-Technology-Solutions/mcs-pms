import { describe, expect, it } from 'vitest'
import { guestDoorMatches, receptionMayUnlockZone, resolveGuestDoors } from '@/lib/access/doors'

const points = [
  {
    device_key: 'r9',
    door_no: 1,
    label: 'Room 9',
    zone: 'unit',
    room_id: 'room-9',
    grants_shared_access: false,
    is_active: true,
  },
  {
    device_key: 'r10',
    door_no: 1,
    label: 'Room 10',
    zone: 'unit',
    room_id: 'room-10',
    grants_shared_access: false,
    is_active: true,
  },
  {
    device_key: 'lobby',
    door_no: 1,
    label: 'Lobby',
    zone: 'lobby',
    room_id: null,
    grants_shared_access: true,
    is_active: true,
  },
  {
    device_key: 'gym',
    door_no: 1,
    label: 'Gymnasium',
    zone: 'gym',
    room_id: null,
    grants_shared_access: false,
    is_active: true,
  },
  {
    device_key: 'staff',
    door_no: 1,
    label: 'Staff only',
    zone: 'other',
    room_id: null,
    grants_shared_access: false,
    is_active: true,
  },
]

describe('guest door resolution', () => {
  it('gives room + shared + gym, not staff-only other', () => {
    const doors = resolveGuestDoors(points, 'room-9')
    const labels = doors.map((d) => d.label).sort()
    expect(labels).toEqual(['Gymnasium', 'Lobby', 'Room 9'])
  })

  it('does not over-grant non-unit zones without shared flag', () => {
    expect(guestDoorMatches(points[4]!, 'room-9')).toBe(false)
  })

  it('limits reception unlock zones', () => {
    expect(receptionMayUnlockZone('unit')).toBe(true)
    expect(receptionMayUnlockZone('gym')).toBe(true)
    expect(receptionMayUnlockZone('other')).toBe(false)
    expect(receptionMayUnlockZone('elevator')).toBe(false)
  })
})
