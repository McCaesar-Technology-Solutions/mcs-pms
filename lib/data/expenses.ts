import { createAdminClient } from '@/lib/supabase/admin'

export interface ExpenseRow {
  id: string
  category: string
  description: string
  amount: number
  expenseDate: string
  vendor: string | null
  paymentStatus: 'pending' | 'paid'
  createdAt: string
}

export async function loadExpenses(hotelId: string): Promise<ExpenseRow[]> {
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

export function expenseSummary(expenses: ExpenseRow[]) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0)
  const pending = expenses.filter((e) => e.paymentStatus === 'pending').reduce((s, e) => s + e.amount, 0)
  const paid = total - pending
  return { total, pending, paid, count: expenses.length }
}
