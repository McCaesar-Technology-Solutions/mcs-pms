import { redirect } from 'next/navigation'
import { InventoryManager } from '@/components/dashboard/inventory-manager'
import { PageHeader } from '@/components/dashboard/page-header'
import { getProfile } from '@/lib/auth/get-profile'
import { loadInventoryItems } from '@/lib/data/inventory'

export default async function ManagerInventoryPage() {
  const profile = await getProfile()
  if (!profile?.hotel_id) redirect('/login')

  const items = await loadInventoryItems(profile.hotel_id)

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Operations"
        title="Inventory"
        description="Update stock counts and monitor low-inventory alerts."
      />
      <InventoryManager items={items} />
    </div>
  )
}
