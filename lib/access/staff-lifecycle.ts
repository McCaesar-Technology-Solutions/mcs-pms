import { createAdminClient } from '@/lib/supabase/admin'
import { employeeNoFromStaffKey } from '@/lib/access/crypto'
import { enqueueAccessJob, isAccessControlEnabled } from '@/lib/access/jobs'
import { resolvePolicyDoors } from '@/lib/access/policies'
import type { AccessStaffStatus, StaffPersonType } from '@/lib/access/types'

/**
 * Create or update a staff physical-access credential and enqueue provision.
 * Reuses revoked/existing rows by credentialId, profileId, or employee_no.
 */
export async function provisionStaffAccess(input: {
  hotelId: string
  displayName: string
  personType: StaffPersonType
  accessPolicyId: string
  profileId?: string | null
  validFrom: string
  validTo: string
  cardNo?: string | null
  existingCredentialId?: string | null
}): Promise<{ ok: true; credentialId: string } | { ok: false; error: string }> {
  try {
    if (!(await isAccessControlEnabled(input.hotelId))) {
      return { ok: false, error: 'Access control is not enabled.' }
    }

    if (input.validFrom > input.validTo) {
      return { ok: false, error: 'Valid from must be on or before valid to.' }
    }

    const admin = createAdminClient()
    const doors = await resolvePolicyDoors(admin, input.hotelId, input.accessPolicyId)
    if (!doors.length) {
      return {
        ok: false,
        error: 'This access policy has no doors mapped. Map doors to the policy first.',
      }
    }

    const now = new Date().toISOString()
    let credentialId = input.existingCredentialId ?? null
    let employeeNo: string | null = null

    if (!credentialId && input.profileId) {
      const { data: byProfile } = await admin
        .from('access_credentials')
        .select('id, employee_no, person_type')
        .eq('hotel_id', input.hotelId)
        .eq('profile_id', input.profileId)
        .neq('person_type', 'tenant')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (byProfile) {
        credentialId = byProfile.id
        employeeNo = byProfile.employee_no
      }
    }

    if (credentialId) {
      const { data: existing } = await admin
        .from('access_credentials')
        .select('id, employee_no, person_type')
        .eq('id', credentialId)
        .eq('hotel_id', input.hotelId)
        .maybeSingle()
      if (!existing || existing.person_type === 'tenant') {
        return { ok: false, error: 'Staff credential not found.' }
      }
      employeeNo = existing.employee_no
      await admin
        .from('access_credentials')
        .update({
          display_name: input.displayName,
          person_type: input.personType,
          profile_id: input.profileId ?? null,
          access_policy_id: input.accessPolicyId,
          card_no: input.cardNo ?? null,
          valid_from: input.validFrom,
          valid_to: input.validTo,
          staff_status: 'active',
          status: 'pending',
          sync_status: 'pending',
          last_error: null,
          updated_at: now,
        })
        .eq('id', credentialId)
    } else {
      const key = input.profileId || `${input.hotelId}:${input.displayName}:${Date.now()}`
      employeeNo = employeeNoFromStaffKey(key)
      const { data: created, error } = await admin
        .from('access_credentials')
        .insert({
          hotel_id: input.hotelId,
          guest_id: null,
          reservation_id: null,
          person_type: input.personType,
          profile_id: input.profileId ?? null,
          access_policy_id: input.accessPolicyId,
          staff_status: 'active',
          employee_no: employeeNo,
          display_name: input.displayName,
          card_no: input.cardNo ?? null,
          has_pin: false,
          valid_from: input.validFrom,
          valid_to: input.validTo,
          status: 'pending',
          sync_status: 'pending',
        })
        .select('id')
        .single()

      if (error || !created) {
        return { ok: false, error: error?.message ?? 'Could not create staff credential.' }
      }
      credentialId = created.id
    }

    const enqueued = await enqueueAccessJob({
      hotelId: input.hotelId,
      jobType: 'provision',
      credentialId,
      idempotencyKey: `staff-provision:${credentialId}:${input.accessPolicyId}:${input.validTo}:${now.slice(0, 13)}`,
      payload: {
        credentialId,
        employeeNo,
        displayName: input.displayName,
        cardNo: input.cardNo ?? null,
        doorPin: null,
        validFrom: input.validFrom,
        validTo: input.validTo,
        doors,
      },
    })

    if ('error' in enqueued) return { ok: false, error: enqueued.error }
    return { ok: true, credentialId: credentialId! }
  } catch (err) {
    console.error('[access] provisionStaffAccess failed:', err)
    return { ok: false, error: 'Staff provision failed.' }
  }
}

export async function setStaffAccessStatus(input: {
  hotelId: string
  credentialId: string
  staffStatus: AccessStaffStatus
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!(await isAccessControlEnabled(input.hotelId))) {
      return { ok: false, error: 'Access control is not enabled.' }
    }

    const admin = createAdminClient()
    const { data: cred } = await admin
      .from('access_credentials')
      .select(
        'id, employee_no, person_type, status, display_name, access_policy_id, profile_id, valid_from, valid_to, card_no',
      )
      .eq('id', input.credentialId)
      .eq('hotel_id', input.hotelId)
      .maybeSingle()

    if (!cred || cred.person_type === 'tenant') {
      return { ok: false, error: 'Staff credential not found.' }
    }

    const now = new Date().toISOString()
    const revoke =
      input.staffStatus === 'suspended' ||
      input.staffStatus === 'terminated' ||
      input.staffStatus === 'on_leave'

    if (!revoke && input.staffStatus === 'active') {
      if (!cred.access_policy_id) {
        return { ok: false, error: 'Staff credential has no access policy — cannot reactivate.' }
      }
      const result = await provisionStaffAccess({
        hotelId: input.hotelId,
        displayName: cred.display_name,
        personType: cred.person_type as StaffPersonType,
        accessPolicyId: cred.access_policy_id,
        profileId: cred.profile_id,
        validFrom: cred.valid_from,
        validTo: cred.valid_to,
        cardNo: cred.card_no,
        existingCredentialId: cred.id,
      })
      return result.ok ? { ok: true } : result
    }

    await admin
      .from('access_credentials')
      .update({
        staff_status: input.staffStatus,
        status: 'revoking',
        sync_status: 'pending',
        updated_at: now,
      })
      .eq('id', cred.id)

    await enqueueAccessJob({
      hotelId: input.hotelId,
      jobType: 'revoke',
      credentialId: cred.id,
      idempotencyKey: `staff-revoke:${cred.id}:${input.staffStatus}:${now}`,
      priority: 20,
      payload: {
        credentialId: cred.id,
        employeeNo: cred.employee_no,
      },
    })

    return { ok: true }
  } catch (err) {
    console.error('[access] setStaffAccessStatus failed:', err)
    return { ok: false, error: 'Could not update staff access status.' }
  }
}
