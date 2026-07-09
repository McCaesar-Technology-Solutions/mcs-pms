import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export type InventoryMovementReason =
  | 'received'
  | 'used'
  | 'adjusted'
  | 'wasted'
  | 'restock'
  | 'clean'
  | 'maintenance'

export interface InventoryMovementLine {
  itemId: string
  quantity: number
}

export interface RecordMovementInput {
  hotelId: string
  itemId: string
  delta: number
  reason: InventoryMovementReason
  note?: string | null
  createdBy?: string | null
  housekeepingTaskId?: string | null
  complaintId?: string | null
  expenseId?: string | null
}

export interface InventoryMovementRow {
  id: string
  itemId: string
  itemName: string
  delta: number
  quantityAfter: number
  reason: InventoryMovementReason
  note: string | null
  createdByName: string | null
  createdAt: string
  housekeepingTaskId: string | null
  complaintId: string | null
}

export async function recordInventoryMovement(
  admin: AdminClient,
  input: RecordMovementInput,
): Promise<{ ok: true; quantityAfter: number } | { ok: false; error: string }> {
  if (input.delta === 0) {
    return { ok: false, error: 'Quantity change cannot be zero.' }
  }

  const { data: item, error: fetchError } = await admin
    .from('inventory_items')
    .select('id, quantity_in_stock')
    .eq('id', input.itemId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (fetchError || !item) {
    return { ok: false, error: 'Inventory item not found.' }
  }

  const nextQty = item.quantity_in_stock + input.delta
  if (nextQty < 0) {
    return { ok: false, error: 'Not enough stock for this movement.' }
  }

  const { error: updateError } = await admin
    .from('inventory_items')
    .update({
      quantity_in_stock: nextQty,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.itemId)
    .eq('hotel_id', input.hotelId)

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  const { error: insertError } = await admin.from('inventory_movements').insert({
    hotel_id: input.hotelId,
    item_id: input.itemId,
    delta: input.delta,
    quantity_after: nextQty,
    reason: input.reason,
    note: input.note?.trim() || null,
    created_by: input.createdBy ?? null,
    housekeeping_task_id: input.housekeepingTaskId ?? null,
    complaint_id: input.complaintId ?? null,
    expense_id: input.expenseId ?? null,
  })

  if (insertError) {
    await admin
      .from('inventory_items')
      .update({ quantity_in_stock: item.quantity_in_stock })
      .eq('id', input.itemId)
    return { ok: false, error: insertError.message }
  }

  return { ok: true, quantityAfter: nextQty }
}

export async function validateInventoryUsageLines(
  admin: AdminClient,
  hotelId: string,
  lines: InventoryMovementLine[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const line of lines) {
    if (line.quantity <= 0) continue
    const { data: item } = await admin
      .from('inventory_items')
      .select('name, quantity_in_stock')
      .eq('id', line.itemId)
      .eq('hotel_id', hotelId)
      .maybeSingle()
    if (!item) {
      return { ok: false, error: 'An inventory item in this list was not found.' }
    }
    if (item.quantity_in_stock < line.quantity) {
      return {
        ok: false,
        error: `Not enough ${item.name} in stock (${item.quantity_in_stock} available).`,
      }
    }
  }
  return { ok: true }
}

export async function recordInventoryUsageLines(
  admin: AdminClient,
  input: {
    hotelId: string
    lines: InventoryMovementLine[]
    reason: Extract<InventoryMovementReason, 'used' | 'restock' | 'clean' | 'maintenance'>
    createdBy?: string | null
    housekeepingTaskId?: string | null
    complaintId?: string | null
    note?: string | null
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const line of input.lines) {
    if (line.quantity <= 0) continue
    const result = await recordInventoryMovement(admin, {
      hotelId: input.hotelId,
      itemId: line.itemId,
      delta: -line.quantity,
      reason: input.reason,
      note: input.note,
      createdBy: input.createdBy,
      housekeepingTaskId: input.housekeepingTaskId,
      complaintId: input.complaintId,
    })
    if (!result.ok) return result
  }
  return { ok: true }
}

export async function loadInventoryMovements(
  admin: AdminClient,
  hotelId: string,
  options?: { itemId?: string; limit?: number },
): Promise<InventoryMovementRow[]> {
  let query = admin
    .from('inventory_movements')
    .select(
      'id, item_id, delta, quantity_after, reason, note, created_at, housekeeping_task_id, complaint_id, inventory_items(name)',
    )
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 50)

  if (options?.itemId) {
    query = query.eq('item_id', options.itemId)
  }

  const { data } = await query

  return (data ?? []).map((row) => {
    const item = row.inventory_items as { name?: string } | null
    return {
      id: row.id,
      itemId: row.item_id,
      itemName: item?.name ?? 'Item',
      delta: row.delta,
      quantityAfter: row.quantity_after,
      reason: row.reason as InventoryMovementReason,
      note: row.note,
      createdByName: null,
      createdAt: row.created_at,
      housekeepingTaskId: row.housekeeping_task_id,
      complaintId: row.complaint_id,
    }
  })
}

export async function hasComplaintInventoryDeduction(
  admin: AdminClient,
  complaintId: string,
): Promise<boolean> {
  const { count } = await admin
    .from('inventory_movements')
    .select('id', { count: 'exact', head: true })
    .eq('complaint_id', complaintId)
    .lt('delta', 0)

  return (count ?? 0) > 0
}
