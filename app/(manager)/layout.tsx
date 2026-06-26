import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/get-profile'
import { AppShell } from '@/components/dashboard/app-shell'
import { managerNavigation } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOccupancyToday, type OccupancyToday } from '@/lib/data/occupancy'
import { countUnreadGuestConversations } from '@/lib/data/guest-conversations'

async function getPendingApprovalsCount(hotelId: string) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('complaints')
    .select('*', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)
    .eq('status', 'pending_approval')
  return count ?? 0
}

export default async function ManagerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'manager') {
    redirect('/login')
  }

  const navigation = managerNavigation.map((item) => ({ ...item }))
  let occupancyToday: OccupancyToday | undefined
  if (profile.hotel_id) {
    const supabase = await createClient()
    const [pending, unreadMessages, occupancy] = await Promise.all([
      getPendingApprovalsCount(profile.hotel_id),
      countUnreadGuestConversations(profile.hotel_id),
      getOccupancyToday(supabase, profile.hotel_id),
    ])
    const complaintsNav = navigation.find((n) => n.name === 'Complaints')
    if (complaintsNav && pending > 0) complaintsNav.badge = pending
    const messagesNav = navigation.find((n) => n.name === 'Messages')
    if (messagesNav && unreadMessages > 0) messagesNav.badge = unreadMessages
    occupancyToday = occupancy
  }

  return (
    <AppShell navigation={navigation} profile={profile} enableRealtime occupancyToday={occupancyToday}>
      {children}
    </AppShell>
  )
}
