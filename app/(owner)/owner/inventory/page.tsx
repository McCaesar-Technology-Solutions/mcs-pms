import { redirect } from 'next/navigation'
import { InventoryManager } from '@/components/dashboard/inventory-manager'
import { PageHeader } from '@/components/dashboard/page-header'
import { getProfile } from '@/lib/auth/get-profile'
import { loadInventoryItems, loadRecentInventoryMovements } from '@/lib/data/inventory'

export default async function OwnerInventoryPage() {
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
        description="Track stock, receive supplies, and monitor reorder levels with a full movement history."
      />
      <InventoryManager
        items={items}
        movements={movements}
        staffRole="owner"
        canDelete
        canRecordExpense
      />
    </div>
  )
}
