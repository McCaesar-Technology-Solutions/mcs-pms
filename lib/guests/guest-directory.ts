import type { ReservationChannel } from '@/types'

export type GuestStatus = 'active' | 'vip' | 'returning' | 'new'

export interface GuestRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  roomNumber: string | null
  roomId: string | null
  checkIn: string | null
  checkOut: string | null
  totalStays: number
  totalSpent: number
  lastStay: string | null
  status: GuestStatus
  source: ReservationChannel | null
  token: string | null
  tokenExpiresAt: string | null
  reservationId: string | null
  isInHouse: boolean
  doNotDisturb: boolean
}

/** In-house guests first; checked-out guests at the bottom of the directory. */
export function sortGuestDirectory(guests: GuestRow[]): GuestRow[] {
  return [...guests].sort((a, b) => {
    if (a.isInHouse !== b.isInHouse) {
      return a.isInHouse ? -1 : 1
    }

    if (a.isInHouse) {
      const aOut = a.checkOut ?? '9999-12-31'
      const bOut = b.checkOut ?? '9999-12-31'
      if (aOut !== bOut) return aOut.localeCompare(bOut)
    } else {
      const aLast = a.lastStay ?? ''
      const bLast = b.lastStay ?? ''
      if (aLast !== bLast) return bLast.localeCompare(aLast)
    }

    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}
