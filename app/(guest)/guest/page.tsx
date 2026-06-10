import { GuestPortal } from '@/components/guest/guest-portal'
import { getGuestFromSession, validateGuestToken } from '@/app/actions/guest'

export default async function GuestPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams

  if (params.token) {
    const result = await validateGuestToken(params.token)
    if (!result.success) {
      if (result.error === 'expired') {
        return <GuestExpiredPage />
      }
      return <GuestExpiredPage message={result.error} />
    }
  }

  const session = await getGuestFromSession()
  if (!session.success || !session.data) {
    return <GuestExpiredPage message="Please use the link provided by the front desk." />
  }

  return (
    <GuestPortal guest={session.data.guest} roomNumber={session.data.roomNumber} />
  )
}

function GuestExpiredPage({ message }: { message?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#22124C] px-6 text-center text-white">
      <p className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold text-[#D4A62E]">
        MOJO APARTMENTS
      </p>
      <p className="mt-8 max-w-sm text-lg">
        {message ?? 'This link has expired. Please contact the front desk.'}
      </p>
    </div>
  )
}
