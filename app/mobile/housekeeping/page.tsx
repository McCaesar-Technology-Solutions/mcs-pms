import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { HousekeepingKanban } from '@/components/dashboard/housekeeping-kanban'
import { MobileRealtimeShell } from '@/components/realtime/mobile-realtime-shell'
import { getProfile } from '@/lib/auth/get-profile'
import { getDashboardData } from '@/lib/data/dashboard'
import { getStaffData } from '@/lib/data/staff'
import { getHousekeepingTasks } from '@/lib/data/housekeeping'

export default async function MobileHousekeepingPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  if (profile.role === 'technician') {
    redirect('/technician/tasks')
  }

  if (!profile.hotel_id || !['owner', 'manager'].includes(profile.role)) {
    redirect('/login')
  }

  const [{ roomOptions }, { staff }, tasks] = await Promise.all([
    getDashboardData(),
    getStaffData(),
    getHousekeepingTasks(),
  ])

  const assignableStaff = staff
    .filter((s) => s.is_active !== false)
    .map((s) => ({ id: s.id, name: s.name }))

  const backHref = profile.role === 'owner' ? '/owner/dashboard' : '/manager/housekeeping'

  return (
    <div className="mx-auto min-h-dvh max-w-lg p-4 pb-8">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div>
          <h1 className="text-lg font-semibold">Housekeeping</h1>
          <p className="text-xs text-muted-foreground">Mobile task board</p>
        </div>
      </div>

      <MobileRealtimeShell hotelId={profile.hotel_id}>
        <HousekeepingKanban
          tasks={tasks}
          rooms={roomOptions}
          staff={assignableStaff}
          canManage={profile.role === 'owner' || profile.role === 'manager'}
        />
      </MobileRealtimeShell>
    </div>
  )
}
