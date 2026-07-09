import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { InventoryManager } from '@/components/dashboard/inventory-manager'
import { PageHeader } from '@/components/dashboard/page-header'
import { getProfile } from '@/lib/auth/get-profile'
import { loadInventoryItems, loadRecentInventoryMovements } from '@/lib/data/inventory'

function InventoryLoadingFallback() {
  return (
    <div className="surface-card p-8 text-center text-sm text-muted-foreground">
      Loading inventory…
    </div>
  )
}

export default async function ManagerInventoryPage() {
  const profile = await getProfile()
  if (!profile?.hotel_id) redirect('/login')

  const [items, movements] = await Promise.all([
    loadInventoryItems(profile.hotel_id),
    loadRecentInventoryMovements(profile.hotel_id),
  ])

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Operations"
        title="Inventory"
        description="Update stock, receive deliveries, and monitor low-inventory alerts."
      />
      <Suspense fallback={<InventoryLoadingFallback />}>
        <InventoryManager items={items} movements={movements} staffRole="manager" />
      </Suspense>
    </div>
  )
}
