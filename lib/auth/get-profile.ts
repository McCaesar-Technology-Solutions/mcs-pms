import { createClient } from '@/lib/supabase/server'
import { loadVerifiedStaffProfile } from '@/lib/auth/staff-session'
import type { Profile } from '@/types'

export async function getSessionUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data) return null

  return data as Profile
}

/** Staff profile with MFA verified — use in server actions. */
export async function getVerifiedProfile(): Promise<Profile | null> {
  return loadVerifiedStaffProfile()
}
