import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/get-profile'
import { AppShell } from '@/components/dashboard/app-shell'
import { receptionistNavigation } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOccupancyToday, type OccupancyToday } from '@/lib/data/occupancy'

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
    occupancyToday = await getOccupancyToday(supabase, profile.hotel_id)
  }

  return (
    <AppShell navigation={navigation} profile={profile} enableRealtime occupancyToday={occupancyToday}>
      {children}
    </AppShell>
  )
}
