import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/get-profile'
import { AppShell } from '@/components/dashboard/app-shell'
import { receptionistNavigation } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOccupancyToday, type OccupancyToday } from '@/lib/data/occupancy'
import { countUnreadGuestConversations } from '@/lib/data/guest-conversations'

export default async function ReceptionistLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'receptionist') {
    redirect('/login')
  }

  const navigation = receptionistNavigation.map((item) => ({ ...item }))
  let occupancyToday: OccupancyToday | undefined
  if (profile.hotel_id) {
    const supabase = await createClient()
    const [occupancy, unreadMessages] = await Promise.all([
      getOccupancyToday(supabase, profile.hotel_id),
      countUnreadGuestConversations(profile.hotel_id),
    ])
    occupancyToday = occupancy
    const messagesNav = navigation.find((n) => n.name === 'Messages')
    if (messagesNav && unreadMessages > 0) messagesNav.badge = unreadMessages
  }

  return (
    <AppShell navigation={navigation} profile={profile} enableRealtime occupancyToday={occupancyToday}>
      {children}
    </AppShell>
  )
}
