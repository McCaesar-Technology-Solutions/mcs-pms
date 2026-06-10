import { getProfile } from '@/lib/auth/get-profile'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile, StaffInvite } from '@/types'

export interface StaffData {
  profile: Profile | null
  staff: Profile[]
  invites: StaffInvite[]
}

const ROLE_RANK: Record<string, number> = { owner: 0, manager: 1, technician: 2 }

export async function getStaffData(): Promise<StaffData> {
  const profile = await getProfile()
  if (!profile?.hotel_id) return { profile, staff: [], invites: [] }

  const admin = createAdminClient()
  const [staffRes, invitesRes] = await Promise.all([
    admin.from('profiles').select('*').eq('hotel_id', profile.hotel_id),
    admin
      .from('staff_invites')
      .select('*')
      .eq('hotel_id', profile.hotel_id)
      .eq('accepted', false)
      .order('created_at', { ascending: false }),
  ])

  const staff = ((staffRes.data ?? []) as Profile[]).sort((a, b) => {
    const rank = (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9)
    if (rank !== 0) return rank
    return a.name.localeCompare(b.name)
  })

  return {
    profile,
    staff,
    invites: (invitesRes.data ?? []) as StaffInvite[],
  }
}
