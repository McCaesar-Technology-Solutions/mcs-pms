import { Suspense } from 'react'
import { PageHeader } from '@/components/dashboard/page-header'
import { GuestMessagesPageClient } from '@/components/guest-messages/guest-messages-page-client'
import { loadGuestConversations } from '@/lib/data/guest-conversations'
import { getProfile } from '@/lib/auth/get-profile'
import { redirect } from 'next/navigation'

export default async function ReceptionistMessagesPage() {
  const profile = await getProfile()
  if (!profile?.hotel_id) redirect('/login')

  const conversations = await loadGuestConversations(profile.hotel_id)

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Concierge"
        title="Guest messages"
        description="Reply to guests from their portal — checkout questions, arrivals, and general help."
      />
      <Suspense fallback={null}>
        <GuestMessagesPageClient
          conversations={conversations}
          basePath="/receptionist/messages"
        />
      </Suspense>
    </div>
  )
}
