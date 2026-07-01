'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireVerifiedStaff, consumeStaffAuthError } from '@/lib/auth/staff-session'
import { createAdminClient } from '@/lib/supabase/admin'

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

async function requireInventoryStaff() {
  const result = await requireVerifiedStaff({ roles: ['owner', 'manager', 'receptionist'] })
  if (!result.ok) return null
  if (!result.profile.hotel_id) return null
  return result.profile
}

function revalidateInventory() {
  revalidatePath('/owner/inventory')
  revalidatePath('/manager/inventory')
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
  const { error } = await admin.from('inventory_items').insert({
    hotel_id: profile.hotel_id!,
    name: parsed.data.name.trim(),
    category: parsed.data.category.trim(),
    quantity_in_stock: parsed.data.quantityInStock,
    reorder_level: parsed.data.reorderLevel,
    unit: parsed.data.unit.trim(),
    notes: parsed.data.notes?.trim() || null,
  })

  if (error) return { success: false, error: error.message }
  revalidateInventory()
  return { success: true }
}

export async function updateInventoryItem(
  id: string,
  input: Partial<z.infer<typeof itemSchema>>,
): Promise<InventoryActionResult> {
  const profile = await requireInventoryStaff()
  if (!profile) return { success: false, error: 'Not authorized.' }

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
  if (input.category !== undefined) payload.category = input.category.trim()
  if (input.quantityInStock !== undefined) payload.quantity_in_stock = input.quantityInStock
  if (input.reorderLevel !== undefined) payload.reorder_level = input.reorderLevel
  if (input.unit !== undefined) payload.unit = input.unit.trim()
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null

  const admin = createAdminClient()
  const { error } = await admin
    .from('inventory_items')
    .update(payload)
    .eq('id', id)
    .eq('hotel_id', profile.hotel_id!)

  if (error) return { success: false, error: error.message }
  revalidateInventory()
  return { success: true }
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
