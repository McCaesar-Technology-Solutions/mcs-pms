import type { createAdminClient } from '@/lib/supabase/admin'
import type { RateType } from '@/lib/pricing/stay-totals'

type AdminClient = ReturnType<typeof createAdminClient>

export interface RoomRates {
  nightlyRate: number
  weeklyRate: number
  monthlyRate: number
}

export type RoomRateSource = {
  nightly_rate?: number | null
  weekly_rate?: number | null
  monthly_rate?: number | null
}

export type CategoryRateSource = {
  default_nightly_rate?: number | null
  default_weekly_rate?: number | null
  default_monthly_rate?: number | null
} | null

/**
 * Room override, else category default, else 0 — same numbers booking / walk-in use.
 */
export function resolveRoomRates(
  room: RoomRateSource | null | undefined,
  category: CategoryRateSource = null,
): RoomRates {
  return {
    nightlyRate:
      room?.nightly_rate != null
        ? Number(room.nightly_rate)
        : Number(category?.default_nightly_rate ?? 0),
    weeklyRate:
      room?.weekly_rate != null
        ? Number(room.weekly_rate)
        : Number(category?.default_weekly_rate ?? 0),
    monthlyRate:
      room?.monthly_rate != null
        ? Number(room.monthly_rate)
        : Number(category?.default_monthly_rate ?? 0),
  }
}

export async function getRoomRates(admin: AdminClient, roomId: string): Promise<RoomRates> {
  const { data } = await admin
    .from('rooms')
    .select(
      'nightly_rate, weekly_rate, monthly_rate, room_categories(default_nightly_rate, default_weekly_rate, default_monthly_rate)',
    )
    .eq('id', roomId)
    .maybeSingle()

  const cat = data?.room_categories as CategoryRateSource

  return resolveRoomRates(data, cat)
}

export function effectiveRatesForBooking(
  rateType: RateType,
  nightlyRate: number,
  weeklyRate: number,
  monthlyRate: number,
  roomRates: RoomRates,
): RoomRates {
  return {
    nightlyRate: rateType === 'nightly' ? nightlyRate : roomRates.nightlyRate,
    weeklyRate: rateType === 'weekly' ? weeklyRate : roomRates.weeklyRate,
    monthlyRate: rateType === 'monthly' ? monthlyRate : roomRates.monthlyRate,
  }
}
