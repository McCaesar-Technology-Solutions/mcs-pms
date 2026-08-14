'use server'

import { revalidatePath } from 'next/cache'
import { requireVerifiedStaff } from '@/lib/auth/staff-session'
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
  })
  if (!result.ok) return { success: false, error: result.error ?? 'Not authorized.' }

  const existing = result.profile.phone?.trim()
  const next = parsed.data.phone.trim()

  if (existing && existing !== next) {
    return {
      success: false,
      error:
        'To change your phone number, verify the new number in two-factor authentication settings.',
    }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ phone: next }).eq('id', result.userId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}
