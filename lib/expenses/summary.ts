/** Client-safe expense helpers — keep server loaders out of this module. */

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

export function expenseSummary(expenses: ExpenseRow[]) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0)
  const pending = expenses
    .filter((e) => e.paymentStatus === 'pending')
    .reduce((s, e) => s + e.amount, 0)
  const paid = total - pending
  return { total, pending, paid, count: expenses.length }
}
