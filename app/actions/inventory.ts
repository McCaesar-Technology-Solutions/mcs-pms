'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireVerifiedStaff } from '@/lib/auth/staff-session'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { normalizeInventoryCategory } from '@/lib/inventory/categories'
import {
  loadInventoryMovements,
  recordInventoryMovement,
} from '@/lib/inventory/movements'

export type InventoryActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

const itemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required.').max(120),
  category: z.string().min(1).max(60),
  quantityInStock: z.coerce.number().int().min(0),
  reorderLevel: z.coerce.number().int().min(0),
  unit: z.string().trim().min(1).max(30),
  notes: z.string().max(300).optional(),
})

function isMissingMovementsTable(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('inventory_movements') ||
    lower.includes('does not exist') ||
    lower.includes('schema cache') ||
    lower.includes('could not find the table')
  )
}

const receiveStockSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitCost: z.number().min(0).optional(),
  vendor: z.string().max(120).optional(),
  note: z.string().max(300).optional(),
  createExpense: z.boolean().optional(),
})

const issueStockSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  note: z.string().max(300).optional(),
})

const adjustStockSchema = z.object({
  itemId: z.string().uuid(),
  newQuantity: z.number().int().min(0),
  reason: z.enum(['adjusted', 'wasted']),
  note: z.string().max(300).optional(),
})

async function requireInventoryStaff(options?: { includeTechnician?: boolean }) {
  const roles = options?.includeTechnician
    ? (['owner', 'manager', 'technician'] as const)
    : (['owner', 'manager'] as const)
  const result = await requireVerifiedStaff({ roles: [...roles] })
  if (!result.ok) return null
  if (!result.profile.hotel_id) return null
  return result.profile
}

function revalidateInventory() {
  // Page-only revalidation avoids re-running the full staff layout during
  // server-action responses (a common source of "Server Components render" errors).
  revalidatePath('/owner/inventory', 'page')
  revalidatePath('/manager/inventory', 'page')
}

function scheduleInventoryRevalidation() {
  after(() => {
    try {
      revalidateInventory()
    } catch (err) {
      console.error('[inventory] revalidate failed:', err)
    }
  })
}

type InventoryAdminClient = NonNullable<ReturnType<typeof tryCreateAdminClient>>

type InventoryAdminResult =
  | { ok: true; admin: InventoryAdminClient }
  | { ok: false; error: string }

function requireInventoryAdmin(): InventoryAdminResult {
  const admin = tryCreateAdminClient()
  if (!admin) {
    return {
      ok: false,
      error:
        'Inventory saves are unavailable — server admin credentials are not configured. Set SUPABASE_SERVICE_ROLE_KEY in production.',
    }
  }
  return { ok: true, admin }
}

async function safeInventoryAction<T = void>(
  label: string,
  fn: () => Promise<InventoryActionResult<T>>,
): Promise<InventoryActionResult<T>> {
  try {
    return await fn()
  } catch (err) {
    console.error(`[inventory] ${label} failed:`, err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Inventory action failed.',
    }
  }
}

const updateItemSchema = itemSchema.partial()

export async function createInventoryItem(
  input: z.infer<typeof itemSchema>,
): Promise<InventoryActionResult> {
  return safeInventoryAction('createInventoryItem', async () => {
    const parsed = itemSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid item.' }
    }

    const profile = await requireInventoryStaff()
    if (!profile) return { success: false, error: 'Not authorized.' }

    const adminResult = requireInventoryAdmin()
    if (!adminResult.ok) return { success: false, error: adminResult.error }
    const admin = adminResult.admin
    const category = normalizeInventoryCategory(parsed.data.category)
    const openingQty = parsed.data.quantityInStock
    const { data: inserted, error } = await admin
      .from('inventory_items')
      .insert({
        hotel_id: profile.hotel_id!,
        name: parsed.data.name,
        category,
        quantity_in_stock: 0,
        reorder_level: parsed.data.reorderLevel,
        unit: parsed.data.unit,
        notes: parsed.data.notes?.trim() || null,
      })
      .select('id')
      .single()

    if (error || !inserted) {
      return { success: false, error: error?.message ?? 'Could not create item.' }
    }

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
        if (isMissingMovementsTable(movement.error)) {
          const { error: qtyError } = await admin
            .from('inventory_items')
            .update({
              quantity_in_stock: openingQty,
              updated_at: new Date().toISOString(),
            })
            .eq('id', inserted.id)
          if (qtyError) {
            await admin.from('inventory_items').delete().eq('id', inserted.id)
            return {
              success: false,
              error:
                'Inventory movement log is not set up yet. Apply migration 055_inventory_movements.sql, then try again.',
            }
          }
        } else {
          await admin.from('inventory_items').delete().eq('id', inserted.id)
          return { success: false, error: movement.error }
        }
      }
    }

    scheduleInventoryRevalidation()
    return { success: true }
  })
}

export async function updateInventoryItem(
  id: string,
  input: Partial<z.infer<typeof itemSchema>>,
): Promise<InventoryActionResult> {
  return safeInventoryAction('updateInventoryItem', async () => {
    const parsed = updateItemSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid item.' }
    }

    const profile = await requireInventoryStaff()
    if (!profile) return { success: false, error: 'Not authorized.' }

    const adminResult = requireInventoryAdmin()
    if (!adminResult.ok) return { success: false, error: adminResult.error }
    const admin = adminResult.admin
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

    const data = parsed.data
    if (data.name !== undefined) payload.name = data.name.trim()
    if (data.category !== undefined) payload.category = normalizeInventoryCategory(data.category)
    if (data.reorderLevel !== undefined) payload.reorder_level = data.reorderLevel
    if (data.unit !== undefined) payload.unit = data.unit.trim()
    if (data.notes !== undefined) payload.notes = data.notes?.trim() || null

    if (
      data.quantityInStock !== undefined &&
      data.quantityInStock !== existing.quantity_in_stock
    ) {
      const delta = data.quantityInStock - existing.quantity_in_stock
      const movement = await recordInventoryMovement(admin, {
        hotelId: profile.hotel_id!,
        itemId: id,
        delta,
        reason: 'adjusted',
        note: 'Manual stock adjustment',
        createdBy: profile.id,
      })
      if (!movement.ok) {
        if (isMissingMovementsTable(movement.error)) {
          payload.quantity_in_stock = data.quantityInStock
        } else {
          return { success: false, error: movement.error }
        }
      }
    }

    if (Object.keys(payload).length <= 1) {
      scheduleInventoryRevalidation()
      return { success: true }
    }

    const { error } = await admin
      .from('inventory_items')
      .update(payload)
      .eq('id', id)
      .eq('hotel_id', profile.hotel_id!)

    if (error) return { success: false, error: error.message }
    scheduleInventoryRevalidation()
    return { success: true }
  })
}

export async function receiveInventoryStock(
  input: z.infer<typeof receiveStockSchema>,
): Promise<InventoryActionResult> {
  return safeInventoryAction('receiveInventoryStock', async () => {
    const parsed = receiveStockSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid receipt.' }
    }

    const profile = await requireInventoryStaff()
    if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

    const adminResult = requireInventoryAdmin()
    if (!adminResult.ok) return { success: false, error: adminResult.error }
    const admin = adminResult.admin
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

    if (!movement.ok) {
      // Don't leave a purchase expense behind when the stock was never received.
      if (expenseId) {
        await admin.from('expenses').delete().eq('id', expenseId).eq('hotel_id', profile.hotel_id)
      }
      return { success: false, error: movement.error }
    }

    scheduleInventoryRevalidation()
    return { success: true }
  })
}

export async function issueInventoryStock(
  input: z.infer<typeof issueStockSchema>,
): Promise<InventoryActionResult> {
  return safeInventoryAction('issueInventoryStock', async () => {
    const parsed = issueStockSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid issue.' }
    }

    const profile = await requireInventoryStaff()
    if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

    const adminResult = requireInventoryAdmin()
    if (!adminResult.ok) return { success: false, error: adminResult.error }
    const admin = adminResult.admin
    const movement = await recordInventoryMovement(admin, {
      hotelId: profile.hotel_id,
      itemId: parsed.data.itemId,
      delta: -parsed.data.quantity,
      reason: 'used',
      note: parsed.data.note?.trim() || 'Stock issued',
      createdBy: profile.id,
    })

    if (!movement.ok) return { success: false, error: movement.error }

    scheduleInventoryRevalidation()
    return { success: true }
  })
}

export async function adjustInventoryStock(
  input: z.infer<typeof adjustStockSchema>,
): Promise<InventoryActionResult> {
  return safeInventoryAction('adjustInventoryStock', async () => {
    const parsed = adjustStockSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid adjustment.' }
    }

    const profile = await requireInventoryStaff()
    if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

    const adminResult = requireInventoryAdmin()
    if (!adminResult.ok) return { success: false, error: adminResult.error }
    const admin = adminResult.admin
    const { data: existing } = await admin
      .from('inventory_items')
      .select('quantity_in_stock')
      .eq('id', parsed.data.itemId)
      .eq('hotel_id', profile.hotel_id)
      .maybeSingle()

    if (!existing) return { success: false, error: 'Item not found.' }

    const delta = parsed.data.newQuantity - existing.quantity_in_stock
    if (delta === 0) {
      scheduleInventoryRevalidation()
      return { success: true }
    }

    const movement = await recordInventoryMovement(admin, {
      hotelId: profile.hotel_id,
      itemId: parsed.data.itemId,
      delta,
      reason: parsed.data.reason,
      note: parsed.data.note?.trim() || undefined,
      createdBy: profile.id,
    })

    if (!movement.ok) return { success: false, error: movement.error }

    scheduleInventoryRevalidation()
    return { success: true }
  })
}

export async function fetchInventoryMovements(itemId?: string) {
  return safeInventoryAction('fetchInventoryMovements', async () => {
    const profile = await requireInventoryStaff()
    if (!profile?.hotel_id) return { success: false as const, error: 'Not authorized.' }

    const adminResult = requireInventoryAdmin()
    if (!adminResult.ok) return { success: false, error: adminResult.error }
    const admin = adminResult.admin
    const movements = await loadInventoryMovements(admin, profile.hotel_id, {
      itemId,
      limit: itemId ? 30 : 25,
    })
    return { success: true as const, data: movements }
  })
}

export async function deleteInventoryItem(id: string): Promise<InventoryActionResult> {
  return safeInventoryAction('deleteInventoryItem', async () => {
    const profile = await requireInventoryStaff()
    if (!profile || profile.role !== 'owner') {
      return { success: false, error: 'Only owners can delete inventory items.' }
    }

    const adminResult = requireInventoryAdmin()
    if (!adminResult.ok) return { success: false, error: adminResult.error }
    const admin = adminResult.admin
    const { error } = await admin
      .from('inventory_items')
      .delete()
      .eq('id', id)
      .eq('hotel_id', profile.hotel_id!)

    if (error) return { success: false, error: error.message }
    scheduleInventoryRevalidation()
    return { success: true }
  })
}

export async function loadInventoryItemsForStaff(): Promise<
  InventoryActionResult<{ id: string; name: string; category: string; unit: string; quantityInStock: number }[]>
> {
  return safeInventoryAction('loadInventoryItemsForStaff', async () => {
    const profile = await requireInventoryStaff({ includeTechnician: true })
    if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

    const adminResult = requireInventoryAdmin()
    if (!adminResult.ok) return { success: false, error: adminResult.error }
    const admin = adminResult.admin
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
  })
}

