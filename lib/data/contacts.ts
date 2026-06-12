import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, phone, role')
    .eq('hotel_id', hotelId)
    .eq('is_active', true)
    .in('role', roles)
    .not('phone', 'is', null)
    .order('role')

  if (error) return []

  return (data ?? [])
    .filter((row) => row.phone && phoneDigits(row.phone).length >= 9)
    .map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone!,
      role: row.role as UserRole,
    }))
}

/** Guest portal — managers only (owner contact is not exposed to guests). */
export async function getGuestPropertyContacts(hotelId: string): Promise<StaffContact[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('id, name, phone, role')
    .eq('hotel_id', hotelId)
    .eq('is_active', true)
    .eq('role', 'manager')
    .not('phone', 'is', null)
    .order('name')

  if (error) return []

  return (data ?? [])
    .filter((row) => row.phone && phoneDigits(row.phone).length >= 9)
    .map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone!,
      role: row.role as UserRole,
    }))
}
