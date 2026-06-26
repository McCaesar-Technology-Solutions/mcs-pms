import type { SupabaseClient } from '@supabase/supabase-js'
import { markOverdueInvoices } from '@/lib/billing/mark-overdue'

/** Run billing maintenance (overdue marking) before reads. */
export async function reconcileHotelBillingState(
  admin: SupabaseClient,
  hotelId: string,
): Promise<number> {
  return markOverdueInvoices(admin, hotelId)
}
