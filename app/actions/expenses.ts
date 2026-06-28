'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type ExpenseActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

const expenseSchema = z.object({
  category: z.string().min(1).max(60),
  description: z.string().min(1).max(200),
  amount: z.number().min(0),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendor: z.string().max(120).optional(),
  paymentStatus: z.enum(['pending', 'paid']),
})

async function requireOwner() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, hotel_id, name')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'owner' || !profile.hotel_id) return null
  return profile
}

function revalidateExpenses() {
  revalidatePath('/owner/expenses')
  revalidatePath('/owner/dashboard')
}

export async function createExpense(input: z.infer<typeof expenseSchema>): Promise<ExpenseActionResult> {
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid expense.' }
  }

  const profile = await requireOwner()
  if (!profile) return { success: false, error: 'Only owners can record expenses.' }

  const admin = createAdminClient()
  const { error } = await admin.from('expenses').insert({
    hotel_id: profile.hotel_id!,
    category: parsed.data.category.trim(),
    description: parsed.data.description.trim(),
    amount: parsed.data.amount,
    expense_date: parsed.data.expenseDate,
    vendor: parsed.data.vendor?.trim() || null,
    payment_status: parsed.data.paymentStatus,
    created_by: profile.id,
  })

  if (error) return { success: false, error: error.message }
  revalidateExpenses()
  return { success: true }
}

export async function deleteExpense(id: string): Promise<ExpenseActionResult> {
  const profile = await requireOwner()
  if (!profile) return { success: false, error: 'Only owners can delete expenses.' }

  const admin = createAdminClient()
  const { error } = await admin.from('expenses').delete().eq('id', id).eq('hotel_id', profile.hotel_id!)
  if (error) return { success: false, error: error.message }
  revalidateExpenses()
  return { success: true }
}
