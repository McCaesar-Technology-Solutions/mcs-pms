import type { createAdminClient } from '@/lib/supabase/admin'
import type { RateType } from '@/lib/pricing/stay-totals'

type AdminClient = ReturnType<typeof createAdminClient>

export interface RoomRates {
  nightlyRate: number
  monthlyRate: number
}

export async function getRoomRates(admin: AdminClient, roomId: string): Promise<RoomRates> {
  const { data } = await admin
    .from('rooms')
    .select('nightly_rate, monthly_rate, room_categories(default_nightly_rate, default_monthly_rate)')
    .eq('id', roomId)
    .maybeSingle()

  const cat = data?.room_categories as {
    default_nightly_rate?: number
    default_monthly_rate?: number | null
  } | null

  return {
    nightlyRate:
      data?.nightly_rate != null
        ? Number(data.nightly_rate)
        : Number(cat?.default_nightly_rate ?? 0),
    monthlyRate:
      data?.monthly_rate != null
        ? Number(data.monthly_rate)
        : Number(cat?.default_monthly_rate ?? 0),
  }
}

export function effectiveRatesForBooking(
  rateType: RateType,
  nightlyRate: number,
  monthlyRate: number,
  roomRates: RoomRates,
): { nightlyRate: number; monthlyRate: number } {
  return {
    nightlyRate: rateType === 'nightly' ? nightlyRate : roomRates.nightlyRate,
    monthlyRate: rateType === 'monthly' ? monthlyRate : roomRates.monthlyRate,
  }
}
