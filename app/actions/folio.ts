'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVerifiedProfile } from '@/lib/auth/get-profile'
import { writeAuditLog } from '@/lib/audit/log'
import { clampLimit } from '@/lib/data/pagination'
import { isFolioPostingBlocked } from '@/lib/folio/lock'
import { canApplyGuestDiscount } from '@/lib/auth/tenant-access'

const postChargeSchema = z
  .object({
    guestId: z.string().uuid(),
    description: z.string().min(2).max(200),
    amount: z.coerce.number().positive(),
    chargeType: z
      .enum(['room', 'incidental', 'tax', 'deposit', 'adjustment', 'discount'])
      .default('incidental'),
    reservationId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.chargeType === 'discount' && data.amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Discount amount must be greater than zero.',
        path: ['amount'],
      })
    }
  })

export type FolioActionResult =
  | { success: true; data?: unknown }
  | { success: false; error: string }

export async function postGuestCharge(input: unknown): Promise<FolioActionResult> {
  const parsed = postChargeSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid charge.' }
  }

  const profile = await getVerifiedProfile()
  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  if (parsed.data.chargeType === 'discount' && !canApplyGuestDiscount(profile.role)) {
    return {
      success: false,
      error: 'Only managers and owners can post folio discounts. Ask a manager.',
    }
  }

  const supabase = await createClient()
  const { data: guest } = await supabase
    .from('guests')
    .select('id, name')
    .eq('id', parsed.data.guestId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!guest) return { success: false, error: 'Guest not found.' }

  const admin = createAdminClient()
  const folioLock = await isFolioPostingBlocked(
    admin,
    profile.hotel_id,
    parsed.data.guestId,
    parsed.data.reservationId,
  )
  if (folioLock.blocked) {
    return {
      success: false,
      error:
        'Folio is locked while checkout is in progress. Complete or cancel checkout before posting new charges.',
    }
  }

  const signedAmount =
    parsed.data.chargeType === 'discount' ? -Math.abs(parsed.data.amount) : parsed.data.amount

  const { data, error } = await supabase
    .from('guest_charges')
    .insert({
      hotel_id: profile.hotel_id,
      guest_id: parsed.data.guestId,
      reservation_id: parsed.data.reservationId ?? folioLock.reservationId ?? null,
      description: parsed.data.description.trim(),
      amount: signedAmount,
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
    summary: `Posted ${parsed.data.description} (GHS ${signedAmount}) to ${guest.name}`,
  })

  revalidatePath('/owner/guests')
  revalidatePath('/manager/guests')
  revalidatePath('/receptionist/guests')
  return { success: true, data: { id: data.id } }
}

export async function getGuestFolioCharges(guestId: string, limit?: number) {
  const profile = await getVerifiedProfile()
  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return []
  }

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
