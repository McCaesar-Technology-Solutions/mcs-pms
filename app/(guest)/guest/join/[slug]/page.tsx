import { notFound } from 'next/navigation'
import { GuestRoomEntryForm } from '@/components/guest/guest-room-entry-form'
import { GuestRulesGate } from '@/components/guest/guest-rules-gate'
import { getGuestRulesBySlug } from '@/lib/data/guest-rules'
import { hasAcceptedPropertyRules } from '@/lib/guest-rules-cookie'
import { isValidGuestPortalSlug } from '@/lib/guest-portal'

export default async function PropertyJoinPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const normalized = slug.trim().toLowerCase()

  if (!isValidGuestPortalSlug(normalized)) {
    notFound()
  }

  const bundle = await getGuestRulesBySlug(normalized)
  if (!bundle) {
    notFound()
  }

  const rulesAccepted = await hasAcceptedPropertyRules(bundle.hotelId, bundle.version)

  if (!rulesAccepted) {
    return (
      <GuestRulesGate
        hotelName={bundle.hotelName}
        rules={bundle.rules}
        mode="join"
        slug={normalized}
      />
    )
  }

  return <GuestRoomEntryForm slug={normalized} hotelName={bundle.hotelName} />
}
