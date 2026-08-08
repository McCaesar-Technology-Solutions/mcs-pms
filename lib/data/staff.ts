import { getVerifiedProfile } from '@/lib/auth/get-profile'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EmployeeCompensationRow } from '@/lib/payroll/types'
import type { Profile, StaffInvite } from '@/types'

export interface StaffData {
  profile: Profile | null
  staff: Profile[]
  invites: StaffInvite[]
  compensationByProfileId: Record<string, EmployeeCompensationRow>
}

const ROLE_RANK: Record<string, number> = { owner: 0, manager: 1, technician: 2 }

export async function getStaffData(): Promise<StaffData> {
  const profile = await getVerifiedProfile()
  if (!profile?.hotel_id) {
    return { profile, staff: [], invites: [], compensationByProfileId: {} }
  }

  const admin = createAdminClient()
  const [staffRes, invitesRes, compRes] = await Promise.all([
    admin.from('profiles').select('*').eq('hotel_id', profile.hotel_id),
    admin
      .from('staff_invites')
      .select('*')
      .eq('hotel_id', profile.hotel_id)
      .eq('accepted', false)
      .order('created_at', { ascending: false }),
    profile.role === 'owner'
      ? admin.from('employee_compensation').select('*').eq('hotel_id', profile.hotel_id)
      : Promise.resolve({ data: [] as never[] }),
  ])

  const staff = ((staffRes.data ?? []) as Profile[]).sort((a, b) => {
    const rank = (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9)
    if (rank !== 0) return rank
    return a.name.localeCompare(b.name)
  })

  const compensationByProfileId: Record<string, EmployeeCompensationRow> = {}
  for (const row of compRes.data ?? []) {
    compensationByProfileId[row.profile_id] = {
      id: row.id,
      hotelId: row.hotel_id,
      profileId: row.profile_id,
      payType: row.pay_type,
      baseAmount: Number(row.base_amount),
      currency: row.currency,
      momoNumber: row.momo_number,
      bankName: row.bank_name,
      bankAccount: row.bank_account,
      tin: row.tin,
      ssnitNumber: row.ssnit_number,
      hireDate: row.hire_date,
      payrollActive: row.payroll_active,
      notes: row.notes,
    }
  }

  return {
    profile,
    staff,
    invites: (invitesRes.data ?? []) as StaffInvite[],
    compensationByProfileId,
  }
}
