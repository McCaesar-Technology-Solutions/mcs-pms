import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { AuthMfaShell } from '@/components/auth/auth-mfa-shell'
import { MfaVerifyForm } from '@/components/auth/mfa-verify-form'
import { getProfile } from '@/lib/auth/get-profile'
import { ROLE_HOME, isStaffRole } from '@/lib/auth/roles'
import { safeMfaNext } from '@/lib/auth/mfa'

function VerifyMfaContent({ nextPath }: { nextPath: string }) {
  return <MfaVerifyForm nextPath={nextPath} />
}

export default async function VerifyMfaPage({
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
      title="Sign-in verification"
      description="Enter the one-time code we send to your phone or email to continue."
    >
      <Suspense fallback={<p className="text-sm text-white/70">Loading…</p>}>
        <VerifyMfaContent nextPath={destination} />
      </Suspense>
    </AuthMfaShell>
  )
}
