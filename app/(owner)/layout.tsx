import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/get-profile'
import { AppShell } from '@/components/dashboard/app-shell'
import { ownerNavigation } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOccupancyToday, type OccupancyToday } from '@/lib/data/occupancy'

async function getPendingApprovalsCount(hotelId: string) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('complaints')
    .select('*', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)
    .eq('status', 'pending_approval')
  return count ?? 0
}

export default async function OwnerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'owner') {
    redirect('/login')
  }

  const navigation = [...ownerNavigation]
  let occupancyToday: OccupancyToday | undefined
  if (profile.hotel_id) {
    const supabase = await createClient()
    const [pending, occupancy] = await Promise.all([
      getPendingApprovalsCount(profile.hotel_id),
      getOccupancyToday(supabase, profile.hotel_id),
    ])
    const complaintsNav = navigation.find((n) => n.href.includes('complaints'))
    if (complaintsNav) complaintsNav.badge = pending
    occupancyToday = occupancy
  }

  return (
    <AppShell navigation={navigation} profile={profile} occupancyToday={occupancyToday}>
      {children}
    </AppShell>
  )
}
