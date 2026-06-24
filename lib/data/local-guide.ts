import { createAdminClient } from '@/lib/supabase/admin'

export interface LocalGuideRow {
  id: string
  title: string
  body: string
  sortOrder: number
}

export const DEFAULT_LOCAL_GUIDE: readonly { title: string; body: string }[] = [
  {
    title: 'Getting around',
    body: 'Ask the front desk for trusted taxi or ride-hailing recommendations. Share your room number when ordering delivery.',
  },
  {
    title: 'Food & essentials',
    body: 'Nearby shops and restaurants vary by location — reception can suggest options that deliver to the property.',
  },
  {
    title: 'Medical emergency',
    body: 'For serious emergencies call 112 (Ghana). Inform the front desk so we can assist.',
  },
  {
    title: 'Noise & neighbours',
    body: 'Quiet hours apply. Report persistent noise through the portal or call the manager line.',
  },
]

export async function ensureDefaultLocalGuide(hotelId: string): Promise<void> {
  const admin = createAdminClient()
  const { count } = await admin
    .from('hotel_local_guide')
    .select('*', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)

  if ((count ?? 0) > 0) return

  await admin.from('hotel_local_guide').insert(
    DEFAULT_LOCAL_GUIDE.map((item, index) => ({
      hotel_id: hotelId,
      title: item.title,
      body: item.body,
      sort_order: index,
    })),
  )
}

export async function getHotelLocalGuide(hotelId: string): Promise<LocalGuideRow[]> {
  await ensureDefaultLocalGuide(hotelId)
  const admin = createAdminClient()
  const { data } = await admin
    .from('hotel_local_guide')
    .select('id, title, body, sort_order')
    .eq('hotel_id', hotelId)
    .order('sort_order', { ascending: true })

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    sortOrder: row.sort_order,
  }))
}
