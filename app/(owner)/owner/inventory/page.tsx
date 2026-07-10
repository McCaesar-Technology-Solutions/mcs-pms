import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { InventoryManager } from '@/components/dashboard/inventory-manager'
import { PageHeader } from '@/components/dashboard/page-header'
import { getProfile } from '@/lib/auth/get-profile'
import { loadInventoryPageData } from '@/lib/data/inventory'

export const dynamic = 'force-dynamic'

function InventoryLoadingFallback() {
  return (
    <div className="surface-card p-8 text-center text-sm text-muted-foreground">
      Loading inventory…
    </div>
  )
}

export default async function OwnerInventoryPage() {
  let profile
  try {
    profile = await getProfile()
  } catch (err) {
    console.error('[owner/inventory] getProfile failed:', err)
    redirect('/login')
  }

  if (!profile?.hotel_id) redirect('/login')

  const { items, movements, movementsThisWeek } = await loadInventoryPageData(profile.hotel_id)

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Operations"
        title="Inventory"
        description="Track stock, receive supplies, and monitor reorder levels with a full movement history."
      />
      <Suspense fallback={<InventoryLoadingFallback />}>
        <InventoryManager
          items={items}
          movements={movements}
          movementsThisWeek={movementsThisWeek}
          staffRole="owner"
          canDelete
          canRecordExpense
        />
      </Suspense>
    </div>
  )
}
