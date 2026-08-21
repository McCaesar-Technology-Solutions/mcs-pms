import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadAssignedManagerProfiles } from '@/lib/data/staff-assignments'
import { mergeStaffForHotel } from '@/lib/staff-assignments/rules'
import { phoneDigits } from '@/lib/phone'
import type { UserRole } from '@/types'

export interface StaffContact {
  id: string
  name: string
  phone: string
  role: UserRole
}

export async function getStaffContacts(
  hotelId: string,
  roles: UserRole[] = ['manager'],
): Promise<StaffContact[]> {
  const supabase = await createClient()
  const [{ data, error }, assigned] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, phone, role')
      .eq('hotel_id', hotelId)
      .eq('is_active', true)
      .in('role', roles)
      .not('phone', 'is', null)
      .order('role'),
    roles.includes('manager')
      ? loadAssignedManagerProfiles(hotelId, { activeOnly: true })
      : Promise.resolve([]),
  ])

  if (error) return []

  const merged = mergeStaffForHotel(
    data ?? [],
    assigned.map((p) => ({ id: p.id, name: p.name, phone: p.phone, role: p.role })),
  )

  return merged
    .filter((row) => row.phone && phoneDigits(row.phone).length >= 9)
    .map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone!,
      role: row.role as UserRole,
    }))
}

/** Guest portal — managers and front desk (owner contact is not exposed to guests). */
export async function getGuestPropertyContacts(hotelId: string): Promise<StaffContact[]> {
  const admin = createAdminClient()
  const [{ data, error }, assigned] = await Promise.all([
    admin
      .from('profiles')
      .select('id, name, phone, role')
      .eq('hotel_id', hotelId)
      .eq('is_active', true)
      .in('role', ['manager', 'receptionist'])
      .not('phone', 'is', null)
      .order('role')
      .order('name'),
    loadAssignedManagerProfiles(hotelId, { activeOnly: true }),
  ])

  if (error) return []

  const merged = mergeStaffForHotel(
    data ?? [],
    assigned.map((p) => ({ id: p.id, name: p.name, phone: p.phone, role: p.role })),
  )

  return merged
    .filter((row) => row.phone && phoneDigits(row.phone).length >= 9)
    .map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone!,
      role: row.role as UserRole,
    }))
}
