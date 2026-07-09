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
    .filter((row) => row.inventory_item_id && Number(row.quantity) > 0)
    .map((row) => ({
      itemId: row.inventory_item_id as string,
      // Estimates allow fractional quantities (e.g. 0.5 tin), but stock is
      // tracked in whole units — deduct the whole unit taken from stores.
      quantity: Math.ceil(Number(row.quantity)),
    }))

  if (lines.length === 0) return { ok: true }

  const result = await recordInventoryUsageLines(admin, {
    hotelId,
    lines,
    reason: 'maintenance',
    createdBy: actorId,
    complaintId,
    note: 'Parts used on resolved complaint',
  })

  // If the movement log isn't provisioned yet, don't block complaint resolution.
  if (!result.ok && isMissingMovementsInfra(result.error)) {
    console.warn('[inventory] skipping complaint deduction — movements table missing')
    return { ok: true }
  }

  return result
}

function isMissingMovementsInfra(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('inventory_movements') ||
    lower.includes('does not exist') ||
    lower.includes('schema cache') ||
    lower.includes('could not find the table')
  )
}
