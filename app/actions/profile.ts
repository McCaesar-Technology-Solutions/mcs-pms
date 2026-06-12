'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not signed in.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['owner', 'manager', 'technician'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ phone: parsed.data.phone.trim() })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}
