import type { AccessDoorTarget, AccessZone } from '@/lib/access/types'

/** Active door / reader row used for guest or policy resolution. */
export type AccessPointLike = {
  device_key: string
  door_no: number
  label: string
  zone: string
  room_id: string | null
  grants_shared_access: boolean
  is_active?: boolean
}

/**
 * Guest doors: booked unit + explicit shared doors + gym amenity.
 * Does NOT grant every non-unit zone (fixes lobby/gate/other over-grant).
 */
export function guestDoorMatches(point: AccessPointLike, roomId: string | null): boolean {
  if (point.is_active === false) return false
  if (roomId && point.room_id === roomId) return true
  if (point.grants_shared_access) return true
  if (point.zone === 'gym') return true
  return false
}

export function toDoorTarget(point: AccessPointLike): AccessDoorTarget {
  return {
    deviceKey: point.device_key,
    doorNo: point.door_no,
    label: point.label,
    zone: point.zone as AccessZone,
  }
}

export function resolveGuestDoors(
  points: AccessPointLike[],
  roomId: string | null,
): AccessDoorTarget[] {
  return points.filter((p) => guestDoorMatches(p, roomId)).map(toDoorTarget)
}

/** Zones Reception may remote-unlock (guest-facing). */
export const RECEPTION_UNLOCK_ZONES: ReadonlySet<string> = new Set([
  'unit',
  'lobby',
  'gate',
  'gym',
])

export function receptionMayUnlockZone(zone: string): boolean {
  return RECEPTION_UNLOCK_ZONES.has(zone)
}
