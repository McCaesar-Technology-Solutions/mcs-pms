'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVerifiedProfile } from '@/lib/auth/get-profile'
import { canEraseGuestData, canStaffExportGuestData } from '@/lib/auth/tenant-access'
import { writeAuditLog } from '@/lib/audit/log'
import { revokeGuestAccess } from '@/lib/access/lifecycle'
import { transitionReservation } from '@/lib/reservations/state-machine'
import { normalizeActorRole } from '@/lib/reservations/transitions'
import { IN_HOUSE_STATUSES } from '@/lib/reservations/lifecycle'

const GUEST_ID_DOCUMENT_BUCKET = 'guest-id-documents'

export type GuestPrivacyResult =
  | { success: true; data?: unknown }
  | { success: false; error: string }

export type GuestDeleteEligibility =
  | {
      success: true
      data: {
        guestName: string
        isInHouse: boolean
        canSoftErase: boolean
        canHardDelete: boolean
        blockReason: string | null
        historyCounts: {
          reservations: number
          invoices: number
          complaints: number
        }
      }
    }
  | { success: false; error: string }

function revalidateGuestViews() {
  revalidatePath('/owner/guests')
  revalidatePath('/manager/guests')
  revalidatePath('/receptionist/guests')
  revalidatePath('/owner/reservations')
  revalidatePath('/manager/reservations')
  revalidatePath('/receptionist/reservations')
}

async function countGuestLinks(
  admin: ReturnType<typeof createAdminClient>,
  hotelId: string,
  guestId: string,
) {
  const [reservations, invoices, complaints, requests, charges, feedback, credentials] =
    await Promise.all([
      admin
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('guest_id', guestId),
      admin
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('guest_id', guestId),
      admin
        .from('complaints')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('guest_id', guestId),
      admin
        .from('guest_requests')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('guest_id', guestId),
      admin
        .from('guest_charges')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('guest_id', guestId),
      admin
        .from('guest_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('guest_id', guestId),
      admin
        .from('access_credentials')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('guest_id', guestId),
    ])

  return {
    reservations: reservations.count ?? 0,
    invoices: invoices.count ?? 0,
    complaints: complaints.count ?? 0,
    requests: requests.count ?? 0,
    charges: charges.count ?? 0,
    feedback: feedback.count ?? 0,
    credentials: credentials.count ?? 0,
  }
}

async function guestHasActiveStay(
  admin: ReturnType<typeof createAdminClient>,
  hotelId: string,
  guestId: string,
): Promise<boolean> {
  const { count } = await admin
    .from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)
    .eq('guest_id', guestId)
    .in('status', [...IN_HOUSE_STATUSES])
  return (count ?? 0) > 0
}

/** End in-house stays so erase/delete frees the room (does not require prior checkout). */
async function releaseInHouseStaysForGuest(input: {
  admin: ReturnType<typeof createAdminClient>
  hotelId: string
  guestId: string
  actorId: string
  actorRole: string
  roomId: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { admin, hotelId, guestId, actorId, actorRole, roomId } = input
  const role = normalizeActorRole(actorRole)

  const { data: active } = await admin
    .from('reservations')
    .select('id, status')
    .eq('hotel_id', hotelId)
    .eq('guest_id', guestId)
    .in('status', [...IN_HOUSE_STATUSES])

  for (const row of active ?? []) {
    if (row.status === 'checkout_in_progress') {
      const done = await transitionReservation({
        reservationId: row.id,
        hotelId,
        toStatus: 'checked_out',
        actorId,
        actorRole: role,
        payload: { reason: 'guest_erase' },
      })
      if (!done.success) {
        return { ok: false, error: done.error ?? 'Could not end active stay.' }
      }
      continue
    }

    const started = await transitionReservation({
      reservationId: row.id,
      hotelId,
      toStatus: 'checkout_in_progress',
      actorId,
      actorRole: role,
      payload: { reason: 'guest_erase' },
    })
    if (!started.success) {
      const walkout = await transitionReservation({
        reservationId: row.id,
        hotelId,
        toStatus: 'walkout',
        actorId,
        actorRole: role,
        payload: { reason: 'guest_erase' },
      })
      if (!walkout.success) {
        return { ok: false, error: walkout.error ?? 'Could not end active stay.' }
      }
      continue
    }

    const done = await transitionReservation({
      reservationId: row.id,
      hotelId,
      toStatus: 'checked_out',
      actorId,
      actorRole: role,
      payload: { reason: 'guest_erase' },
    })
    if (!done.success) {
      return { ok: false, error: done.error ?? 'Could not complete checkout for erase.' }
    }
  }

  // Legacy guest row with a room but no reservation — free the room.
  if (roomId && !(active?.length)) {
    await admin
      .from('rooms')
      .update({ status: 'cleaning', updated_by: actorId })
      .eq('id', roomId)
      .eq('hotel_id', hotelId)
  }

  return { ok: true }
}

export async function getGuestDeleteEligibility(
  guestId: string,
): Promise<GuestDeleteEligibility> {
  const profile = await getVerifiedProfile()
  if (!profile?.hotel_id || !canEraseGuestData(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: guest } = await admin
    .from('guests')
    .select('id, name, room_id')
    .eq('id', guestId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!guest) return { success: false, error: 'Guest not found.' }

  const isInHouse = Boolean(guest.room_id) || (await guestHasActiveStay(admin, profile.hotel_id, guestId))
  const counts = await countGuestLinks(admin, profile.hotel_id, guestId)
  const hasHistory =
    counts.reservations > 0 ||
    counts.invoices > 0 ||
    counts.complaints > 0 ||
    counts.requests > 0 ||
    counts.charges > 0 ||
    counts.feedback > 0

  return {
    success: true,
    data: {
      guestName: guest.name,
      isInHouse,
      canSoftErase: true,
      canHardDelete: !hasHistory,
      blockReason: isInHouse
        ? 'This guest is still in-house. Erasing will end their stay and free the room.'
        : null,
      historyCounts: {
        reservations: counts.reservations,
        invoices: counts.invoices,
        complaints: counts.complaints,
      },
    },
  }
}

export async function exportGuestData(guestId: string): Promise<GuestPrivacyResult> {
  const profile = await getVerifiedProfile()
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
  const profile = await getVerifiedProfile()
  if (!profile?.hotel_id || !canEraseGuestData(profile.role)) {
    return {
      success: false,
      error: 'Not authorized to erase guest data.',
    }
  }

  const admin = createAdminClient()
  const { data: guest } = await admin
    .from('guests')
    .select(
      'id, name, hotel_id, room_id, pre_arrival_id_path, guest_photo_path, profile_image_path',
    )
    .eq('id', guestId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!guest) return { success: false, error: 'Guest not found.' }

  const released = await releaseInHouseStaysForGuest({
    admin,
    hotelId: profile.hotel_id,
    guestId,
    actorId: profile.id,
    actorRole: profile.role,
    roomId: guest.room_id,
  })
  if (!released.ok) return { success: false, error: released.error }

  if (guest.pre_arrival_id_path) {
    await admin.storage.from(GUEST_ID_DOCUMENT_BUCKET).remove([guest.pre_arrival_id_path])
  }

  void revokeGuestAccess({
    hotelId: profile.hotel_id,
    guestId,
  })

  const { error } = await admin
    .from('guests')
    .update({
      name: 'Redacted guest',
      email: null,
      phone: null,
      ghana_card_number: null,
      id_document_type: null,
      id_document_number: null,
      id_document_country: null,
      pre_arrival_notes: null,
      pre_arrival_eta: null,
      pre_arrival_id_path: null,
      pre_arrival_id_mime: null,
      guest_photo_path: null,
      guest_photo_mime: null,
      profile_image_path: null,
      portal_pin: null,
      portal_pin_hash: null,
      room_id: null,
      check_in: null,
      check_out: null,
      token: randomUUID(),
      token_expires_at: new Date().toISOString(),
      do_not_disturb: false,
    })
    .eq('id', guestId)
    .eq('hotel_id', profile.hotel_id)

  if (error) return { success: false, error: error.message }

  await admin
    .from('reservations')
    .update({ guest_name: 'Redacted guest' })
    .eq('hotel_id', profile.hotel_id)
    .eq('guest_id', guestId)

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'guest',
    entityId: guestId,
    action: 'erase',
    summary: `Erased personal data for guest ${guest.name}`,
  })

  revalidateGuestViews()
  return { success: true }
}

/**
 * Permanently delete a guest row only when there is no stay/invoice/complaint history.
 * Prefer eraseGuestPersonalData when any ledger links exist.
 */
export async function hardDeleteGuest(guestId: string): Promise<GuestPrivacyResult> {
  const profile = await getVerifiedProfile()
  if (!profile?.hotel_id || !canEraseGuestData(profile.role)) {
    return {
      success: false,
      error: 'Not authorized to delete guests.',
    }
  }

  const admin = createAdminClient()
  const { data: guest } = await admin
    .from('guests')
    .select('id, name, room_id, pre_arrival_id_path, guest_photo_path, profile_image_path')
    .eq('id', guestId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!guest) return { success: false, error: 'Guest not found.' }

  const counts = await countGuestLinks(admin, profile.hotel_id, guestId)
  const hasHistory =
    counts.reservations > 0 ||
    counts.invoices > 0 ||
    counts.complaints > 0 ||
    counts.requests > 0 ||
    counts.charges > 0 ||
    counts.feedback > 0

  if (hasHistory) {
    return {
      success: false,
      error:
        'This guest has stay or billing history. Use Erase personal data instead — invoices stay printable.',
    }
  }

  const released = await releaseInHouseStaysForGuest({
    admin,
    hotelId: profile.hotel_id,
    guestId,
    actorId: profile.id,
    actorRole: profile.role,
    roomId: guest.room_id,
  })
  if (!released.ok) return { success: false, error: released.error }

  if (guest.pre_arrival_id_path) {
    await admin.storage.from(GUEST_ID_DOCUMENT_BUCKET).remove([guest.pre_arrival_id_path])
  }

  void revokeGuestAccess({
    hotelId: profile.hotel_id,
    guestId,
  })

  const { error } = await admin
    .from('guests')
    .delete()
    .eq('id', guestId)
    .eq('hotel_id', profile.hotel_id)

  if (error) return { success: false, error: error.message }

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'guest',
    entityId: guestId,
    action: 'deleted',
    summary: `Hard-deleted orphan guest ${guest.name}`,
  })

  revalidateGuestViews()
  return { success: true }
}
