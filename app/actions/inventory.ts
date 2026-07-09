'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireVerifiedStaff, consumeStaffAuthError } from '@/lib/auth/staff-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeInventoryCategory } from '@/lib/inventory/categories'
import {
  loadInventoryMovements,
  recordInventoryMovement,
  type InventoryMovementReason,
} from '@/lib/inventory/movements'

export type InventoryActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

const itemSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(60),
  quantityInStock: z.number().int().min(0),
  reorderLevel: z.number().int().min(0),
  unit: z.string().min(1).max(30),
  notes: z.string().max(300).optional(),
})

const receiveStockSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitCost: z.number().min(0).optional(),
  vendor: z.string().max(120).optional(),
  note: z.string().max(300).optional(),
  createExpense: z.boolean().optional(),
})

async function requireInventoryStaff(options?: { includeTechnician?: boolean }) {
  const roles = options?.includeTechnician
    ? (['owner', 'manager', 'receptionist', 'technician'] as const)
    : (['owner', 'manager', 'receptionist'] as const)
  const result = await requireVerifiedStaff({ roles: [...roles] })
  if (!result.ok) return null
  if (!result.profile.hotel_id) return null
  return result.profile
}

function revalidateInventory() {
  revalidatePath('/owner/inventory')
  revalidatePath('/manager/inventory')
  revalidatePath('/receptionist/inventory')
  revalidatePath('/owner/dashboard')
  revalidatePath('/manager/dashboard')
  revalidatePath('/receptionist/dashboard')
  revalidatePath('/owner/expenses')
}

export async function createInventoryItem(
  input: z.infer<typeof itemSchema>,
): Promise<InventoryActionResult> {
  const parsed = itemSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid item.' }
  }

  const profile = await requireInventoryStaff()
  if (!profile) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const category = normalizeInventoryCategory(parsed.data.category)
  const openingQty = parsed.data.quantityInStock
  const { data: inserted, error } = await admin
    .from('inventory_items')
    .insert({
      hotel_id: profile.hotel_id!,
      name: parsed.data.name.trim(),
      category,
      quantity_in_stock: 0,
      reorder_level: parsed.data.reorderLevel,
      unit: parsed.data.unit.trim(),
      notes: parsed.data.notes?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !inserted) return { success: false, error: error?.message ?? 'Could not create item.' }

  if (openingQty > 0) {
    const movement = await recordInventoryMovement(admin, {
      hotelId: profile.hotel_id!,
      itemId: inserted.id,
      delta: openingQty,
      reason: 'received',
      note: 'Opening stock',
      createdBy: profile.id,
    })
    if (!movement.ok) {
      await admin.from('inventory_items').delete().eq('id', inserted.id)
      return { success: false, error: movement.error }
    }
  }

  revalidateInventory()
  return { success: true }
}

export async function updateInventoryItem(
  id: string,
  input: Partial<z.infer<typeof itemSchema>>,
): Promise<InventoryActionResult> {
  const profile = await requireInventoryStaff()
  if (!profile) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('inventory_items')
    .select('quantity_in_stock')
    .eq('id', id)
    .eq('hotel_id', profile.hotel_id!)
    .maybeSingle()

  if (!existing) return { success: false, error: 'Item not found.' }

  const payload: {
    name?: string
    category?: string
    quantity_in_stock?: number
    reorder_level?: number
    unit?: string
    notes?: string | null
    updated_at: string
  } = { updated_at: new Date().toISOString() }

  if (input.name !== undefined) payload.name = input.name.trim()
  if (input.category !== undefined) payload.category = normalizeInventoryCategory(input.category)
  if (input.reorderLevel !== undefined) payload.reorder_level = input.reorderLevel
  if (input.unit !== undefined) payload.unit = input.unit.trim()
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null

  if (input.quantityInStock !== undefined && input.quantityInStock !== existing.quantity_in_stock) {
    const delta = input.quantityInStock - existing.quantity_in_stock
    const movement = await recordInventoryMovement(admin, {
      hotelId: profile.hotel_id!,
      itemId: id,
      delta,
      reason: 'adjusted',
      note: 'Manual stock adjustment',
      createdBy: profile.id,
    })
    if (!movement.ok) return { success: false, error: movement.error }
  }

  if (Object.keys(payload).length <= 1) {
    revalidateInventory()
    return { success: true }
  }

  const { error } = await admin
    .from('inventory_items')
    .update(payload)
    .eq('id', id)
    .eq('hotel_id', profile.hotel_id!)

  if (error) return { success: false, error: error.message }
  revalidateInventory()
  return { success: true }
}

export async function receiveInventoryStock(
  input: z.infer<typeof receiveStockSchema>,
): Promise<InventoryActionResult> {
  const parsed = receiveStockSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid receipt.' }
  }

  const profile = await requireInventoryStaff()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data: item } = await admin
    .from('inventory_items')
    .select('id, name')
    .eq('id', parsed.data.itemId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!item) return { success: false, error: 'Item not found.' }

  let expenseId: string | undefined
  if (parsed.data.createExpense) {
    if (profile.role !== 'owner') {
      return { success: false, error: 'Only owners can record purchase expenses.' }
    }
    if (parsed.data.unitCost == null) {
      return { success: false, error: 'Enter a unit cost to create an expense.' }
    }

    const amount = parsed.data.unitCost * parsed.data.quantity
    const { data: expense, error: expenseError } = await admin
      .from('expenses')
      .insert({
        hotel_id: profile.hotel_id,
        category: 'supplies',
        description: `Inventory: ${item.name} × ${parsed.data.quantity}`,
        amount,
        expense_date: new Date().toISOString().slice(0, 10),
        vendor: parsed.data.vendor?.trim() || null,
        payment_status: 'paid',
        created_by: profile.id,
        inventory_item_id: item.id,
        quantity_received: parsed.data.quantity,
      })
      .select('id')
      .single()

    if (expenseError || !expense) {
      return { success: false, error: expenseError?.message ?? 'Could not record expense.' }
    }
    expenseId = expense.id
  }

  const movement = await recordInventoryMovement(admin, {
    hotelId: profile.hotel_id,
    itemId: parsed.data.itemId,
    delta: parsed.data.quantity,
    reason: 'received',
    note: parsed.data.note?.trim() || (expenseId ? 'Stock received — expense recorded' : 'Stock received'),
    createdBy: profile.id,
    expenseId: expenseId ?? null,
  })

  if (!movement.ok) return { success: false, error: movement.error }

  revalidateInventory()
  return { success: true }
}

export async function fetchInventoryMovements(itemId?: string) {
  const profile = await requireInventoryStaff()
  if (!profile?.hotel_id) return { success: false as const, error: 'Not authorized.' }

  const admin = createAdminClient()
  const movements = await loadInventoryMovements(admin, profile.hotel_id, {
    itemId,
    limit: itemId ? 30 : 25,
  })
  return { success: true as const, data: movements }
}

export async function deleteInventoryItem(id: string): Promise<InventoryActionResult> {
  const profile = await requireInventoryStaff()
  if (!profile || profile.role !== 'owner') {
    return { success: false, error: 'Only owners can delete inventory items.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('inventory_items')
    .delete()
    .eq('id', id)
    .eq('hotel_id', profile.hotel_id!)

  if (error) return { success: false, error: error.message }
  revalidateInventory()
  return { success: true }
}

export async function loadInventoryItemsForStaff(): Promise<
  InventoryActionResult<{ id: string; name: string; category: string; unit: string; quantityInStock: number }[]>
> {
  const profile = await requireInventoryStaff({ includeTechnician: true })
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data } = await admin
    .from('inventory_items')
    .select('id, name, category, unit, quantity_in_stock')
    .eq('hotel_id', profile.hotel_id)
    .order('name')

  return {
    success: true,
    data: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      unit: row.unit,
      quantityInStock: row.quantity_in_stock,
    })),
  }
}

export type { InventoryMovementReason }
