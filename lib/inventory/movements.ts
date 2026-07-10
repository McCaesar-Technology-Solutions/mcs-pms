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

const MAX_MOVEMENT_ATTEMPTS = 3

export async function recordInventoryMovement(
  admin: AdminClient,
  input: RecordMovementInput,
): Promise<{ ok: true; quantityAfter: number } | { ok: false; error: string }> {
  if (input.delta === 0) {
    return { ok: false, error: 'Quantity change cannot be zero.' }
  }

  for (let attempt = 0; attempt < MAX_MOVEMENT_ATTEMPTS; attempt++) {
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

    // Compare-and-swap: only apply the write if stock hasn't changed since we
    // read it, so concurrent movements can't silently overwrite each other.
    const { data: updated, error: updateError } = await admin
      .from('inventory_items')
      .update({
        quantity_in_stock: nextQty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.itemId)
      .eq('hotel_id', input.hotelId)
      .eq('quantity_in_stock', item.quantity_in_stock)
      .select('id')

    if (updateError) {
      return { ok: false, error: updateError.message }
    }
    if (!updated || updated.length === 0) {
      // Another movement landed between our read and write — retry with fresh data.
      continue
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
      // Roll back the stock change, but only if nothing else has moved it since.
      await admin
        .from('inventory_items')
        .update({ quantity_in_stock: item.quantity_in_stock })
        .eq('id', input.itemId)
        .eq('hotel_id', input.hotelId)
        .eq('quantity_in_stock', nextQty)
      return { ok: false, error: insertError.message }
    }

    return { ok: true, quantityAfter: nextQty }
  }

  return { ok: false, error: 'Stock changed while saving. Please try again.' }
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
  options?: { itemId?: string; limit?: number; itemNames?: Map<string, string> },
): Promise<InventoryMovementRow[]> {
  let query = admin
    .from('inventory_movements')
    .select(
      'id, item_id, delta, quantity_after, reason, note, created_at, created_by, housekeeping_task_id, complaint_id',
    )
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 50)

  if (options?.itemId) {
    query = query.eq('item_id', options.itemId)
  }

  const { data, error } = await query

  if (error) {
    if (isMissingMovementsTable(error.message)) return []
    console.error('[inventory] loadInventoryMovements failed:', error.message)
    return []
  }

  let nameById = options?.itemNames
  if (!nameById) {
    const { data: items } = await admin
      .from('inventory_items')
      .select('id, name')
      .eq('hotel_id', hotelId)
    nameById = new Map((items ?? []).map((item) => [item.id, item.name]))
  }

  const actorIds = [
    ...new Set((data ?? []).map((row) => row.created_by).filter((id): id is string => !!id)),
  ]
  const actorNameById = new Map<string, string>()
  if (actorIds.length > 0) {
    const { data: actors } = await admin
      .from('profiles')
      .select('id, name')
      .in('id', actorIds)
    for (const actor of actors ?? []) {
      if (actor.name) actorNameById.set(actor.id, actor.name)
    }
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemName: nameById!.get(row.item_id) ?? 'Item',
    delta: row.delta ?? 0,
    quantityAfter: row.quantity_after ?? 0,
    reason: (row.reason ?? 'adjusted') as InventoryMovementReason,
    note: row.note ?? null,
    createdByName: row.created_by ? (actorNameById.get(row.created_by) ?? null) : null,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    housekeepingTaskId: row.housekeeping_task_id ?? null,
    complaintId: row.complaint_id ?? null,
  }))
}

function isMissingMovementsTable(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('inventory_movements') ||
    lower.includes('does not exist') ||
    lower.includes('schema cache') ||
    lower.includes('could not find the table')
  )
}

export async function countInventoryMovementsSince(
  admin: AdminClient,
  hotelId: string,
  since: Date,
): Promise<number> {
  const { count, error } = await admin
    .from('inventory_movements')
    .select('id', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)
    .gte('created_at', since.toISOString())

  if (error) {
    if (isMissingMovementsTable(error.message)) return 0
    console.error('[inventory] countInventoryMovementsSince failed:', error.message)
    return 0
  }

  return count ?? 0
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
