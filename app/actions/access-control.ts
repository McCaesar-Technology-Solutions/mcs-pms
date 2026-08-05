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
import { writeAuditLog } from '@/lib/audit/log'
import { getAppOrigin } from '@/lib/env'
import type { AccessZone, DeviceCredentialMode } from '@/lib/access/types'

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
  zone: z.enum(['unit', 'lobby', 'gate', 'elevator', 'other']),
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
  const row = {
    hotel_id: parsed.data.hotelId,
    device_key: parsed.data.deviceKey.trim(),
    door_no: parsed.data.doorNo,
    label: parsed.data.label.trim(),
    zone: parsed.data.zone as AccessZone,
    room_id: parsed.data.zone === 'unit' ? (parsed.data.roomId ?? null) : null,
    grants_shared_access: parsed.data.zone !== 'unit' ? true : parsed.data.grantsSharedAccess,
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
  cred: { guest_id: string | null },
) {
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

  return (points ?? [])
    .filter((p) => {
      if (p.grants_shared_access || p.zone !== 'unit') return true
      return guestRoomId != null && p.room_id === guestRoomId
    })
    .map((p) => ({
      deviceKey: p.device_key,
      doorNo: p.door_no,
      label: p.label,
      zone: p.zone,
    }))
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

  const result = await cancelAccessJob({ hotelId: input.hotelId, jobId: input.jobId })
  if ('error' in result) return { success: false, error: result.error }
  revalidateAccess()
  return { success: true }
}

export async function cancelOpenAccessJobsAction(hotelId: string): Promise<ActionResult<{ count: number }>> {
  const auth = await requireAccessOps(hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const result = await cancelOpenAccessJobs({ hotelId })
  if ('error' in result) return { success: false, error: result.error }
  revalidateAccess()
  return { success: true, data: { count: result.count } }
}

export async function clearAccessJobsAction(hotelId: string): Promise<ActionResult<{ count: number }>> {
  const auth = await requireAccessOps(hotelId)
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

  const station = await resolveEnrollmentStation(admin, input.hotelId)
  if (!station) {
    return {
      success: false,
      error:
        'No enrollment station saved. Owner → Access → add DS-K1F600U-D6E-F (role: Enrollment station).',
    }
  }

  const doors = await resolveCredentialDoors(admin, input.hotelId, cred)
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
    .eq('hotel_id', input.hotelId)
    .eq('is_active', true)

  const doors = (points ?? [])
    .filter((p) => {
      if (p.grants_shared_access || p.zone !== 'unit') return true
      return guestRoomId != null && p.room_id === guestRoomId
    })
    .map((p) => ({
      deviceKey: p.device_key,
      doorNo: p.door_no,
      label: p.label,
      zone: p.zone,
    }))

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

  if (!cred || !cred.guest_id || !cred.reservation_id) {
    return { success: false, error: 'Credential not found.' }
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
  deviceRole: z.enum(['door', 'enrollment']).default('door'),
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
    (role === 'enrollment' ? 'DS-K1F600U-D6E-F' : null)

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
      error: role === 'enrollment' ? 'Password is required for a new enrollment station.' : 'Password is required for a new controller.',
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
