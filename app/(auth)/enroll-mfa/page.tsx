import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/get-profile'
import { safeMfaNext } from '@/lib/auth/mfa'
import { ROLE_HOME, isStaffRole } from '@/lib/auth/roles'

/** Legacy route — 2FA setup lives in Settings only. Never show an auth-page enrollment flow. */
export default async function EnrollMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const profile = await getProfile()
  if (!profile || !isStaffRole(profile.role)) {
    redirect('/login')
  }

  const { next } = await searchParams
  redirect(safeMfaNext(next, ROLE_HOME[profile.role]))
}
