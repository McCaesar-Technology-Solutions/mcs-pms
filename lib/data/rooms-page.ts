import { getProfile } from '@/lib/auth/get-profile'
import { parseOpsDate } from '@/lib/dates/ops-date'
import { countUnreadGuestConversations } from '@/lib/data/guest-conversations'
import { getDashboardData } from '@/lib/data/dashboard'
import { buildFrontDeskOpsContext, serializeRoomSignals } from '@/lib/data/load-front-desk-ops'
import { loadHotelGuestRequests } from '@/lib/data/guest-portal'
import { getRoomCategories } from '@/lib/data/room-categories'
import type { ExtendedTodayOperations, StaffRoutePrefix } from '@/lib/data/front-desk-ops'
import type { RoomBoardSignal } from '@/lib/data/front-desk-ops'
import type { DbRoom, RoomCategory } from '@/types'

export interface RoomsPageData {
  dbRooms: DbRoom[]
  categories: RoomCategory[]
  opsDate: string
  ops: ExtendedTodayOperations
  roomSignals: Record<string, RoomBoardSignal>
  initialView: 'grid' | 'floor' | null
  filter: 'dirty' | 'maintenance' | 'all'
  routePrefix: StaffRoutePrefix
  initialSearch: string
}

export async function loadRoomsPageData(
  routePrefix: StaffRoutePrefix,
  searchParams: {
    q?: string
    view?: string
    filter?: string
    opsDate?: string
  },
): Promise<RoomsPageData> {
  const [{ dbRooms, reservations }, categories] = await Promise.all([
    getDashboardData(),
    getRoomCategories(),
  ])

  const profile = await getProfile()
  let pendingRequests = 0
  let unreadMessages = 0

  if (profile?.hotel_id) {
    const [guestRequests, unread] = await Promise.all([
      loadHotelGuestRequests(profile.hotel_id),
      countUnreadGuestConversations(profile.hotel_id),
    ])
    pendingRequests = guestRequests.filter((r) => r.status === 'pending').length
    unreadMessages = unread
  }

  const opsDate = parseOpsDate(searchParams.opsDate)
  const ctx = buildFrontDeskOpsContext(
    dbRooms,
    reservations,
    pendingRequests,
    unreadMessages,
    opsDate,
  )

  const initialView: RoomsPageData['initialView'] =
    searchParams.view === 'floor' ? 'floor' : searchParams.view === 'grid' ? 'grid' : null
  const filterParam = searchParams.filter
  const filter: RoomsPageData['filter'] =
    filterParam === 'dirty' || filterParam === 'maintenance' ? filterParam : 'all'

  return {
    dbRooms,
    categories,
    opsDate: ctx.opsDate,
    ops: ctx.ops,
    roomSignals: serializeRoomSignals(ctx.signals),
    initialView,
    filter,
    routePrefix,
    initialSearch: searchParams.q ?? '',
  }
}
