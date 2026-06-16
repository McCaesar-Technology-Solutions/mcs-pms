import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/get-profile'
import { safeMfaNext } from '@/lib/auth/mfa'
import { ROLE_HOME, isStaffRole } from '@/lib/auth/roles'
import { MfaSmsForm } from '@/components/auth/mfa-sms-form'

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
  const nextPath = safeMfaNext(next, ROLE_HOME[profile.role])

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
          <p className="mt-2 text-sm text-white/70">Check your phone for a code</p>
        </div>
        <MfaSmsForm nextPath={nextPath} mode="verify" />
      </div>
    </div>
  )
}
