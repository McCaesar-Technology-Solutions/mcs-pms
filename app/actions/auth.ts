'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROLE_HOME, isStaffRole } from '@/lib/auth/roles'
import { acceptInviteSchema, signInSchema } from '@/lib/validations'
import type { UserRole } from '@/types'

export type AuthActionResult =
  | { success: true; role: UserRole; redirectTo: string }
  | { success: false; error: string }

export async function signIn(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse({ email, password })
  if (!parsed.success) {
    return { success: false, error: 'Invalid email or password.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error || !data.user) {
    return { success: false, error: 'Invalid credentials. Please try again.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile || profile.is_active === false) {
    await supabase.auth.signOut()
    return { success: false, error: 'This account has been disabled. Contact your administrator.' }
  }

  if (!isStaffRole(profile.role)) {
    await supabase.auth.signOut()
    return { success: false, error: 'Invalid credentials. Please try again.' }
  }

  const redirectTo = ROLE_HOME[profile.role]
  return { success: true, role: profile.role, redirectTo }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function acceptInvite(
  token: string,
  name: string,
  password: string,
): Promise<AuthActionResult> {
  const parsed = acceptInviteSchema.safeParse({ token, name, password })
  if (!parsed.success) {
    return { success: false, error: 'Please check your details and try again.' }
  }

  const admin = createAdminClient()

  const { data: invite, error: inviteError } = await admin
    .from('staff_invites')
    .select('*')
    .eq('token', parsed.data.token)
    .eq('accepted', false)
    .maybeSingle()

  if (inviteError || !invite) {
    return { success: false, error: 'This invite link is invalid or has already been used.' }
  }

  const { data: authUser, error: signUpError } = await admin.auth.admin.createUser({
    email: invite.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { name: parsed.data.name },
  })

  if (signUpError || !authUser.user) {
    return { success: false, error: signUpError?.message ?? 'Could not create account.' }
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: authUser.user.id,
    hotel_id: invite.hotel_id,
    role: invite.role,
    name: parsed.data.name,
    email: invite.email,
    invited_by: invite.invited_by,
    is_active: true,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    return { success: false, error: 'Could not complete registration.' }
  }

  await admin.from('staff_invites').update({ accepted: true }).eq('id', invite.id)

  const supabase = await createClient()
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password: parsed.data.password,
  })

  if (loginError) {
    return { success: false, error: 'Account created but sign-in failed. Please log in manually.' }
  }

  const role = invite.role as UserRole
  return { success: true, role, redirectTo: ROLE_HOME[role] }
}
