import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getProfile } from '@/lib/auth/get-profile'
import { canEnrollMfa, isMfaRequired, safeMfaNext } from '@/lib/auth/mfa'
import { ROLE_HOME } from '@/lib/auth/roles'
import { EnrollMfaClient } from '@/components/auth/enroll-mfa-client'

export default async function EnrollMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const profile = await getProfile()
  if (!profile || !canEnrollMfa(profile.role)) {
    redirect('/login')
  }

  const { next } = await searchParams
  const defaultHome = ROLE_HOME[profile.role]
  const nextPath = safeMfaNext(next, defaultHome)

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#22124C] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8 text-center">
          <p
            className="text-3xl font-semibold tracking-wide text-[#D4A62E]"
            style={{ fontFamily: 'var(--font-cormorant, "Cormorant Garamond", serif)' }}
          >
            MOJO APARTMENTS
          </p>
          <p className="mt-2 text-sm text-white/70">Secure your account</p>
        </div>
        <Suspense fallback={<p className="text-sm text-white/70">Loading…</p>}>
          <EnrollMfaClient nextPath={nextPath} required={isMfaRequired(profile.role)} />
        </Suspense>
      </div>
    </div>
  )
}
