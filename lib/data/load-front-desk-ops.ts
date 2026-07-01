import { getProfile } from '@/lib/auth/get-profile'
import { parseOpsDate } from '@/lib/dates/ops-date'
import { countUnreadGuestConversations } from '@/lib/data/guest-conversations'
import { countUnreadStaffConversations } from '@/lib/data/staff-conversations'
import {
  buildRoomBoardSignals,
  computeExtendedTodayOperations,
  type ExtendedTodayOperations,
  type RoomBoardSignal,
} from '@/lib/data/front-desk-ops'
import { getDashboardData } from '@/lib/data/dashboard'
import { loadHotelGuestRequests } from '@/lib/data/guest-portal'
import type { DbRoom, Reservation } from '@/types'

export interface FrontDeskOpsContext {
  opsDate: string
  ops: ExtendedTodayOperations
  signals: Map<string, RoomBoardSignal>
  dbRooms: DbRoom[]
  reservations: Reservation[]
}

export async function loadFrontDeskOpsContext(
  opsDateParam?: string | null,
): Promise<FrontDeskOpsContext | null> {
  const profile = await getProfile()
  if (!profile?.hotel_id) return null

  const opsDate = parseOpsDate(opsDateParam)
  const hotelId = profile.hotel_id

  const [{ dbRooms, reservations }, guestRequests, unreadGuestMessages, unreadTeamMessages] =
    await Promise.all([
      getDashboardData(),
      loadHotelGuestRequests(hotelId),
      countUnreadGuestConversations(hotelId),
      countUnreadStaffConversations(hotelId, profile.id),
    ])

  const pendingRequests = guestRequests.filter((r) => r.status === 'pending').length
  const unreadMessages = unreadGuestMessages + unreadTeamMessages
  const signals = buildRoomBoardSignals(dbRooms, reservations, opsDate)
  const ops = computeExtendedTodayOperations(
    dbRooms,
    reservations,
    pendingRequests,
    unreadMessages,
    opsDate,
  )

  return { opsDate, ops, signals, dbRooms, reservations }
}

/** Build context from data already loaded on a page (avoids duplicate fetches). */
export function buildFrontDeskOpsContext(
  dbRooms: DbRoom[],
  reservations: Reservation[],
  guestRequestsPending: number,
  unreadMessages: number,
  opsDateParam?: string | null,
): FrontDeskOpsContext {
  const opsDate = parseOpsDate(opsDateParam)
  const signals = buildRoomBoardSignals(dbRooms, reservations, opsDate)
  const ops = computeExtendedTodayOperations(
    dbRooms,
    reservations,
    guestRequestsPending,
    unreadMessages,
    opsDate,
  )
  return { opsDate, ops, signals, dbRooms, reservations }
}

export function serializeRoomSignals(
  signals: Map<string, RoomBoardSignal>,
): Record<string, RoomBoardSignal> {
  return Object.fromEntries(signals)
}
