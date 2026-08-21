import { getVerifiedProfile } from '@/lib/auth/get-profile'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadAssignedManagerProfiles } from '@/lib/data/staff-assignments'
import { mergeStaffForHotel } from '@/lib/staff-assignments/rules'
import type { EmployeeCompensationRow } from '@/lib/payroll/types'
import type { Profile, StaffInvite } from '@/types'

export interface StaffData {
  profile: Profile | null
  staff: Profile[]
  invites: StaffInvite[]
  compensationByProfileId: Record<string, EmployeeCompensationRow>
}

export type StaffPropertyOption = { id: string; name: string }

export type ManagerAssignmentChip = { hotelId: string; hotelName: string }

export type PortfolioManagerOption = {
  id: string
  name: string
  email: string
  phone: string | null
  homeHotelName: string
}

export interface OwnerStaffAssignmentUi {
  properties: StaffPropertyOption[]
  assignmentsByProfileId: Record<string, ManagerAssignmentChip[]>
  addableManagers: PortfolioManagerOption[]
}

const ROLE_RANK: Record<string, number> = { owner: 0, manager: 1, technician: 2 }

export async function getStaffData(): Promise<StaffData> {
  const profile = await getVerifiedProfile()
  if (!profile?.hotel_id) {
    return { profile, staff: [], invites: [], compensationByProfileId: {} }
  }

  const admin = createAdminClient()
  const [staffRes, invitesRes, compRes, assignedManagers] = await Promise.all([
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
    loadAssignedManagerProfiles(profile.hotel_id),
  ])

  const staff = mergeStaffForHotel(
    (staffRes.data ?? []) as Profile[],
    assignedManagers,
  ).sort((a, b) => {
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

export async function getOwnerStaffAssignmentUi(
  ownerId: string,
  activeHotelId: string,
): Promise<OwnerStaffAssignmentUi> {
  const empty: OwnerStaffAssignmentUi = {
    properties: [],
    assignmentsByProfileId: {},
    addableManagers: [],
  }
  const admin = createAdminClient()
  const { data: hotels } = await admin
    .from('hotels')
    .select('id, name')
    .eq('owner_id', ownerId)
    .order('name')

  const properties = (hotels ?? []).map((h) => ({ id: h.id, name: h.name }))
  if (properties.length === 0) return empty

  const hotelIds = properties.map((p) => p.id)
  const nameById = new Map(properties.map((p) => [p.id, p.name]))

  const { data: assignmentRows } = await admin
    .from('hotel_staff_assignments')
    .select('profile_id, hotel_id')
    .in('hotel_id', hotelIds)
    .eq('is_active', true)
    .eq('role', 'manager')

  const assignmentsByProfileId: Record<string, ManagerAssignmentChip[]> = {}
  for (const row of assignmentRows ?? []) {
    const chips = assignmentsByProfileId[row.profile_id] ?? []
    chips.push({
      hotelId: row.hotel_id,
      hotelName: nameById.get(row.hotel_id) ?? 'Property',
    })
    assignmentsByProfileId[row.profile_id] = chips
  }

  const onActive = new Set(
    (assignmentRows ?? []).filter((row) => row.hotel_id === activeHotelId).map((row) => row.profile_id),
  )
  const addableIds = [
    ...new Set(
      (assignmentRows ?? [])
        .filter((row) => row.hotel_id !== activeHotelId && !onActive.has(row.profile_id))
        .map((row) => row.profile_id),
    ),
  ]

  if (addableIds.length === 0) {
    return { properties, assignmentsByProfileId, addableManagers: [] }
  }

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, name, email, phone, hotel_id, is_active')
    .in('id', addableIds)
    .eq('role', 'manager')

  const addableManagers: PortfolioManagerOption[] = (profiles ?? [])
    .filter((p) => p.is_active !== false)
    .map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      homeHotelName:
        (p.hotel_id ? nameById.get(p.hotel_id) : undefined) ??
        assignmentsByProfileId[p.id]?.[0]?.hotelName ??
        'Another property',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return { properties, assignmentsByProfileId, addableManagers }
}
