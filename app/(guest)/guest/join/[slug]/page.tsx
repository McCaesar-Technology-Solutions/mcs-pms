import { notFound } from 'next/navigation'
import { getPropertyJoinPage } from '@/app/actions/guest-portal'
import { GuestRoomEntryForm } from '@/components/guest/guest-room-entry-form'
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

  const property = await getPropertyJoinPage(normalized)
  if (!property) {
    notFound()
  }

  return <GuestRoomEntryForm slug={normalized} hotelName={property.hotelName} />
}
