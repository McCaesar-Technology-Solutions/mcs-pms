'use server'

import { revalidatePath } from 'next/cache'
import { requireVerifiedStaff, consumeStaffAuthError } from '@/lib/auth/staff-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { phoneSchema } from '@/lib/phone'
import { z } from 'zod'

const updateProfilePhoneSchema = z.object({
  phone: phoneSchema,
})

export type ProfileActionResult = { success: true } | { success: false; error: string }

export async function updateProfilePhone(phone: string): Promise<ProfileActionResult> {
  const parsed = updateProfilePhoneSchema.safeParse({ phone })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid phone number.' }
  }

  const result = await requireVerifiedStaff({
    roles: ['owner', 'manager', 'technician', 'receptionist'],
    skipMfa: true,
  })
  if (!result.ok) return { success: false, error: consumeStaffAuthError(result.error) }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ phone: parsed.data.phone.trim() })
    .eq('id', result.userId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}
