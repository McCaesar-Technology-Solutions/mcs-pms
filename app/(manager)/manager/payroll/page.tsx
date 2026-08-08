import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { PageHeader } from '@/components/dashboard/page-header'
import { PayrollOverview } from '@/components/dashboard/payroll-overview'
import { getProfile } from '@/lib/auth/get-profile'
import { canAccessPayroll } from '@/lib/auth/tenant-access'
import { loadPayrollOverview } from '@/lib/data/payroll'

export default async function ManagerPayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ periodId?: string }>
}) {
  const profile = await getProfile()
  if (!profile?.hotel_id) redirect('/login')
  if (!canAccessPayroll(profile.role)) redirect('/manager/dashboard')

  const params = await searchParams
  const data = await loadPayrollOverview(profile.hotel_id, {
    periodId: params.periodId ?? null,
  })
  if (!data) redirect('/manager/dashboard')

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Finance"
        title="Payroll Overview"
        description="Prepare draft pay runs for your property. Owners approve and mark paid."
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading payroll…</p>}>
        <PayrollOverview data={data} role="manager" staffInviteHref="/manager/staff" />
      </Suspense>
    </div>
  )
}
