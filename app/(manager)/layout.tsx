import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/get-profile'
import { AppShell } from '@/components/dashboard/app-shell'
import { managerNavigation } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOccupancyToday, type OccupancyToday } from '@/lib/data/occupancy'
import { getNavBadgeMap } from '@/lib/data/staff-alerts'

function applyBadges<T extends { href: string; badge?: number }>(
  items: T[],
  badges: Record<string, number>,
): T[] {
  return items.map((item) => ({
    ...item,
    badge: badges[item.href] && badges[item.href] > 0 ? badges[item.href] : undefined,
  }))
}

export default async function ManagerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'manager') {
    redirect('/login')
  }

  let navigation = managerNavigation.map((item) => ({ ...item }))
  let occupancyToday: OccupancyToday | undefined

  if (profile.hotel_id) {
    const supabase = await createClient()
    const [badges, occupancy] = await Promise.all([
      getNavBadgeMap(),
      getOccupancyToday(supabase, profile.hotel_id),
    ])
    navigation = applyBadges(navigation, badges)
    occupancyToday = occupancy
  }

  return (
    <AppShell navigation={navigation} profile={profile} enableRealtime occupancyToday={occupancyToday}>
      {children}
    </AppShell>
  )
}
