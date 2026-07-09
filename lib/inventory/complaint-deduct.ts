import { createAdminClient } from '@/lib/supabase/admin'
import {
  hasComplaintInventoryDeduction,
  recordInventoryUsageLines,
} from '@/lib/inventory/movements'

export async function deductInventoryForComplaint(
  complaintId: string,
  hotelId: string,
  actorId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient()

  if (await hasComplaintInventoryDeduction(admin, complaintId)) {
    return { ok: true }
  }

  const { data: estimate } = await admin
    .from('complaint_estimates')
    .select('id')
    .eq('complaint_id', complaintId)
    .maybeSingle()

  if (!estimate) return { ok: true }

  const { data: items } = await admin
    .from('complaint_estimate_items')
    .select('inventory_item_id, quantity, material_name')
    .eq('estimate_id', estimate.id)
    .not('inventory_item_id', 'is', null)

  const lines = (items ?? [])
    .filter((row) => row.inventory_item_id && row.quantity > 0)
    .map((row) => ({
      itemId: row.inventory_item_id as string,
      quantity: Number(row.quantity),
    }))

  if (lines.length === 0) return { ok: true }

  return recordInventoryUsageLines(admin, {
    hotelId,
    lines,
    reason: 'maintenance',
    createdBy: actorId,
    complaintId,
    note: 'Parts used on resolved complaint',
  })
}
