import type { SupabaseClient } from '@supabase/supabase-js'

export interface CloseMetrics {
  roomsOccupied: number
  roomsAvailable: number
  arrivals: number
  departures: number
  revenuePosted: number
  nightAuditsCount: number
}

/** Snapshot metrics for a date range — same fields as night audit. */
export async function computeCloseMetrics(
  supabase: SupabaseClient,
  hotelId: string,
  periodStart: string,
  periodEnd: string,
): Promise<CloseMetrics> {
  const [{ data: rooms }, { data: reservations }, { data: invoices }, { count: nightAuditsCount }] =
    await Promise.all([
      supabase.from('rooms').select('status').eq('hotel_id', hotelId),
      supabase
        .from('reservations')
        .select('status, check_in, check_out')
        .eq('hotel_id', hotelId),
      supabase
        .from('invoices')
        .select('total_amount, payment_status, issued_at')
        .eq('hotel_id', hotelId)
        .gte('issued_at', `${periodStart}T00:00:00`)
        .lte('issued_at', `${periodEnd}T23:59:59.999`),
      supabase
        .from('night_audits')
        .select('*', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .gte('business_date', periodStart)
        .lte('business_date', periodEnd),
    ])

  const roomRows = rooms ?? []
  const occupied = roomRows.filter((r) => r.status === 'occupied').length
  const available = roomRows.filter((r) => r.status === 'available').length

  const resRows = reservations ?? []
  const arrivals = resRows.filter(
    (r) =>
      r.check_in >= periodStart &&
      r.check_in <= periodEnd &&
      (r.status === 'checked_in' || r.status === 'checked_out'),
  ).length
  const departures = resRows.filter(
    (r) =>
      r.check_out >= periodStart &&
      r.check_out <= periodEnd &&
      (r.status === 'checked_out' || r.status === 'checked_in'),
  ).length

  const revenuePosted = (invoices ?? [])
    .filter((i) => i.payment_status === 'paid')
    .reduce((sum, i) => sum + Number(i.total_amount ?? 0), 0)

  return {
    roomsOccupied: occupied,
    roomsAvailable: available,
    arrivals,
    departures,
    revenuePosted,
    nightAuditsCount: nightAuditsCount ?? 0,
  }
}
