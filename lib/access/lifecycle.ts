import { createAdminClient } from '@/lib/supabase/admin'
import { employeeNoFromGuestId, encryptAccessSecret } from '@/lib/access/crypto'
import { enqueueAccessJob, isAccessControlEnabled } from '@/lib/access/jobs'
import type { AccessDoorTarget, AccessZone } from '@/lib/access/types'

type Admin = ReturnType<typeof createAdminClient>

async function resolveDoorsForRoom(
  admin: Admin,
  hotelId: string,
  roomId: string | null,
): Promise<AccessDoorTarget[]> {
  const { data: points } = await admin
    .from('access_points')
    .select('device_key, door_no, label, zone, room_id, grants_shared_access')
    .eq('hotel_id', hotelId)
    .eq('is_active', true)

  if (!points?.length) return []

  const doors: AccessDoorTarget[] = []
  for (const p of points) {
    const shared = p.grants_shared_access || p.zone !== 'unit'
    const unitMatch = roomId && p.room_id === roomId
    if (!shared && !unitMatch) continue
    doors.push({
      deviceKey: p.device_key,
      doorNo: p.door_no,
      label: p.label,
      zone: p.zone as AccessZone,
    })
  }
  return doors
}

/**
 * Enqueue Hikvision provision after successful check-in.
 * Never throws — access failures must not block hospitality checkout path.
 */
export async function provisionGuestAccess(input: {
  hotelId: string
  guestId: string
  reservationId: string
  roomId: string
  guestName: string
  checkIn: string
  checkOut: string
  doorPin?: string | null
  cardNo?: string | null
}): Promise<void> {
  try {
    if (!(await isAccessControlEnabled(input.hotelId))) return

    const admin = createAdminClient()
    const doors = await resolveDoorsForRoom(admin, input.hotelId, input.roomId)
    if (!doors.length) {
      console.warn('[access] enabled but no access_points mapped — skipping provision')
      return
    }

    const employeeNo = employeeNoFromGuestId(input.guestId)
    const now = new Date().toISOString()

    const { data: existing } = await admin
      .from('access_credentials')
      .select('id, status')
      .eq('hotel_id', input.hotelId)
      .eq('guest_id', input.guestId)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let credentialId = existing?.id ?? null

    if (credentialId) {
      await admin
        .from('access_credentials')
        .update({
          reservation_id: input.reservationId,
          display_name: input.guestName,
          card_no: input.cardNo ?? null,
          has_pin: Boolean(input.doorPin),
          valid_from: input.checkIn,
          valid_to: input.checkOut,
          status: 'pending',
          sync_status: 'pending',
          last_error: null,
          updated_at: now,
        })
        .eq('id', credentialId)
    } else {
      const { data: created, error } = await admin
        .from('access_credentials')
        .insert({
          hotel_id: input.hotelId,
          guest_id: input.guestId,
          reservation_id: input.reservationId,
          employee_no: employeeNo,
          display_name: input.guestName,
          card_no: input.cardNo ?? null,
          has_pin: Boolean(input.doorPin),
          valid_from: input.checkIn,
          valid_to: input.checkOut,
          status: 'pending',
          sync_status: 'pending',
        })
        .select('id')
        .single()

      if (error || !created) {
        console.error('[access] credential insert failed:', error?.message)
        return
      }
      credentialId = created.id
    }

    const encryptedPin = input.doorPin ? await encryptAccessSecret(input.doorPin) : null

    await enqueueAccessJob({
      hotelId: input.hotelId,
      jobType: 'provision',
      credentialId,
      idempotencyKey: `provision:${input.reservationId}:${credentialId}`,
      payload: {
        credentialId,
        employeeNo,
        displayName: input.guestName,
        cardNo: input.cardNo ?? null,
        doorPin: encryptedPin,
        validFrom: input.checkIn,
        validTo: input.checkOut,
        doors,
      },
    })
  } catch (err) {
    console.error('[access] provisionGuestAccess failed:', err)
  }
}

export async function revokeGuestAccess(input: {
  hotelId: string
  guestId: string
  reservationId?: string | null
}): Promise<void> {
  try {
    if (!(await isAccessControlEnabled(input.hotelId))) return

    const admin = createAdminClient()
    let query = admin
      .from('access_credentials')
      .select('id, employee_no, status')
      .eq('hotel_id', input.hotelId)
      .eq('guest_id', input.guestId)
      .in('status', ['pending', 'active', 'error', 'revoking'])

    if (input.reservationId) {
      query = query.eq('reservation_id', input.reservationId)
    }

    const { data: creds } = await query
    if (!creds?.length) return

    const now = new Date().toISOString()
    for (const cred of creds) {
      await admin
        .from('access_credentials')
        .update({ status: 'revoking', sync_status: 'pending', updated_at: now })
        .eq('id', cred.id)

      await enqueueAccessJob({
        hotelId: input.hotelId,
        jobType: 'revoke',
        credentialId: cred.id,
        idempotencyKey: `revoke:${cred.id}:${input.reservationId ?? 'guest'}`,
        priority: 20,
        payload: {
          credentialId: cred.id,
          employeeNo: cred.employee_no,
        },
      })
    }
  } catch (err) {
    console.error('[access] revokeGuestAccess failed:', err)
  }
}

export async function updateGuestAccessValidity(input: {
  hotelId: string
  guestId: string
  reservationId: string
  checkIn: string
  checkOut: string
}): Promise<void> {
  try {
    if (!(await isAccessControlEnabled(input.hotelId))) return

    const admin = createAdminClient()
    const { data: cred } = await admin
      .from('access_credentials')
      .select('id, employee_no')
      .eq('hotel_id', input.hotelId)
      .eq('guest_id', input.guestId)
      .eq('reservation_id', input.reservationId)
      .in('status', ['pending', 'active', 'error'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!cred) {
      // No credential yet — nothing to extend
      return
    }

    const now = new Date().toISOString()
    await admin
      .from('access_credentials')
      .update({
        valid_from: input.checkIn,
        valid_to: input.checkOut,
        sync_status: 'pending',
        updated_at: now,
      })
      .eq('id', cred.id)

    await enqueueAccessJob({
      hotelId: input.hotelId,
      jobType: 'update_validity',
      credentialId: cred.id,
      idempotencyKey: `validity:${cred.id}:${input.checkOut}`,
      payload: {
        credentialId: cred.id,
        employeeNo: cred.employee_no,
        validFrom: input.checkIn,
        validTo: input.checkOut,
      },
    })
  } catch (err) {
    console.error('[access] updateGuestAccessValidity failed:', err)
  }
}

export async function rematerializeGuestAccessForRoomMove(input: {
  hotelId: string
  guestId: string
  reservationId: string
  guestName: string
  newRoomId: string
  checkIn: string
  checkOut: string
  doorPin?: string | null
}): Promise<void> {
  try {
    if (!(await isAccessControlEnabled(input.hotelId))) return

    // Re-provision with new door set (agent upserts person + door rights).
    await provisionGuestAccess({
      hotelId: input.hotelId,
      guestId: input.guestId,
      reservationId: input.reservationId,
      roomId: input.newRoomId,
      guestName: input.guestName,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      doorPin: input.doorPin,
    })
  } catch (err) {
    console.error('[access] rematerializeGuestAccessForRoomMove failed:', err)
  }
}
