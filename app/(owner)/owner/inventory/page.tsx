import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { InventoryManager } from '@/components/dashboard/inventory-manager'
import { PageHeader } from '@/components/dashboard/page-header'
import { getProfile } from '@/lib/auth/get-profile'
import { loadInventoryItems, loadRecentInventoryMovements, countInventoryMovementsThisWeek } from '@/lib/data/inventory'

function InventoryLoadingFallback() {
  return (
    <div className="surface-card p-8 text-center text-sm text-muted-foreground">
      Loading inventory…
    </div>
  )
}

export default async function OwnerInventoryPage() {
  const profile = await getProfile()
  if (!profile?.hotel_id) redirect('/login')

  const [items, movements, movementsThisWeek] = await Promise.all([
    loadInventoryItems(profile.hotel_id),
    loadRecentInventoryMovements(profile.hotel_id),
    countInventoryMovementsThisWeek(profile.hotel_id),
  ])

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
