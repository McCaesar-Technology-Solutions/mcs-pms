import { createAdminClient } from '@/lib/supabase/admin'

export interface GuestRuleRow {
  id: string
  ruleText: string
  sortOrder: number
}

export interface HotelGuestRulesBundle {
  hotelId: string
  hotelName: string
  version: number
  rules: GuestRuleRow[]
}

/** Default rules seeded for new and existing properties. */
export const DEFAULT_GUEST_RULES: readonly string[] = [
  'Quiet hours are from 10:00 PM to 7:00 AM. Please keep noise to a minimum in corridors and rooms.',
  'Smoking, vaping, and open flames (including candles) are prohibited inside rooms and indoor areas.',
  'Visitors must register at the front desk. Overnight guests require prior approval from management.',
  'Do not tamper with fire alarms, sprinklers, electrical panels, or other safety equipment.',
  'Report maintenance issues promptly through the guest portal or front desk.',
  'Standard check-out time is 11:00 AM unless a late check-out has been approved in writing.',
  'The property is not responsible for loss or damage to valuables left unattended in your room.',
  'Disruptive behaviour, illegal activity, or damage to property may result in eviction without refund.',
]

export async function ensureDefaultGuestRules(hotelId: string): Promise<void> {
  const admin = createAdminClient()
  const { count } = await admin
    .from('hotel_guest_rules')
    .select('*', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)

  if ((count ?? 0) > 0) return

  const rows = DEFAULT_GUEST_RULES.map((rule_text, index) => ({
    hotel_id: hotelId,
    rule_text,
    sort_order: index,
  }))

  await admin.from('hotel_guest_rules').insert(rows)
}

export async function getHotelGuestRules(hotelId: string): Promise<HotelGuestRulesBundle | null> {
  const admin = createAdminClient()
  await ensureDefaultGuestRules(hotelId)

  const [{ data: hotel }, { data: rules }] = await Promise.all([
    admin.from('hotels').select('id, name, guest_rules_version').eq('id', hotelId).maybeSingle(),
    admin
      .from('hotel_guest_rules')
      .select('id, rule_text, sort_order')
      .eq('hotel_id', hotelId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  if (!hotel) return null

  return {
    hotelId: hotel.id,
    hotelName: hotel.name,
    version: hotel.guest_rules_version ?? 1,
    rules: (rules ?? []).map((row) => ({
      id: row.id,
      ruleText: row.rule_text,
      sortOrder: row.sort_order,
    })),
  }
}

export async function getGuestRulesBySlug(slug: string): Promise<HotelGuestRulesBundle | null> {
  const admin = createAdminClient()
  const { data: hotel } = await admin
    .from('hotels')
    .select('id')
    .eq('guest_portal_slug', slug)
    .maybeSingle()

  if (!hotel) return null
  return getHotelGuestRules(hotel.id)
}

export async function bumpGuestRulesVersion(hotelId: string): Promise<number> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('hotels')
    .select('guest_rules_version')
    .eq('id', hotelId)
    .maybeSingle()

  const next = (data?.guest_rules_version ?? 1) + 1
  await admin.from('hotels').update({ guest_rules_version: next }).eq('id', hotelId)
  return next
}
