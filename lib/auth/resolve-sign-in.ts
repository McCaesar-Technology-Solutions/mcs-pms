import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { toE164 } from '@/lib/notifications/e164'
import { phoneSchema } from '@/lib/phone'
import { isStaffRole } from '@/lib/auth/roles'
import type { UserRole } from '@/types'

function normalizeEmail(value: string): string | null {
  const parsed = z.string().email().safeParse(value.trim())
  return parsed.success ? parsed.data.toLowerCase() : null
}

/** Map a staff email or phone (technicians) to the Supabase Auth email. */
export async function resolveSignInEmail(identifier: string): Promise<string | null> {
  const trimmed = identifier.trim()
  if (!trimmed) return null

  if (trimmed.includes('@')) {
    return normalizeEmail(trimmed)
  }

  const phoneParsed = phoneSchema.safeParse(trimmed)
  if (!phoneParsed.success) return null

  const target = toE164(phoneParsed.data.trim())
  if (!target) return null

  const admin = createAdminClient()
  const { data: profiles } = await admin
    .from('profiles')
    .select('email, phone, role, is_active')
    .not('phone', 'is', null)

  const matches = (profiles ?? []).filter((row) => {
    if (!row.phone || !row.email || row.is_active === false) return false
    if (!isStaffRole(row.role as UserRole)) return false
    return toE164(row.phone) === target
  })

  if (matches.length !== 1) return null
  return matches[0].email!.trim().toLowerCase()
}
