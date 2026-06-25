'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth/get-profile'
import {
  canOwnerEraseGuestData,
  canStaffExportGuestData,
  canStaffViewGuestIdDocument,
} from '@/lib/auth/tenant-access'
import { writeAuditLog } from '@/lib/audit/log'
import { GUEST_ID_DOCUMENT_BUCKET } from '@/lib/guest/id-documents'

export type GuestPrivacyResult =
  | { success: true; data?: unknown }
  | { success: false; error: string }

export async function exportGuestData(guestId: string): Promise<GuestPrivacyResult> {
  const profile = await getProfile()
  if (!profile?.hotel_id || !canStaffExportGuestData(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: guest } = await admin
    .from('guests')
    .select('*')
    .eq('id', guestId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!guest) return { success: false, error: 'Guest not found.' }

  const [reservations, complaints, requests, feedback, charges] = await Promise.all([
    admin.from('reservations').select('*').eq('guest_id', guestId),
    admin.from('complaints').select('*').eq('guest_id', guestId),
    admin.from('guest_requests').select('*').eq('guest_id', guestId),
    admin.from('guest_feedback').select('*').eq('guest_id', guestId),
    admin.from('guest_charges').select('*').eq('guest_id', guestId),
  ])

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'guest',
    entityId: guestId,
    action: 'export',
    summary: `Exported personal data for ${guest.name}`,
  })

  return {
    success: true,
    data: {
      guest,
      reservations: reservations.data ?? [],
      complaints: complaints.data ?? [],
      guestRequests: requests.data ?? [],
      feedback: feedback.data ?? [],
      charges: charges.data ?? [],
      exportedAt: new Date().toISOString(),
    },
  }
}

export async function eraseGuestPersonalData(guestId: string): Promise<GuestPrivacyResult> {
  const profile = await getProfile()
  if (!profile?.hotel_id || !canOwnerEraseGuestData(profile.role)) {
    return { success: false, error: 'Only the property owner can erase guest data.' }
  }

  const admin = createAdminClient()
  const { data: guest } = await admin
    .from('guests')
    .select('id, name, hotel_id, pre_arrival_id_path')
    .eq('id', guestId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!guest) return { success: false, error: 'Guest not found.' }

  if (guest.pre_arrival_id_path) {
    await admin.storage.from(GUEST_ID_DOCUMENT_BUCKET).remove([guest.pre_arrival_id_path])
  }

  await admin
    .from('guests')
    .update({
      name: 'Redacted guest',
      email: null,
      phone: null,
      ghana_card_number: null,
      pre_arrival_notes: null,
      pre_arrival_eta: null,
      pre_arrival_id_path: null,
      pre_arrival_id_mime: null,
      guest_photo_path: null,
      guest_photo_mime: null,
      token: randomUUID(),
      token_expires_at: new Date().toISOString(),
    })
    .eq('id', guestId)

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'guest',
    entityId: guestId,
    action: 'erase',
    summary: `Erased personal data for former guest ${guest.name}`,
  })

  revalidatePath('/owner/guests')
  revalidatePath('/manager/guests')
  return { success: true }
}

export async function getGuestIdDocumentSignedUrl(
  guestId: string,
): Promise<GuestPrivacyResult & { url?: string }> {
  const profile = await getProfile()
  if (!profile?.hotel_id || !canStaffViewGuestIdDocument(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const supabase = await createClient()
  const { data: guest } = await supabase
    .from('guests')
    .select('pre_arrival_id_path, pre_arrival_id_mime, name, hotel_id')
    .eq('id', guestId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!guest?.pre_arrival_id_path) {
    return { success: false, error: 'No ID document on file for this guest.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(GUEST_ID_DOCUMENT_BUCKET)
    .createSignedUrl(guest.pre_arrival_id_path, 300)

  if (error || !data?.signedUrl) {
    return { success: false, error: 'Could not open ID document.' }
  }

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'guest',
    entityId: guestId,
    action: 'view_id_document',
    summary: `Viewed pre-arrival ID for ${guest.name}`,
  })

  return { success: true, url: data.signedUrl }
}
