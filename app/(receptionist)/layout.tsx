import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/get-profile'
import { AppShell } from '@/components/dashboard/app-shell'
import { StaffShellErrorBoundary } from '@/components/errors/staff-shell-error-boundary'
import { receptionistNavigation } from '@/lib/navigation'
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

export default async function ReceptionistLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let profile
  try {
    profile = await getProfile()
  } catch (err) {
    console.error('[receptionist layout] getProfile failed:', err)
    redirect('/login')
  }

  if (!profile || profile.role !== 'receptionist') {
    redirect('/login')
  }

  let navigation = receptionistNavigation.map((item) => ({ ...item }))
  let occupancyToday: OccupancyToday | undefined

  if (profile.hotel_id) {
    try {
      const supabase = await createClient()
      const [badges, occupancy] = await Promise.all([
        getNavBadgeMap(),
        getOccupancyToday(supabase, profile.hotel_id),
      ])
      navigation = applyBadges(navigation, badges)
      occupancyToday = occupancy
    } catch (err) {
      console.error('[receptionist layout] badge/occupancy load failed:', err)
    }
  }

  return (
    <StaffShellErrorBoundary boundary="receptionist/shell" homeHref="/receptionist/dashboard">
      <AppShell navigation={navigation} profile={profile} enableRealtime occupancyToday={occupancyToday}>
        {children}
      </AppShell>
    </StaffShellErrorBoundary>
  )
}
