import { Suspense } from 'react'
import { PageHeader } from '@/components/dashboard/page-header'
import { GuestMessagesPageClient } from '@/components/guest-messages/guest-messages-page-client'
import { loadGuestConversations } from '@/lib/data/guest-conversations'
import { getProfile } from '@/lib/auth/get-profile'
import { redirect } from 'next/navigation'

export default async function ManagerMessagesPage() {
  const profile = await getProfile()
  if (!profile?.hotel_id) redirect('/login')

  const conversations = await loadGuestConversations(profile.hotel_id)

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Concierge"
        title="Guest messages"
        description="Chat with in-house guests about their stay — separate from maintenance complaints."
      />
      <Suspense fallback={null}>
        <GuestMessagesPageClient conversations={conversations} basePath="/manager/messages" />
      </Suspense>
    </div>
  )
}
