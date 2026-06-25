import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/get-profile'
import { AppShell } from '@/components/dashboard/app-shell'
import { ownerNavigation } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOccupancyToday, type OccupancyToday } from '@/lib/data/occupancy'
import { getSubscriptionForOwner } from '@/lib/saas/organization'

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

  if (!profile.onboarding_completed_at) {
    redirect('/get-started')
  }

  const navigation = ownerNavigation.map((item) => ({ ...item }))
  let occupancyToday: OccupancyToday | undefined
  const subscription = await getSubscriptionForOwner(profile.id)
  if (profile.hotel_id) {
    const supabase = await createClient()
    const [pending, occupancy] = await Promise.all([
      getPendingApprovalsCount(profile.hotel_id),
      getOccupancyToday(supabase, profile.hotel_id),
    ])
    const complaintsNav = navigation.find((n) => n.href.includes('complaints'))
    if (complaintsNav && pending > 0) complaintsNav.badge = pending
    occupancyToday = occupancy
  }

  return (
    <AppShell navigation={navigation} profile={profile} enableRealtime occupancyToday={occupancyToday} subscription={subscription}>
      {children}
    </AppShell>
  )
}
