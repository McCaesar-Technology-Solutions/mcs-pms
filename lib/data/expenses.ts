import { createAdminClient } from '@/lib/supabase/admin'
import { resolveHotelTenantAccess } from '@/lib/data/tenant-guard'
import type { ExpenseRow } from '@/lib/expenses/summary'

export type { ExpenseRow }

export async function loadExpenses(hotelId: string): Promise<ExpenseRow[]> {
  const access = await resolveHotelTenantAccess(hotelId, { roles: ['owner'] })
  if (!access) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('expenses')
    .select('id, category, description, amount, expense_date, vendor, payment_status, created_at')
    .eq('hotel_id', hotelId)
    .order('expense_date', { ascending: false })
    .limit(100)

  return (data ?? []).map((row) => ({
    id: row.id,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    expenseDate: row.expense_date,
    vendor: row.vendor,
    paymentStatus: row.payment_status as 'pending' | 'paid',
    createdAt: row.created_at ?? new Date().toISOString(),
  }))
}
