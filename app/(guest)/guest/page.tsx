import { redirect } from 'next/navigation'
import { GuestPortal } from '@/components/guest/guest-portal'
import { GuestRulesGate } from '@/components/guest/guest-rules-gate'
import { getGuestFromSession } from '@/app/actions/guest'
import { guestNeedsRulesAcceptance } from '@/app/actions/guest-rules'
import { getGuestPropertyContacts } from '@/lib/data/contacts'
import { getHotelGuestRules } from '@/lib/data/guest-rules'
import { loadGuestPortalContext } from '@/lib/data/guest-portal'

export default async function GuestPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; tab?: string }>
}) {
  const params = await searchParams

  // Legacy links (?token=) — hand off to the route handler that can set the session cookie.
  if (params.token) {
    redirect(`/guest/enter?t=${encodeURIComponent(params.token)}`)
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

  const [propertyContacts, context] = await Promise.all([
    getGuestPropertyContacts(session.data.guest.hotel_id),
    loadGuestPortalContext(session.data.guest),
  ])

  if (!context) {
    return <GuestExpiredPage message="Property not found. Please contact the front desk." />
  }

  return (
    <GuestPortal
      guest={session.data.guest}
      roomNumber={session.data.roomNumber}
      propertyContacts={propertyContacts}
      context={context}
      initialTab={params.tab}
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
  if (error === 'invalid' || error === 'Invalid or expired link.') {
    return 'This guest link is not valid. Ask the front desk for a new QR code or link.'
  }
  if (error === 'config') {
    return 'Guest sign-in is temporarily unavailable. Please contact the front desk.'
  }
  return 'Please scan the property QR code or use the link from the front desk.'
}

function GuestExpiredPage({ message }: { message?: string }) {
  return (
    <div className="guest-auth-shell flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="guest-auth-brand text-3xl">MOJO APARTMENTS</p>
      <p className="mt-8 max-w-sm text-lg guest-text-muted">
        {message ?? 'This link has expired. Please contact the front desk.'}
      </p>
    </div>
  )
}
