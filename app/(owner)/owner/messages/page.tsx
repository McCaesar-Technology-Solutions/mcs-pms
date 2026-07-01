import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { StaffMessagesHub } from '@/components/guest-messages/staff-messages-hub'
import { getProfile } from '@/lib/auth/get-profile'
import { loadGuestConversations } from '@/lib/data/guest-conversations'
import { loadStaffConversations } from '@/lib/data/staff-conversations'
import { getStaffData } from '@/lib/data/staff'

export default async function OwnerMessagesPage() {
  const profile = await getProfile()
  if (!profile?.hotel_id) redirect('/login')

  const [conversations, staffConversations, { staff }] = await Promise.all([
    loadGuestConversations(profile.hotel_id),
    loadStaffConversations(profile.hotel_id, profile.id),
    getStaffData(),
  ])

  const hotelStaff = staff.map((s) => ({ id: s.id, name: s.name, role: s.role }))

  return (
    <div className="page-shell page-shell--messages">
      <Suspense fallback={null}>
        <StaffMessagesHub
          guestConversations={conversations}
          staffConversations={staffConversations}
          hotelStaff={hotelStaff}
          currentUserId={profile.id}
          basePath="/owner/messages"
          reservationsHref="/owner/reservations"
          canManageGroupMembers
        />
      </Suspense>
    </div>
  )
}
