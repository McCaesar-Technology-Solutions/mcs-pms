import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/get-profile'
import { AppShell } from '@/components/dashboard/app-shell'
import { ownerNavGroups } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'
import { requiresOnboarding } from '@/lib/onboarding/state'
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

  let navGroups = ownerNavGroups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item })),
  }))
  let occupancyToday: OccupancyToday | undefined

  if (profile.hotel_id) {
    const supabase = await createClient()
    const [badges, occupancy] = await Promise.all([
      getNavBadgeMap(),
      getOccupancyToday(supabase, profile.hotel_id),
    ])
    navGroups = navGroups.map((group) => ({
      ...group,
      items: applyBadges(group.items, badges),
    }))
    occupancyToday = occupancy
  }

  return (
    <AppShell navGroups={navGroups} profile={profile} enableRealtime occupancyToday={occupancyToday}>
      {children}
    </AppShell>
  )
}
