import { redirect } from 'next/navigation'
import { ExpensesManager } from '@/components/dashboard/expenses-manager'
import { PageHeader } from '@/components/dashboard/page-header'
import { getProfile } from '@/lib/auth/get-profile'
import { loadExpenses } from '@/lib/data/expenses'

export default async function OwnerExpensesPage() {
  const profile = await getProfile()
  if (!profile?.hotel_id) redirect('/login')

  const expenses = await loadExpenses(profile.hotel_id)

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Finance"
        title="Property expenses"
        description="Log operating costs, vendor payments, and pending bills."
      />
      <ExpensesManager expenses={expenses} />
    </div>
  )
}
