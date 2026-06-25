'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth/get-profile'
import { writeAuditLog } from '@/lib/audit/log'
import { clampLimit } from '@/lib/data/pagination'

const postChargeSchema = z.object({
  guestId: z.string().uuid(),
  description: z.string().min(2).max(200),
  amount: z.coerce.number().positive(),
  chargeType: z.enum(['room', 'incidental', 'tax', 'deposit', 'adjustment']).default('incidental'),
  reservationId: z.string().uuid().optional(),
})

export type FolioActionResult =
  | { success: true; data?: unknown }
  | { success: false; error: string }

export async function postGuestCharge(input: unknown): Promise<FolioActionResult> {
  const parsed = postChargeSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid charge.' }
  }

  const profile = await getProfile()
  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const supabase = await createClient()
  const { data: guest } = await supabase
    .from('guests')
    .select('id, name')
    .eq('id', parsed.data.guestId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!guest) return { success: false, error: 'Guest not found.' }

  const { data, error } = await supabase
    .from('guest_charges')
    .insert({
      hotel_id: profile.hotel_id,
      guest_id: parsed.data.guestId,
      reservation_id: parsed.data.reservationId ?? null,
      description: parsed.data.description.trim(),
      amount: parsed.data.amount,
      charge_type: parsed.data.chargeType,
      posted_by: profile.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'guest',
    entityId: parsed.data.guestId,
    action: 'folio_post',
    summary: `Posted ${parsed.data.description} (GHS ${parsed.data.amount}) to ${guest.name}`,
  })

  revalidatePath('/owner/guests')
  revalidatePath('/manager/guests')
  return { success: true, data: { id: data.id } }
}

export async function getGuestFolioCharges(guestId: string, limit?: number) {
  const profile = await getProfile()
  if (!profile?.hotel_id) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('guest_charges')
    .select('id, description, amount, charge_type, created_at, invoice_id')
    .eq('hotel_id', profile.hotel_id)
    .eq('guest_id', guestId)
    .order('created_at', { ascending: false })
    .limit(clampLimit(limit))

  return data ?? []
}
