import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { TechnicianMessagesClient } from '@/components/staff-messages/technician-messages-client'
import { getProfile } from '@/lib/auth/get-profile'
import { loadStaffConversations } from '@/lib/data/staff-conversations'
import { getStaffData } from '@/lib/data/staff'

export default async function TechnicianMessagesPage() {
  const profile = await getProfile()
  if (!profile?.hotel_id) redirect('/login')

  const [staffConversations, { staff }] = await Promise.all([
    loadStaffConversations(profile.hotel_id, profile.id),
    getStaffData(),
  ])

  const hotelStaff = staff.map((s) => ({ id: s.id, name: s.name, role: s.role }))

  return (
    <div className="page-shell page-shell--messages">
      <Suspense fallback={null}>
        <TechnicianMessagesClient
          conversations={staffConversations}
          hotelStaff={hotelStaff}
          currentUserId={profile.id}
        />
      </Suspense>
    </div>
  )
}
