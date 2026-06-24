import { redirect } from 'next/navigation'
import { GuestPortal } from '@/components/guest/guest-portal'
import { GuestRulesGate } from '@/components/guest/guest-rules-gate'
import { getGuestFromSession } from '@/app/actions/guest'
import { guestNeedsRulesAcceptance } from '@/app/actions/guest-rules'
import { getGuestPropertyContacts } from '@/lib/data/contacts'
import { getHotelGuestRules } from '@/lib/data/guest-rules'

export default async function GuestPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const params = await searchParams

  // Legacy links (?token=) — hand off to the route handler that can set the session cookie.
  if (params.token) {
    redirect(`/guest/enter?token=${encodeURIComponent(params.token)}`)
  }

  const session = await getGuestFromSession()
  if (!session.success || !session.data) {
    return <GuestExpiredPage message={messageForError(params.error)} />
  }

  const needsRules = await guestNeedsRulesAcceptance(session.data.guest.id)
  if (needsRules) {
    const bundle = await getHotelGuestRules(session.data.guest.hotel_id)
    if (bundle) {
      return (
        <GuestRulesGate
          hotelName={bundle.hotelName}
          rules={bundle.rules}
          mode="portal"
        />
      )
    }
  }

  const propertyContacts = await getGuestPropertyContacts(session.data.guest.hotel_id)

  return (
    <GuestPortal
      guest={session.data.guest}
      roomNumber={session.data.roomNumber}
      propertyContacts={propertyContacts}
    />
  )
}

function messageForError(error?: string): string {
  if (error === 'expired') {
    return 'This link has expired. Please contact the front desk for a new one.'
  }
  if (error === 'missing') {
    return 'Scan the property QR code or use the link from the front desk.'
  }
  return 'Please scan the property QR code or use the link from the front desk.'
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
