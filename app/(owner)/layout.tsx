import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/get-profile'
import { AppShell } from '@/components/dashboard/app-shell'
import { ownerNavGroups } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'
import { requiresOnboarding } from '@/lib/onboarding/state'
import { getOccupancyToday, type OccupancyToday } from '@/lib/data/occupancy'

export default async function OwnerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'owner') {
    redirect('/login')
  }

  if (requiresOnboarding(profile)) {
    redirect('/get-started')
  }

  const navGroups = ownerNavGroups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item })),
  }))
  let occupancyToday: OccupancyToday | undefined

  if (profile.hotel_id) {
    const supabase = await createClient()
    occupancyToday = await getOccupancyToday(supabase, profile.hotel_id)
  }

  return (
    <AppShell navGroups={navGroups} profile={profile} enableRealtime occupancyToday={occupancyToday}>
      {children}
    </AppShell>
  )
}
