import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { AuthMfaShell } from '@/components/auth/auth-mfa-shell'
import { MfaEnrollForm } from '@/components/auth/mfa-enroll-form'
import { getProfile } from '@/lib/auth/get-profile'
import { ROLE_HOME, isStaffRole } from '@/lib/auth/roles'
import { safeMfaNext } from '@/lib/auth/mfa'

function EnrollMfaContent({ nextPath }: { nextPath: string }) {
  return <MfaEnrollForm nextPath={nextPath} />
}

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
  const destination = safeMfaNext(next, ROLE_HOME[profile.role])

  return (
    <AuthMfaShell
      title="Finish verification setup"
      description="Two-factor sign-in is enabled on your account. Add your contact details and confirm with a one-time code."
    >
      <Suspense fallback={<p className="text-sm text-white/70">Loading…</p>}>
        <EnrollMfaContent nextPath={destination} />
      </Suspense>
    </AuthMfaShell>
  )
}
