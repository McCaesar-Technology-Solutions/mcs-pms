import { createAdminClient } from '@/lib/supabase/admin'

/** Server-only helper — not a public server action. */
export async function guestNeedsRulesAcceptance(guestId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: guest } = await admin
    .from('guests')
    .select('hotel_id, guest_rules_accepted_version')
    .eq('id', guestId)
    .maybeSingle()

  if (!guest?.hotel_id) return false

  const { data: hotel } = await admin
    .from('hotels')
    .select('guest_rules_version')
    .eq('id', guest.hotel_id)
    .maybeSingle()

  const required = hotel?.guest_rules_version ?? 1
  return (guest.guest_rules_accepted_version ?? 0) < required
}
