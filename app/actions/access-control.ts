'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireVerifiedStaff, consumeStaffAuthError } from '@/lib/auth/staff-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { ownerOwnsHotel } from '@/lib/data/properties'
import { encryptAccessSecret, generateAgentToken } from '@/lib/access/crypto'
import {
  cancelAccessJob,
  cancelOpenAccessJobs,
  clearAccessJobs,
  enqueueAccessJob,
} from '@/lib/access/jobs'
import { provisionGuestAccess } from '@/lib/access/lifecycle'
import { provisionStaffAccess, setStaffAccessStatus } from '@/lib/access/staff-lifecycle'
import {
  ensureDefaultAccessPolicies,
  MANAGER_CREATABLE_STAFF_TYPES,
  resolvePolicyDoors,
} from '@/lib/access/policies'
import { receptionMayUnlockZone, resolveGuestDoors } from '@/lib/access/doors'
import { receptionMayCancelJob } from '@/lib/access/reception-scope'
import { writeAuditLog } from '@/lib/audit/log'
import { getAppOrigin } from '@/lib/env'
import type {
  AccessStaffStatus,
  AccessZone,
  DeviceCredentialMode,
  StaffPersonType,
} from '@/lib/access/types'

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string }

function revalidateAccess() {
  revalidatePath('/owner/access')
  revalidatePath('/manager/access')
  revalidatePath('/receptionist/access')
  revalidatePath('/owner/settings')
}

async function requireOwnerHotel(hotelId: string) {
  const result = await requireVerifiedStaff({ roles: ['owner'] })
  if (!result.ok) return { ok: false as const, error: consumeStaffAuthError(result.error) }
  if (!(await ownerOwnsHotel(result.userId, hotelId))) {
    return { ok: false as const, error: 'Not authorized for this property.' }
  }
  return { ok: true as const, userId: result.userId, profile: result.profile }
}

async function requireAccessOps(hotelId: string) {
  const result = await requireVerifiedStaff({ roles: ['owner', 'manager', 'receptionist'] })
  if (!result.ok) return { ok: false as const, error: consumeStaffAuthError(result.error) }

  if (result.profile.role === 'owner') {
    if (!(await ownerOwnsHotel(result.userId, hotelId))) {
      return { ok: false as const, error: 'Not authorized for this property.' }
    }
    return { ok: true as const, userId: result.userId, profile: result.profile }
  }

  if (result.profile.hotel_id !== hotelId) {
    return { ok: false as const, error: 'Not authorized for this property.' }
  }
  return { ok: true as const, userId: result.userId, profile: result.profile }
}

async function requireAccessEditor(hotelId: string) {
  const result = await requireVerifiedStaff({ roles: ['owner', 'manager'] })
  if (!result.ok) return { ok: false as const, error: consumeStaffAuthError(result.error) }

  if (result.profile.role === 'owner') {
    if (!(await ownerOwnsHotel(result.userId, hotelId))) {
      return { ok: false as const, error: 'Not authorized for this property.' }
    }
    return { ok: true as const, userId: result.userId, profile: result.profile }
  }

  if (result.profile.hotel_id !== hotelId) {
    return { ok: false as const, error: 'Not authorized for this property.' }
  }
  return { ok: true as const, userId: result.userId, profile: result.profile }
}

/** One-click: enable sync + issue agent token + return a ready `.env` draft. */
export async function startAccessSetup(hotelId: string): Promise<
  ActionResult<{ token: string; prefix: string; envFile: string; hotelId: string; appUrl: string }>
> {
  const auth = await requireOwnerHotel(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const enabled = await setAccessControlEnabled({ hotelId, enabled: true })
  if (!enabled.success) return enabled

  const modeSet = await setDeviceCredentialMode({ hotelId, mode: 'cloud' })
  if (!modeSet.success) return modeSet

  const rotated = await rotateAccessAgentToken(hotelId)
  if (!rotated.success || !rotated.data) {
    return { success: false, error: rotated.success ? 'No token returned.' : rotated.error }
  }

  await ensureDefaultAccessPolicies(hotelId)

  let appUrl = 'https://portal.mojoapartmentsgh.com'
  try {
    appUrl = getAppOrigin()
  } catch {
    // keep production portal default if NEXT_PUBLIC_APP_URL unset
  }

  const { data: modeRow } = await createAdminClient()
    .from('access_integrations')
    .select('device_credential_mode')
    .eq('hotel_id', hotelId)
    .maybeSingle()

  const cloudMode = modeRow?.device_credential_mode === 'cloud'

  const envFile = cloudMode
    ? [
        `# MOJO Hikvision agent — cloud credential mode`,
        `# Controller passwords are stored in MOJO (Owner → Access). No DEVICES needed.`,
        `MOJO_API_URL=${appUrl}`,
        `HOTEL_ID=${hotelId}`,
        `AGENT_TOKEN=${rotated.data.token}`,
        `AGENT_ID=mojo-apartment-pc`,
        `DEVICE_SOURCE=cloud`,
        '',
      ].join('\n')
    : [
        `# MOJO Hikvision agent — local credential mode`,
        `MOJO_API_URL=${appUrl}`,
        `HOTEL_ID=${hotelId}`,
        `AGENT_TOKEN=${rotated.data.token}`,
        `AGENT_ID=mojo-apartment-pc`,
        `DEVICE_SOURCE=local`,
        '',
        `# Edit host / password for your controller. key must match door mappings in MOJO.`,
        `DEVICES=[{"key":"lobby","host":"192.168.1.64","port":80,"username":"admin","password":"CHANGE_ME","useHttps":false}]`,
        '',
      ].join('\n')

  return {
    success: true,
    data: {
      token: rotated.data.token,
      prefix: rotated.data.prefix,
      envFile,
      hotelId,
      appUrl,
    },
  }
}

export async function setAccessControlEnabled(input: {
  hotelId: string
  enabled: boolean
}): Promise<ActionResult> {
  const auth = await requireOwnerHotel(input.hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  await admin
    .from('hotels')
    .update({ access_control_enabled: input.enabled })
    .eq('id', input.hotelId)

  const { data: existing } = await admin
    .from('access_integrations')
    .select('id')
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (existing) {
    await admin
      .from('access_integrations')
      .update({ enabled: input.enabled, updated_at: now })
      .eq('id', existing.id)
  } else {
    await admin.from('access_integrations').insert({
      hotel_id: input.hotelId,
      enabled: input.enabled,
      provider: 'hikvision',
    })
  }

  void writeAuditLog({
    hotelId: input.hotelId,
    actorId: auth.userId,
    actorName: auth.profile.name,
    entityType: 'access',
    entityId: input.hotelId,
    action: input.enabled ? 'enabled' : 'disabled',
    summary: `Hikvision access control ${input.enabled ? 'enabled' : 'disabled'}`,
  })

  revalidateAccess()
  return { success: true }
}

export async function rotateAccessAgentToken(
  hotelId: string,
): Promise<ActionResult<{ token: string; prefix: string }>> {
  const auth = await requireOwnerHotel(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const { token, prefix, hash } = generateAgentToken()
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: existing } = await admin
    .from('access_integrations')
    .select('id')
    .eq('hotel_id', hotelId)
    .maybeSingle()

  if (existing) {
    await admin
      .from('access_integrations')
      .update({
        agent_token_hash: hash,
        agent_token_prefix: prefix,
        updated_at: now,
      })
      .eq('id', existing.id)
  } else {
    await admin.from('access_integrations').insert({
      hotel_id: hotelId,
      enabled: false,
      provider: 'hikvision',
      agent_token_hash: hash,
      agent_token_prefix: prefix,
    })
  }

  void writeAuditLog({
    hotelId,
    actorId: auth.userId,
    actorName: auth.profile.name,
    entityType: 'access',
    entityId: hotelId,
    action: 'agent_token_rotated',
    summary: `Access agent token rotated (${prefix}…)`,
  })

  revalidateAccess()
  return { success: true, data: { token, prefix } }
}

const pointSchema = z.object({
  hotelId: z.string().uuid(),
  deviceKey: z.string().min(1).max(64),
  doorNo: z.number().int().min(1).max(64),
  label: z.string().min(1).max(120),
  zone: z.enum(['unit', 'lobby', 'gate', 'elevator', 'gym', 'other']),
  roomId: z.string().uuid().nullable().optional(),
  grantsSharedAccess: z.boolean(),
  isActive: z.boolean().optional(),
  id: z.string().uuid().optional(),
})

export async function upsertAccessPoint(
  input: z.infer<typeof pointSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = pointSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid door mapping.' }
  }

  const auth = await requireAccessEditor(parsed.data.hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  if (parsed.data.zone === 'unit' && !parsed.data.roomId) {
    return { success: false, error: 'Unit doors must be mapped to a room.' }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const zone = parsed.data.zone as AccessZone
  const sharedDefault = zone === 'lobby' || zone === 'gate' || zone === 'elevator'
  const row = {
    hotel_id: parsed.data.hotelId,
    device_key: parsed.data.deviceKey.trim(),
    door_no: parsed.data.doorNo,
    label: parsed.data.label.trim(),
    zone,
    room_id: zone === 'unit' ? (parsed.data.roomId ?? null) : null,
    grants_shared_access:
      zone === 'unit' || zone === 'gym' ? false : (parsed.data.grantsSharedAccess ?? sharedDefault),
    is_active: parsed.data.isActive ?? true,
    updated_at: now,
  }

  if (parsed.data.id) {
    const { error } = await admin
      .from('access_points')
      .update(row)
      .eq('id', parsed.data.id)
      .eq('hotel_id', parsed.data.hotelId)
    if (error) return { success: false, error: error.message }
    revalidateAccess()
    return { success: true, data: { id: parsed.data.id } }
  }

  const { data, error } = await admin.from('access_points').insert(row).select('id').single()
  if (error || !data) return { success: false, error: error?.message ?? 'Could not save door.' }
  revalidateAccess()
  return { success: true, data: { id: data.id } }
}

export async function deleteAccessPoint(hotelId: string, pointId: string): Promise<ActionResult> {
  const auth = await requireAccessEditor(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('access_points')
    .delete()
    .eq('id', pointId)
    .eq('hotel_id', hotelId)
  if (error) return { success: false, error: error.message }
  revalidateAccess()
  return { success: true }
}

async function resolveCredentialDoors(
  admin: ReturnType<typeof createAdminClient>,
  hotelId: string,
  cred: {
    guest_id: string | null
    person_type?: string | null
    access_policy_id?: string | null
  },
) {
  if (cred.person_type && cred.person_type !== 'tenant' && cred.access_policy_id) {
    return resolvePolicyDoors(admin, hotelId, cred.access_policy_id)
  }

  let guestRoomId: string | null = null
  if (cred.guest_id) {
    const { data: guest } = await admin
      .from('guests')
      .select('room_id')
      .eq('id', cred.guest_id)
      .maybeSingle()
    guestRoomId = guest?.room_id ?? null
  }

  const { data: points } = await admin
    .from('access_points')
    .select('device_key, door_no, label, zone, room_id, grants_shared_access, is_active')
    .eq('hotel_id', hotelId)
    .eq('is_active', true)

  return resolveGuestDoors(points ?? [], guestRoomId)
}

function assertOpsMayTouchCredential(
  role: string,
  personType: string | null | undefined,
): string | null {
  if (role === 'receptionist' && personType && personType !== 'tenant') {
    return 'Reception can only manage tenant (guest) access.'
  }
  return null
}

async function resolveEnrollmentStation(
  admin: ReturnType<typeof createAdminClient>,
  hotelId: string,
) {
  const { data } = await admin
    .from('access_devices')
    .select('device_key, label, managed_in_cloud')
    .eq('hotel_id', hotelId)
    .eq('device_role', 'enrollment')
    .eq('managed_in_cloud', true)
    .order('label', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data
}

export async function cancelAccessJobAction(input: {
  hotelId: string
  jobId: string
}): Promise<ActionResult> {
  const auth = await requireAccessOps(input.hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  if (auth.profile.role === 'receptionist') {
    const admin = createAdminClient()
    const { data: job } = await admin
      .from('access_jobs')
      .select('id, job_type, credential_id')
      .eq('id', input.jobId)
      .eq('hotel_id', input.hotelId)
      .maybeSingle()

    if (!job) return { success: false, error: 'Job not found.' }

    let personType: string | null = null
    if (job.credential_id) {
      const { data: cred } = await admin
        .from('access_credentials')
        .select('person_type')
        .eq('id', job.credential_id)
        .eq('hotel_id', input.hotelId)
        .maybeSingle()
      personType = (cred as { person_type?: string } | null)?.person_type ?? null
    }

    if (
      !receptionMayCancelJob({
        jobType: job.job_type,
        credentialId: job.credential_id,
        personType,
      })
    ) {
      return {
        success: false,
        error: 'Reception can only cancel guest unlock or guest credential jobs.',
      }
    }
  }

  const result = await cancelAccessJob({ hotelId: input.hotelId, jobId: input.jobId })
  if ('error' in result) return { success: false, error: result.error }
  revalidateAccess()
  return { success: true }
}

export async function cancelOpenAccessJobsAction(hotelId: string): Promise<ActionResult<{ count: number }>> {
  const auth = await requireAccessEditor(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const result = await cancelOpenAccessJobs({ hotelId })
  if ('error' in result) return { success: false, error: result.error }
  revalidateAccess()
  return { success: true, data: { count: result.count } }
}

export async function clearAccessJobsAction(hotelId: string): Promise<ActionResult<{ count: number }>> {
  const auth = await requireAccessEditor(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const result = await clearAccessJobs({ hotelId })
  if ('error' in result) return { success: false, error: result.error }
  revalidateAccess()
  return { success: true, data: { count: result.count } }
}

export async function startEnrollmentCapture(input: {
  hotelId: string
  credentialId: string
  capture: 'card' | 'face' | 'fingerprint'
}): Promise<ActionResult> {
  const auth = await requireAccessOps(input.hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data: cred } = await admin
    .from('access_credentials')
    .select('*')
    .eq('id', input.credentialId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!cred) return { success: false, error: 'Credential not found.' }

  const scopeErr = assertOpsMayTouchCredential(
    auth.profile.role,
    (cred as { person_type?: string }).person_type,
  )
  if (scopeErr) return { success: false, error: scopeErr }

  const station = await resolveEnrollmentStation(admin, input.hotelId)
  if (!station) {
    return {
      success: false,
      error:
        'No enrollment station saved. Owner → Access → add DS-K1F600U-D6E-F (role: Enrollment station).',
    }
  }

  const doors = await resolveCredentialDoors(admin, input.hotelId, cred)
  if (!doors.length) {
    return {
      success: false,
      error:
        'No doors mapped for this person. Map unit/shared/gym doors (guests) or staff policy doors first.',
    }
  }

  const jobType =
    input.capture === 'card'
      ? 'enroll_card_capture'
      : input.capture === 'face'
        ? 'enroll_face_capture'
        : 'enroll_fingerprint_capture'

  const now = new Date().toISOString()
  await admin
    .from('access_credentials')
    .update({ sync_status: 'pending', last_error: null, updated_at: now })
    .eq('id', cred.id)

  const enqueued = await enqueueAccessJob({
    hotelId: input.hotelId,
    jobType,
    credentialId: cred.id,
    priority: 15,
    idempotencyKey: `enroll:${input.capture}:${cred.id}:${Date.now()}`,
    payload: {
      credentialId: cred.id,
      employeeNo: cred.employee_no,
      displayName: cred.display_name,
      validFrom: cred.valid_from,
      validTo: cred.valid_to,
      deviceKey: station.device_key,
      timeoutMs: 90_000,
      doors,
    },
  })

  if ('error' in enqueued) return { success: false, error: enqueued.error }
  if ('skipped' in enqueued) {
    return { success: false, error: 'Access control is not enabled.' }
  }

  void writeAuditLog({
    hotelId: input.hotelId,
    actorId: auth.userId,
    actorName: auth.profile.name,
    entityType: 'access',
    entityId: cred.id,
    action: 'credential_enroll',
    summary: `Enrollment started (${input.capture}) — ${cred.display_name}`,
  })

  revalidateAccess()
  return { success: true }
}

export async function assignAccessCard(input: {
  hotelId: string
  credentialId: string
  cardNo: string
}): Promise<ActionResult> {
  const auth = await requireAccessOps(input.hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const cardNo = input.cardNo.trim()
  if (!cardNo || cardNo.length > 32) {
    return { success: false, error: 'Enter a valid card number.' }
  }

  const admin = createAdminClient()
  const { data: cred } = await admin
    .from('access_credentials')
    .select('*')
    .eq('id', input.credentialId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!cred) return { success: false, error: 'Credential not found.' }

  const scopeErr = assertOpsMayTouchCredential(
    auth.profile.role,
    (cred as { person_type?: string }).person_type,
  )
  if (scopeErr) return { success: false, error: scopeErr }

  const doors = await resolveCredentialDoors(admin, input.hotelId, {
    guest_id: cred.guest_id,
    person_type: (cred as { person_type?: string }).person_type,
    access_policy_id: (cred as { access_policy_id?: string | null }).access_policy_id,
  })
  if (!doors.length) {
    return {
      success: false,
      error:
        'No doors mapped for this person. Map unit/shared/gym doors (guests) or staff policy doors first.',
    }
  }

  const now = new Date().toISOString()
  await admin
    .from('access_credentials')
    .update({
      card_no: cardNo,
      sync_status: 'pending',
      updated_at: now,
    })
    .eq('id', cred.id)

  const enqueued = await enqueueAccessJob({
    hotelId: input.hotelId,
    jobType: 'assign_card',
    credentialId: cred.id,
    idempotencyKey: `card:${cred.id}:${cardNo}`,
    payload: {
      credentialId: cred.id,
      employeeNo: cred.employee_no,
      cardNo,
      doors,
    },
  })

  if ('error' in enqueued) return { success: false, error: enqueued.error }
  if ('skipped' in enqueued) {
    return { success: false, error: 'Access control is not enabled.' }
  }

  void writeAuditLog({
    hotelId: input.hotelId,
    actorId: auth.userId,
    actorName: auth.profile.name,
    entityType: 'access',
    entityId: cred.id,
    action: 'credential_card_assigned',
    summary: `Card assigned — ${cred.display_name}`,
  })

  revalidateAccess()
  return { success: true }
}

export async function remoteUnlockDoor(input: {
  hotelId: string
  accessPointId: string
  reason?: string
}): Promise<ActionResult> {
  const auth = await requireAccessOps(input.hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data: point } = await admin
    .from('access_points')
    .select('*')
    .eq('id', input.accessPointId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!point || !point.is_active) {
    return { success: false, error: 'Door not found or inactive.' }
  }

  if (auth.profile.role === 'receptionist' && !receptionMayUnlockZone(point.zone)) {
    return {
      success: false,
      error: 'Reception can only unlock guest-facing doors (room, lobby, gate, gym).',
    }
  }

  const enqueued = await enqueueAccessJob({
    hotelId: input.hotelId,
    jobType: 'unlock',
    priority: 5,
    payload: {
      deviceKey: point.device_key,
      doorNo: point.door_no,
      label: point.label,
      reason: input.reason?.trim() || 'Remote unlock from MOJO',
      requestedByProfileId: auth.userId,
    },
  })

  if ('error' in enqueued) return { success: false, error: enqueued.error }
  if ('skipped' in enqueued) {
    return { success: false, error: 'Access control is not enabled.' }
  }

  void writeAuditLog({
    hotelId: input.hotelId,
    actorId: auth.userId,
    actorName: auth.profile.name,
    entityType: 'access',
    entityId: point.id,
    action: 'remote_unlock',
    summary: `Remote unlock requested — ${point.label}`,
  })

  revalidateAccess()
  return { success: true }
}

export async function retryAccessCredential(
  hotelId: string,
  credentialId: string,
): Promise<ActionResult> {
  const auth = await requireAccessOps(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data: cred } = await admin
    .from('access_credentials')
    .select('*')
    .eq('id', credentialId)
    .eq('hotel_id', hotelId)
    .maybeSingle()

  if (!cred) {
    return { success: false, error: 'Credential not found.' }
  }

  const personType = (cred as { person_type?: string }).person_type ?? 'tenant'
  const scopeErr = assertOpsMayTouchCredential(auth.profile.role, personType)
  if (scopeErr) return { success: false, error: scopeErr }

  if (personType !== 'tenant' || !cred.guest_id || !cred.reservation_id) {
    const policyId = (cred as { access_policy_id?: string | null }).access_policy_id
    if (!policyId) return { success: false, error: 'Staff credential has no access policy.' }
    const result = await provisionStaffAccess({
      hotelId,
      displayName: cred.display_name,
      personType: personType as StaffPersonType,
      accessPolicyId: policyId,
      profileId: (cred as { profile_id?: string | null }).profile_id ?? null,
      validFrom: cred.valid_from,
      validTo: cred.valid_to,
      cardNo: cred.card_no,
      existingCredentialId: cred.id,
    })
    if (!result.ok) return { success: false, error: result.error }
    revalidateAccess()
    return { success: true }
  }

  const { data: guest } = await admin
    .from('guests')
    .select('room_id, name')
    .eq('id', cred.guest_id)
    .maybeSingle()

  if (!guest?.room_id) {
    return { success: false, error: 'Guest has no room — cannot re-provision.' }
  }

  await provisionGuestAccess({
    hotelId,
    guestId: cred.guest_id,
    reservationId: cred.reservation_id,
    roomId: guest.room_id,
    guestName: guest.name || cred.display_name,
    checkIn: cred.valid_from,
    checkOut: cred.valid_to,
    cardNo: cred.card_no,
  })

  void writeAuditLog({
    hotelId,
    actorId: auth.userId,
    actorName: auth.profile.name,
    entityType: 'access',
    entityId: cred.id,
    action: 'credential_retry',
    summary: `Access re-provision queued — ${cred.display_name}`,
  })

  revalidateAccess()
  return { success: true }
}

export async function setDeviceCredentialMode(input: {
  hotelId: string
  mode: DeviceCredentialMode
}): Promise<ActionResult> {
  const auth = await requireOwnerHotel(input.hotelId)
  if (!auth.ok) return { success: false, error: auth.error }
  if (input.mode !== 'local' && input.mode !== 'cloud') {
    return { success: false, error: 'Invalid credential mode.' }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data: existing } = await admin
    .from('access_integrations')
    .select('id')
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (existing) {
    await admin
      .from('access_integrations')
      .update({ device_credential_mode: input.mode, updated_at: now })
      .eq('id', existing.id)
  } else {
    await admin.from('access_integrations').insert({
      hotel_id: input.hotelId,
      enabled: false,
      provider: 'hikvision',
      device_credential_mode: input.mode,
    })
  }

  void writeAuditLog({
    hotelId: input.hotelId,
    actorId: auth.userId,
    actorName: auth.profile.name,
    entityType: 'access',
    entityId: input.hotelId,
    action: 'device_credential_mode',
    summary: `Device credential mode set to ${input.mode}`,
  })

  revalidateAccess()
  return { success: true }
}

const cloudDeviceSchema = z.object({
  hotelId: z.string().uuid(),
  deviceKey: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).default(80),
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(200).optional(),
  useHttps: z.boolean().default(false),
  deviceRole: z.enum(['door', 'enrollment', 'attendance']).default('door'),
  model: z.string().max(120).optional(),
  id: z.string().uuid().optional(),
})

export async function upsertCloudAccessDevice(
  input: z.infer<typeof cloudDeviceSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = cloudDeviceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid device.' }
  }

  const auth = await requireOwnerHotel(parsed.data.hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const key = parsed.data.deviceKey.trim()
  const role = parsed.data.deviceRole
  const model =
    parsed.data.model?.trim() ||
    (role === 'enrollment'
      ? 'DS-K1F600U-D6E-F'
      : role === 'attendance'
        ? 'DS-K1A8503MF-B'
        : null)

  let deviceId = parsed.data.id ?? null

  if (deviceId) {
    const { error } = await admin
      .from('access_devices')
      .update({
        device_key: key,
        label: parsed.data.label.trim(),
        host: parsed.data.host.trim(),
        port: parsed.data.port,
        username: parsed.data.username.trim(),
        use_https: parsed.data.useHttps,
        managed_in_cloud: true,
        device_role: role,
        model,
        updated_at: now,
      })
      .eq('id', deviceId)
      .eq('hotel_id', parsed.data.hotelId)
    if (error) return { success: false, error: error.message }
  } else {
    const { data, error } = await admin
      .from('access_devices')
      .upsert(
        {
          hotel_id: parsed.data.hotelId,
          device_key: key,
          label: parsed.data.label.trim(),
          host: parsed.data.host.trim(),
          port: parsed.data.port,
          username: parsed.data.username.trim(),
          use_https: parsed.data.useHttps,
          managed_in_cloud: true,
          device_role: role,
          model,
          updated_at: now,
        },
        { onConflict: 'hotel_id,device_key' },
      )
      .select('id')
      .single()
    if (error || !data) return { success: false, error: error?.message ?? 'Could not save device.' }
    deviceId = data.id
  }

  if (parsed.data.password?.trim()) {
    const password_encrypted = await encryptAccessSecret(parsed.data.password.trim())
    const { error: secretError } = await admin.from('access_device_secrets').upsert(
      {
        device_id: deviceId,
        hotel_id: parsed.data.hotelId,
        password_encrypted,
        updated_at: now,
      },
      { onConflict: 'device_id' },
    )
    if (secretError) return { success: false, error: secretError.message }
  } else if (!parsed.data.id) {
    return {
      success: false,
      error:
        role === 'enrollment'
          ? 'Password is required for a new enrollment station.'
          : role === 'attendance'
            ? 'Password is required for a new attendance terminal.'
            : 'Password is required for a new controller.',
    }
  } else {
    const { data: existingSecret } = await admin
      .from('access_device_secrets')
      .select('device_id')
      .eq('device_id', deviceId)
      .maybeSingle()
    if (!existingSecret) {
      return { success: false, error: 'Password is required (none stored yet).' }
    }
  }

  revalidateAccess()
  return { success: true, data: { id: deviceId } }
}

export async function deleteCloudAccessDevice(
  hotelId: string,
  deviceId: string,
): Promise<ActionResult> {
  const auth = await requireOwnerHotel(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('access_devices')
    .delete()
    .eq('id', deviceId)
    .eq('hotel_id', hotelId)
  if (error) return { success: false, error: error.message }

  revalidateAccess()
  return { success: true }
}

const staffPersonSchema = z.object({
  hotelId: z.string().uuid(),
  displayName: z.string().min(1).max(120),
  personType: z.enum([
    'owner',
    'manager',
    'receptionist',
    'housekeeping',
    'security',
    'maintenance',
    'other_staff',
    'technical_admin',
  ]),
  accessPolicyId: z.string().uuid(),
  profileId: z.string().uuid().nullable().optional(),
  validFrom: z.string().min(8).max(32),
  validTo: z.string().min(8).max(32),
  cardNo: z.string().max(32).nullable().optional(),
  credentialId: z.string().uuid().optional(),
})

export async function createOrUpdateStaffAccess(
  input: z.infer<typeof staffPersonSchema>,
): Promise<ActionResult<{ credentialId: string }>> {
  const parsed = staffPersonSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid staff access.' }
  }

  const auth = await requireAccessEditor(parsed.data.hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const personType = parsed.data.personType as StaffPersonType
  if (auth.profile.role === 'manager') {
    if (!MANAGER_CREATABLE_STAFF_TYPES.has(personType)) {
      return {
        success: false,
        error: 'Managers cannot create Owner, Manager, or Technical Admin physical access.',
      }
    }
  }

  await ensureDefaultAccessPolicies(parsed.data.hotelId)

  if (parsed.data.validFrom > parsed.data.validTo) {
    return { success: false, error: 'Valid from must be on or before valid to.' }
  }

  const admin = createAdminClient()
  const { data: policy } = await admin
    .from('access_policies')
    .select('id, code, assignable_by_manager')
    .eq('id', parsed.data.accessPolicyId)
    .eq('hotel_id', parsed.data.hotelId)
    .maybeSingle()

  if (!policy) return { success: false, error: 'Access policy not found.' }
  if (auth.profile.role === 'manager' && !policy.assignable_by_manager) {
    return {
      success: false,
      error: 'You are not authorized to assign this staff access policy.',
    }
  }

  const { data: policyDoors } = await admin
    .from('access_policy_points')
    .select('id')
    .eq('hotel_id', parsed.data.hotelId)
    .eq('policy_id', parsed.data.accessPolicyId)
    .limit(1)
  if (!policyDoors?.length) {
    return {
      success: false,
      error: 'This access policy has no doors mapped. Map doors to the policy first.',
    }
  }

  const result = await provisionStaffAccess({
    hotelId: parsed.data.hotelId,
    displayName: parsed.data.displayName.trim(),
    personType,
    accessPolicyId: parsed.data.accessPolicyId,
    profileId: parsed.data.profileId ?? null,
    validFrom: parsed.data.validFrom,
    validTo: parsed.data.validTo,
    cardNo: parsed.data.cardNo ?? null,
    existingCredentialId: parsed.data.credentialId ?? null,
  })

  if (!result.ok) return { success: false, error: result.error }

  void writeAuditLog({
    hotelId: parsed.data.hotelId,
    actorId: auth.userId,
    actorName: auth.profile.name,
    entityType: 'access',
    entityId: result.credentialId,
    action: parsed.data.credentialId ? 'staff_access_updated' : 'staff_access_granted',
    summary: `Staff access ${parsed.data.credentialId ? 'updated' : 'created'} — ${parsed.data.displayName} (${policy.code})`,
  })

  revalidateAccess()
  revalidatePath('/owner/staff')
  revalidatePath('/manager/staff')
  return { success: true, data: { credentialId: result.credentialId } }
}

export async function updateStaffAccessStatusAction(input: {
  hotelId: string
  credentialId: string
  staffStatus: AccessStaffStatus
}): Promise<ActionResult> {
  const auth = await requireAccessEditor(input.hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data: cred } = await admin
    .from('access_credentials')
    .select('id, person_type, display_name, profile_id')
    .eq('id', input.credentialId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!cred || cred.person_type === 'tenant') {
    return { success: false, error: 'Staff credential not found.' }
  }

  if (auth.profile.role === 'manager' && cred.profile_id && cred.profile_id === auth.userId) {
    return {
      success: false,
      error: 'Managers cannot change their own protected physical access.',
    }
  }

  if (
    auth.profile.role === 'manager' &&
    (cred.person_type === 'owner' ||
      cred.person_type === 'manager' ||
      cred.person_type === 'technical_admin')
  ) {
    return { success: false, error: 'Not authorized to change this staff person.' }
  }

  const result = await setStaffAccessStatus(input)
  if (!result.ok) return { success: false, error: result.error }

  void writeAuditLog({
    hotelId: input.hotelId,
    actorId: auth.userId,
    actorName: auth.profile.name,
    entityType: 'access',
    entityId: cred.id,
    action: 'staff_access_status',
    summary: `Staff access ${input.staffStatus} — ${cred.display_name}`,
  })

  revalidateAccess()
  return { success: true }
}

export async function setAccessPolicyPoints(input: {
  hotelId: string
  policyId: string
  accessPointIds: string[]
}): Promise<ActionResult> {
  const auth = await requireAccessEditor(input.hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  await ensureDefaultAccessPolicies(input.hotelId)

  const admin = createAdminClient()
  const { data: policy } = await admin
    .from('access_policies')
    .select('id, assignable_by_manager, code')
    .eq('id', input.policyId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!policy) return { success: false, error: 'Policy not found.' }
  if (auth.profile.role === 'manager' && !policy.assignable_by_manager) {
    return { success: false, error: 'You are not authorized to edit this policy.' }
  }

  const pointIds = [...new Set(input.accessPointIds)]
  if (pointIds.length) {
    const { data: points } = await admin
      .from('access_points')
      .select('id')
      .eq('hotel_id', input.hotelId)
      .in('id', pointIds)
    if ((points ?? []).length !== pointIds.length) {
      return { success: false, error: 'One or more doors are invalid.' }
    }
  }

  await admin
    .from('access_policy_points')
    .delete()
    .eq('hotel_id', input.hotelId)
    .eq('policy_id', input.policyId)

  if (pointIds.length) {
    const { error } = await admin.from('access_policy_points').insert(
      pointIds.map((access_point_id) => ({
        hotel_id: input.hotelId,
        policy_id: input.policyId,
        access_point_id,
      })),
    )
    if (error) return { success: false, error: error.message }
  }

  void writeAuditLog({
    hotelId: input.hotelId,
    actorId: auth.userId,
    actorName: auth.profile.name,
    entityType: 'access',
    entityId: input.policyId,
    action: 'access_policy_points_updated',
    summary: `Policy doors updated — ${policy.code} (${pointIds.length} doors)`,
  })

  revalidateAccess()
  return { success: true }
}

export async function ensureAccessPoliciesAction(hotelId: string): Promise<ActionResult> {
  const auth = await requireAccessEditor(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }
  await ensureDefaultAccessPolicies(hotelId)
  revalidateAccess()
  return { success: true }
}

export async function requestAttendancePull(hotelId: string): Promise<ActionResult> {
  const auth = await requireAccessEditor(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data: device } = await admin
    .from('access_devices')
    .select('device_key, label')
    .eq('hotel_id', hotelId)
    .eq('device_role', 'attendance')
    .eq('managed_in_cloud', true)
    .order('label', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!device) {
    return {
      success: false,
      error:
        'No attendance terminal saved. Owner → Access → add DS-K1A8503MF-B (role: Attendance).',
    }
  }

  const enqueued = await enqueueAccessJob({
    hotelId,
    jobType: 'pull_attendance',
    priority: 40,
    idempotencyKey: `pull-attendance:${hotelId}:${device.device_key}:${new Date().toISOString().slice(0, 13)}`,
    payload: {
      deviceKey: device.device_key,
      label: device.label,
    },
  })

  if ('error' in enqueued) return { success: false, error: enqueued.error }
  if ('skipped' in enqueued) {
    return { success: false, error: 'Access control is not enabled.' }
  }

  revalidateAccess()
  return { success: true }
}
