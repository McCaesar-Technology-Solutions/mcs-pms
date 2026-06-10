'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ownerOwnsHotel } from '@/lib/data/properties'
import { updateHotelSettingsSchema } from '@/lib/validations'

export type SettingsActionResult = { success: true } | { success: false; error: string }

function revalidateSettingsViews() {
  revalidatePath('/owner/settings')
  revalidatePath('/owner/dashboard')
  revalidatePath('/owner/billing')
  revalidatePath('/owner/gra-reports')
}

export async function updateHotelSettings(input: {
  hotelId: string
  name: string
  address: string
  city: string
  region: string
  gta_license_number?: string
  gta_license_expiry?: string
  vat_registration_number?: string
}): Promise<SettingsActionResult> {
  const parsed = updateHotelSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authorized.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'owner') {
    return { success: false, error: 'Only owners can update property settings.' }
  }

  if (!(await ownerOwnsHotel(user.id, parsed.data.hotelId))) {
    return { success: false, error: 'You do not have access to this property.' }
  }

  const { error } = await supabase
    .from('hotels')
    .update({
      name: parsed.data.name.trim(),
      address: parsed.data.address.trim(),
      city: parsed.data.city.trim(),
      region: parsed.data.region.trim(),
      gta_license_number: parsed.data.gta_license_number?.trim() || null,
      gta_license_expiry: parsed.data.gta_license_expiry || null,
      vat_registration_number: parsed.data.vat_registration_number?.trim() || null,
    })
    .eq('id', parsed.data.hotelId)

  if (error) return { success: false, error: error.message }

  revalidateSettingsViews()
  return { success: true }
}
