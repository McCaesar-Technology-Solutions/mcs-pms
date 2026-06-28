import { Suspense } from 'react'
import { GuestMessagesPageClient } from '@/components/guest-messages/guest-messages-page-client'
import { loadGuestConversations } from '@/lib/data/guest-conversations'
import { getProfile } from '@/lib/auth/get-profile'
import { redirect } from 'next/navigation'

export default async function ReceptionistMessagesPage() {
  const profile = await getProfile()
  if (!profile?.hotel_id) redirect('/login')

  const conversations = await loadGuestConversations(profile.hotel_id)

  return (
    <div className="page-shell page-shell--messages">
      <Suspense fallback={null}>
        <GuestMessagesPageClient
          conversations={conversations}
          basePath="/receptionist/messages"
        />
      </Suspense>
    </div>
  )
}
