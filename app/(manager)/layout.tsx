import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/get-profile'
import { AppShell } from '@/components/dashboard/app-shell'
import { managerNavigation } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'

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
  if (profile.hotel_id) {
    const pending = await getPendingApprovalsCount(profile.hotel_id)
    const complaintsNav = navigation.find((n) => n.name === 'Complaints')
    if (complaintsNav) complaintsNav.badge = pending
  }

  return (
    <AppShell navigation={navigation} profile={profile} enableRealtime>
      {children}
    </AppShell>
  )
}
