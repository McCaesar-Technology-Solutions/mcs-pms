import { createAdminClient } from '@/lib/supabase/admin'

export interface GuestFeedbackRow {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  guestName: string
  roomNumber: string | null
}

export interface GuestFeedbackSummary {
  averageRating: number | null
  totalCount: number
  lowRatingCount: number
  rows: GuestFeedbackRow[]
}

export async function loadHotelGuestFeedback(
  hotelId: string,
  limit = 15,
): Promise<GuestFeedbackSummary> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('guest_feedback')
    .select('id, rating, comment, created_at, guests(name, rooms(number))')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    return { averageRating: null, totalCount: 0, lowRatingCount: 0, rows: [] }
  }

  const rows: GuestFeedbackRow[] = data.map((row) => {
    const guest = row.guests as { name?: string; rooms?: { number?: string } | null } | null
    const roomFromGuest = guest?.rooms?.number ?? null
    return {
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.created_at ?? new Date(0).toISOString(),
      guestName: guest?.name ?? 'Guest',
      roomNumber: roomFromGuest,
    }
  })

  const ratings = rows.map((r) => r.rating)
  const averageRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null

  const { count } = await admin
    .from('guest_feedback')
    .select('*', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)

  const { count: lowCount } = await admin
    .from('guest_feedback')
    .select('*', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)
    .lte('rating', 2)

  return {
    averageRating,
    totalCount: count ?? rows.length,
    lowRatingCount: lowCount ?? 0,
    rows,
  }
}
